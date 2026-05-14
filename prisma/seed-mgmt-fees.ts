/*
 * 업체별 관리비_.xlsx → DB 동기화
 *
 * 컬럼:
 *   0:사업연도 | 1:구분(임의코드,무시) | 2:업체명 | 3:정부보조금 | 4:기업분담금 |
 *   5:과제총액 | 6:관리비 | 7:비율 | 8:지급총액 | 9:사업비 | 10:예산초과금 |
 *   11:지불업체명 | 12:세금계산서발행일자 | 13:지급액 | 14:계약서작성 | 15:잔금 |
 *   16:입금완료 | 17:정산완료 | 18:보관 | 19:비고
 *
 * 그룹핑: (year, 업체명에서 _N 접미사 제거한 normalized name) → 한 사업
 *   첫 행 → 예산 정보 채움
 *   모든 행(첫 행 포함) → 지출 row 추가
 *
 * 매칭:
 *   - 클라이언트 업체명 → companies와 이름 정규화 매칭
 *   - 클라이언트 (year, 업체) → projects와 매칭, 1개면 자동 연결
 *   - 지불업체 → companies와 매칭, 없으면 type=vendor로 신규 생성
 *
 * 멱등성: 동일 (year, normalizedClient) 사업이 있으면 스킵.
 *   완전 재실행하려면 --reset 인자로 모든 MgmtFeeBudget 삭제 후 재생성.
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();
const FILE = path.join(__dirname, "..", "..", "거래처 DB", "업체별 관리비_.xlsx");
const RESET = process.argv.includes("--reset");

function cleanStr(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

function cleanNum(raw: any): bigint {
  if (raw == null || raw === "") return BigInt(0);
  if (typeof raw === "number") return BigInt(Math.round(raw));
  const s = String(raw).replace(/[^\d-]/g, "");
  if (!s || s === "-") return BigInt(0);
  return BigInt(s);
}

function cleanFloat(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[^\d.-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function cleanBool(raw: any): boolean {
  if (raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "o";
}

function excelSerialToDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") {
    // Excel serial date (1900-based)
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const m = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
    const n = Number(raw);
    if (!isNaN(n) && n > 1000) return excelSerialToDate(n);
  }
  return null;
}

/** 회사명 정규화 — ㈜/(주)/공백/_N 접미사 + 연도 2자리 접미사 제거 */
function normalizeName(name: string, year: number): string {
  return stripYearSuffix(name, year)
    .replace(/_\d+\s*$/, "") // _1, _2, _10 접미사
    .replace(/\s+/g, "")
    .replace(/\([주㈜재]\)/g, "")
    .replace(/[㈜㈐]/g, "")
    .replace(/주식회사/g, "")
    .replace(/유한회사/g, "")
    .replace(/유한책임회사/g, "")
    .toLowerCase();
}

/** 업체명에서 _N 지출순번 접미사 제거 (표시용) */
function stripSeqSuffix(name: string): string {
  return name.replace(/_\d+\s*$/, "").trim();
}

/**
 * 업체명에서 연도 2자리 접미사 제거.
 * 예: ("제이오토26", 2026) → "제이오토" / ("주식회사 네오실", 2022) → "주식회사 네오실"
 *     ("ABC25", 2026) → "ABC25" (연도 불일치 → 그대로)
 */
function stripYearSuffix(name: string, year: number): string {
  const yy = String(year).slice(-2); // 26, 25, ...
  // _N 접미사 먼저 제거하고 끝에 yy가 붙어있는지 확인
  const noSeq = name.replace(/_\d+\s*$/, "");
  const re = new RegExp(`${yy}\\s*$`);
  if (re.test(noSeq)) {
    return noSeq.replace(re, "").trim();
  }
  return noSeq.trim();
}

/**
 * '구분' 컬럼 prefix → bizCategory 매핑
 *   a, aa, aaa, A, AA → innovation (혁신바우처)
 *   b, bb, bbb, B → export (수출바우처)
 *   C, c → tp (테크노파크)
 *   D, d → contract (용역)
 */
function parseBizCategory(rawCode: string | null | undefined): string | null {
  if (!rawCode) return null;
  const c = rawCode.trim();
  if (!c) return null;
  // 앞 글자(들)만 보기 — 숫자 떼고 letter만
  const letters = c.match(/^[a-zA-Z]+/)?.[0] ?? "";
  if (!letters) return null;
  const first = letters[0].toLowerCase();
  if (first === "a") return "innovation";
  if (first === "b") return "export";
  if (first === "c") return "tp";
  if (first === "d") return "contract";
  return null;
}

/** 거래처명 정규화 (이름 매칭용, _N 접미사는 처리 X) */
function normCompanyName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/\([주㈜재]\)/g, "")
    .replace(/[㈜㈐]/g, "")
    .replace(/주식회사/g, "")
    .replace(/유한회사/g, "")
    .toLowerCase();
}

type Row = any[];

async function main() {
  console.log("📂 파일:", FILE);
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null });
  console.log(`📊 총 ${rows.length}행 (헤더 1행 포함)`);

  if (RESET) {
    console.log("\n⚠️  --reset: 기존 MgmtFeeBudget 전체 삭제");
    await prisma.mgmtFeeExpense.deleteMany({});
    await prisma.mgmtFeeBudget.deleteMany({});
  }

  // 거래처 캐시
  const allCompanies = await prisma.company.findMany({ select: { id: true, name: true, type: true } });
  const companyByNorm = new Map<string, { id: string; name: string; type: string }>();
  for (const c of allCompanies) {
    const k = normCompanyName(c.name);
    if (!companyByNorm.has(k)) companyByNorm.set(k, c);
  }
  console.log(`📚 기존 거래처: ${allCompanies.length}개사`);

  // 프로젝트 캐시
  const allProjects = await prisma.project.findMany({ select: { id: true, year: true, companyId: true, title: true } });

  // 데이터 행을 (year, normalizedClient) 기준으로 그룹화
  type Group = { year: number; clientRaw: string; clientNorm: string; rawCode: string | null; rows: Row[] };
  const groups = new Map<string, Group>();
  let dataRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as Row;
    if (!r || r.length === 0) continue;
    const year = Number(r[0]);
    const clientName = cleanStr(r[2]);
    if (!year || !clientName) continue;
    dataRows++;

    const norm = normalizeName(clientName, year);
    const key = `${year}::${norm}`;
    const rawCode = cleanStr(r[1]);
    if (!groups.has(key)) {
      // 표시용 이름 = 연도접미사 + _N 둘 다 제거
      const displayName = stripYearSuffix(stripSeqSuffix(clientName), year);
      groups.set(key, { year, clientRaw: displayName, clientNorm: norm, rawCode, rows: [] });
    }
    groups.get(key)!.rows.push(r);
  }
  console.log(`📋 데이터 행 ${dataRows}개 → ${groups.size}개 사업으로 그룹화`);

  // 연도별 seq 카운터
  const yearSeq = new Map<number, number>();
  for (const y of [...new Set(Array.from(groups.values()).map((g) => g.year))]) {
    const last = await prisma.mgmtFeeBudget.findFirst({
      where: { year: y },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    yearSeq.set(y, last?.seq ?? 0);
  }

  // 등장 순서 보존: 시트 row 순으로 groups 처리되도록 정렬
  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year; // 최신연도 먼저
    return rows.indexOf(a.rows[0]) - rows.indexOf(b.rows[0]);
  });

  let budgetCreated = 0;
  let budgetSkipped = 0;
  let expenseCreated = 0;
  let vendorCreated = 0;
  let clientMatched = 0;
  let projectAutoLinked = 0;
  const bizStats: Record<string, number> = {};

  for (const g of sortedGroups) {
    // 기존 사업이 이미 있으면 스킵 (이름+연도 매칭)
    const existing = await prisma.mgmtFeeBudget.findFirst({
      where: { year: g.year, clientName: g.clientRaw },
    });
    if (existing) {
      budgetSkipped++;
      continue;
    }

    // 첫 행 = 예산 정보
    const first = g.rows[0];
    const subsidy = cleanNum(first[3]);
    const companyShare = cleanNum(first[4]);
    const totalAmount = cleanNum(first[5]);
    const mgmtFeeAmount = cleanNum(first[6]);
    const mgmtFeeRate = cleanFloat(first[7]);
    const payableTotal = cleanNum(first[8]);
    const overBudget = cleanNum(first[10]);
    const budgetNotes = cleanStr(first[19]);

    // 클라이언트 거래처 매칭
    const clientCompany = companyByNorm.get(normCompanyName(g.clientRaw)) ?? null;
    if (clientCompany) clientMatched++;

    // 프로젝트 자동 매칭 — (year, companyId) 1개면 자동 연결
    let projectId: string | null = null;
    if (clientCompany) {
      const matches = allProjects.filter((p) => p.year === g.year && p.companyId === clientCompany.id);
      if (matches.length === 1) {
        projectId = matches[0].id;
        projectAutoLinked++;
      }
    }

    // 연도별 seq
    const seq = (yearSeq.get(g.year) ?? 0) + 1;
    yearSeq.set(g.year, seq);

    const bizCategory = parseBizCategory(g.rawCode);
    const bizKey = bizCategory ?? "(없음)";
    bizStats[bizKey] = (bizStats[bizKey] ?? 0) + 1;

    const newBudget = await prisma.mgmtFeeBudget.create({
      data: {
        year: g.year,
        seq,
        bizCategory,
        rawCode: g.rawCode,
        clientCompanyId: clientCompany?.id ?? null,
        clientName: g.clientRaw,
        projectId,
        subsidy,
        companyShare,
        totalAmount,
        mgmtFeeAmount,
        mgmtFeeRate,
        payableTotal,
        overBudget,
        notes: budgetNotes,
      },
    });
    budgetCreated++;

    // 지출 row들 — 지불업체명이 있는 행만
    let exSeq = 0;
    for (const r of g.rows) {
      const vendorName = cleanStr(r[11]);
      if (!vendorName) continue;
      exSeq++;

      // 매입처 매칭 / 자동 생성
      const vendorNorm = normCompanyName(vendorName);
      let vendor = companyByNorm.get(vendorNorm);
      if (!vendor) {
        // 신규 생성 (type=vendor)
        const created = await prisma.company.create({
          data: { name: vendorName, type: "vendor" },
          select: { id: true, name: true, type: true },
        });
        vendor = created;
        companyByNorm.set(vendorNorm, vendor);
        vendorCreated++;
      }

      await prisma.mgmtFeeExpense.create({
        data: {
          budgetId: newBudget.id,
          seq: exSeq,
          vendorCompanyId: vendor.id,
          vendorName,
          taxInvoiceDate: excelSerialToDate(r[12]),
          amount: cleanNum(r[13]),
          runningBalance: r[15] != null ? cleanNum(r[15]) : null,
          contractDone: cleanBool(r[14]),
          paymentDate: excelSerialToDate(r[16]),
          settlementDone: cleanBool(r[17]),
          filed: cleanBool(r[18]),
          notes: cleanStr(r[19]),
        },
      });
      expenseCreated++;
    }
  }

  console.log(`\n✅ 동기화 완료`);
  console.log(`   사업 신규:        ${budgetCreated}건`);
  console.log(`   사업 스킵(기존):  ${budgetSkipped}건`);
  console.log(`   지출 신규:        ${expenseCreated}건`);
  console.log(`   매입처 자동생성:  ${vendorCreated}건`);
  console.log(`   클라이언트 매칭:  ${clientMatched}/${budgetCreated}`);
  console.log(`   프로젝트 자동연결: ${projectAutoLinked}/${budgetCreated}`);
  console.log(`   사업영역 분포:    ${Object.entries(bizStats).map(([k, v]) => `${k}=${v}`).join(" / ")}`);

  const finalBudget = await prisma.mgmtFeeBudget.count();
  const finalExpense = await prisma.mgmtFeeExpense.count();
  console.log(`\n📊 최종: 사업 ${finalBudget}건 / 지출 ${finalExpense}건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
