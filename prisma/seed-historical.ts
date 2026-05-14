/*
 * 과거 연도(21~25) 프로젝트 시드
 *
 * 데이터 소스:
 *   - 21년: 00.프로젝트관리_21년_(주)대동CMC.xlsm — '2021년프로젝트관리' 시트
 *   - 22년: 01.프로젝트관리_22년_(주)대동CMC(1).xlsm — '2022년프로젝트관리' 시트
 *   - 23년: 01.프로젝트관리_23년_(주)대동CMC(1).xlsm — '2023년프로젝트관리' 시트
 *   - 24년: 2024 발굴 *.csv + 2024 육성 *.csv (노션 export)
 *   - 25년: 2025 발굴 *.csv + 2025 육성 *.csv (노션 export)
 *
 * 21-23 엑셀: '전략과제' 칼럼이 '발굴' 또는 '육성', 빈칸이면 직전 그룹 유지
 * 24-25 CSV : 노션 형식 (26과 동일)
 *
 * 멱등성: projectCode UNIQUE → upsert
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const BASE = path.join(__dirname, "..", "..", "노션 프로젝트 관리 DB");

// ───── 매핑 ─────
const BIZ_MAP: Record<string, string> = {
  혁신바우처: "innovation",
  수출바우처: "export",
  용역: "contract",
  인증: "certification",
  임대: "rental",
  제조혁신바우처: "innovation",
};
const STATUS_MAP: Record<string, string> = {
  서비스요청수신: "request_received",
  수행계약대기: "contract_pending",
  원가감리: "cost_audit",
  서비스진행중: "in_progress",
  성과물검토중: "review_pending",
  정산승인요청: "settlement_request",
  정산완료: "settlement_done",
  입금완료: "payment_done",
  사업신청: "request_received",
  문의: "request_received",
  탈락: "request_received",
  미진행: "request_received",
  진행중: "in_progress",
};
const SERVICE_MAP: Record<string, string> = {
  혁신컨설팅: "consulting",
  혁신마케팅: "marketing",
  혁신기술지원: "tech_support",
  수출컨설팅: "export_consulting",
  통번역: "translation",
  전시회행사: "exhibition",
  용역컨설팅: "contract_work",
  인증: "certification",
  임대: "rental",
  비용정산: "cost_settlement",
  컨설팅: "consulting",
  마케팅: "marketing",
  기술지원: "tech_support",
};

// ───── 유틸 ─────
function cleanStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function toBigInt(v: any): bigint {
  if (v == null) return 0n;
  if (typeof v === "number") return BigInt(Math.round(v));
  const cleaned = String(v).replace(/[^\d-]/g, "");
  if (!cleaned) return 0n;
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
}

function excelDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    const m = s.match(/(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
    if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  return null;
}

function parseDateRange(text: any): { start: Date | null; end: Date | null } {
  if (!text || typeof text !== "string") return { start: null, end: null };
  const m = text.match(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2}).*?(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (!m) return { start: null, end: null };
  return {
    start: new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`),
    end: new Date(`${m[4]}-${m[5].padStart(2, "0")}-${m[6].padStart(2, "0")}`),
  };
}

async function findOrCreateCompany(name: string, region?: string | null) {
  const existing = await prisma.company.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.company.create({
    data: { name, type: "client", region: region ?? null },
  });
}

async function findUserByName(name: string | null) {
  if (!name) return null;
  return prisma.user.findFirst({ where: { name } });
}

// ───── 21년 (단순 구조) ─────
async function seedYear2021() {
  const filePath = path.join(BASE, "00.프로젝트관리_21년_(주)대동CMC.xlsm");
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ 21년 파일 없음: ${filePath}`);
    return 0;
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["2021년프로젝트관리"];
  if (!ws) {
    console.log("⚠ '2021년프로젝트관리' 시트 없음");
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  // 21년 컬럼 인덱스 (row 1 헤더 기준)
  // 0:전략과제, 1:실행전략, 2:사업영역, 3:업체/기관명, 4:내용, 5:PM, 6:담당자, 7:금액, 25:비고
  let currentSource: "discovery" | "nurture" = "discovery";
  let count = 0;
  let order = 0;

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const strategy = cleanStr(r[0]);
    if (strategy === "발굴") currentSource = "discovery";
    else if (strategy === "육성") currentSource = "nurture";

    const name = cleanStr(r[3]);
    if (!name) continue;
    order++;

    const bizRaw = cleanStr(r[2]) ?? "";
    const company = await findOrCreateCompany(name);
    const pmCode = cleanStr(r[5]);
    const managerName = cleanStr(r[6]);
    const manager = await findUserByName(managerName);

    const code = `2021-${currentSource === "discovery" ? "D" : "N"}-${String(order).padStart(4, "0")}`;

    await prisma.project.upsert({
      where: { projectCode: code },
      update: {},
      create: {
        projectCode: code,
        sortOrder: order,
        year: 2021,
        title: name,
        companyId: company.id,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        status: "settlement_done",  // 21년 자료는 다 마감된 것으로 간주
        source: currentSource,
        confirmedYn: currentSource === "nurture",
        pmCode,
        managerId: manager?.id ?? null,
        confirmedRevenue: toBigInt(r[7]),
        content: cleanStr(r[4]),
        notes: cleanStr(r[25]),
      },
    });
    count++;
  }
  console.log(`✓ 2021년: ${count}건`);
  return count;
}

// ───── 22년 / 23년 (같은 구조) ─────
async function seedYear2022Or2023(filePath: string, year: number) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ ${year}년 파일 없음: ${filePath}`);
    return 0;
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[`${year}년프로젝트관리`];
  if (!ws) {
    console.log(`⚠ '${year}년프로젝트관리' 시트 없음`);
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  // 22/23 컬럼: 0:전략과제, 1:실행전략, 2:연도("2022년"/"2023년"), 3:사업영역, 4:상세서비스, 5:업체/기관명, 6:내용, 7:지역, 8:PM, 9:담당자, 10:금액, 11:신규, 12:육성, 32:비고
  let currentSource: "discovery" | "nurture" = "discovery";
  let count = 0;
  let order = 0;

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const strategy = cleanStr(r[0]);
    if (strategy === "발굴") currentSource = "discovery";
    else if (strategy === "육성") currentSource = "nurture";

    const name = cleanStr(r[5]);
    if (!name) continue;
    order++;

    const bizRaw = cleanStr(r[3]) ?? "";
    const serviceRaw = cleanStr(r[4]) ?? "";
    const region = cleanStr(r[7]);
    const company = await findOrCreateCompany(name, region);
    const pmCode = cleanStr(r[8]);
    const managerName = cleanStr(r[9]);
    const manager = await findUserByName(managerName);

    const isNew = cleanStr(r[11]) === "Yes" || cleanStr(r[11]) === "O";
    const isNurture = cleanStr(r[12]) === "Yes" || cleanStr(r[12]) === "O";

    const code = `${year}-${currentSource === "discovery" ? "D" : "N"}-${String(order).padStart(4, "0")}`;

    // 진행 상태 자동 — 22/23은 마감된 것으로 간주 (육성은 입금완료, 발굴은 request_received)
    const status = currentSource === "nurture" ? "settlement_done" : "request_received";

    await prisma.project.upsert({
      where: { projectCode: code },
      update: {},
      create: {
        projectCode: code,
        sortOrder: order,
        year,
        title: name,
        companyId: company.id,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        serviceType: SERVICE_MAP[serviceRaw] ?? null,
        serviceDetail: SERVICE_MAP[serviceRaw] ? null : serviceRaw,
        region,
        status,
        source: currentSource,
        confirmedYn: currentSource === "nurture",
        nurtureType: isNew ? "new" : isNurture ? "nurture" : null,
        pmCode,
        managerId: manager?.id ?? null,
        confirmedRevenue: toBigInt(r[10]),
        content: cleanStr(r[6]),
        notes: cleanStr(r[32]),
      },
    });
    count++;
  }
  console.log(`✓ ${year}년: ${count}건`);
  return count;
}

// ───── 24/25 발굴 CSV (노션 형식) ─────
async function seedNotionDiscoveryCsv(filePath: string, expectedYear: number) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ 발굴 ${expectedYear} 파일 없음`);
    return 0;
  }
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });

  let count = 0;
  let order = 0;
  for (const row of rows) {
    const name = cleanStr(row["업체.기관명"]);
    if (!name) continue;
    const rowYear = Number(row["연도"] ?? expectedYear) || expectedYear;
    if (rowYear !== expectedYear) continue; // 24년 파일에 25년 row가 섞여 있어도 24만 적재
    order++;

    const bizRaw = String(row["사업영역"] ?? "").split(",")[0].trim();
    const serviceRaw = String(row["서비스"] ?? "").trim();
    const statusRaw = String(row["진행현황"] ?? "").trim();
    const region = cleanStr(row["지역"]);
    const company = await findOrCreateCompany(name, region);
    const pmCode = cleanStr(row["PM"]);
    const managerName = cleanStr(row["담당자"]);
    const manager = await findUserByName(managerName);

    const confirmedYn = cleanStr(row["확정"]) === "Yes";
    const confirmedRev = String(row["확정매출"] ?? "0").replace(/[^\d]/g, "");
    const expectedRev = String(row["예상매출"] ?? "0").replace(/[^\d]/g, "");
    const selfFundingRaw = row["자부담"];

    const code = `${expectedYear}-DISC-${String(order).padStart(4, "0")}`;

    await prisma.project.upsert({
      where: { projectCode: code },
      update: {},
      create: {
        projectCode: code,
        sortOrder: order,
        year: expectedYear,
        title: name,
        companyId: company.id,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        serviceType: SERVICE_MAP[serviceRaw] ?? null,
        serviceDetail: cleanStr(row["상세서비스"]),
        status: STATUS_MAP[statusRaw] ?? "request_received",
        source: "discovery",
        confirmedYn,
        confirmedRevenue: BigInt(confirmedRev || "0"),
        expectedRevenue: BigInt(expectedRev || "0"),
        pmCode,
        managerId: manager?.id ?? null,
        region,
        content: cleanStr(row["내용"]),
        selfFunding: selfFundingRaw != null ? Number(String(selfFundingRaw).replace(/[^\d.]/g, "")) || null : null,
        nurtureType: row["신규육성"] === "신규" ? "new" : row["신규육성"] === "육성" ? "nurture" : null,
        notes: cleanStr(row["비고"]),
      },
    });
    count++;
  }
  console.log(`✓ ${expectedYear}년 발굴: ${count}건`);
  return count;
}

// ───── 24/25 육성 CSV (노션 형식) ─────
async function seedNotionNurtureCsv(filePath: string, expectedYear: number) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ 육성 ${expectedYear} 파일 없음`);
    return 0;
  }
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });

  let count = 0;
  let order = 0;
  for (const row of rows) {
    const code = cleanStr(row["구분"]);
    const title = cleanStr(row["업체.기관명"]);
    if (!code || !title) continue;
    const rowYear = Number(row["연도"] ?? expectedYear) || expectedYear;
    if (rowYear !== expectedYear) continue;
    order++;

    const bizRaw = String(row["사업영역"] ?? "").split(",")[0].trim();
    const serviceRaw = String(row["서비스"] ?? "").trim();
    const statusRaw = String(row["진행현황"] ?? "").trim();
    const region = cleanStr(row["지역"]);
    const companyName = title.replace(/\s*[CMTBR]?\s*(\(선금\)|\(잔금\))?\s*$/u, "").trim();
    const company = companyName ? await findOrCreateCompany(companyName, region) : null;

    const agencyName = cleanStr(row["운영기관"]);
    let agency = null;
    if (agencyName) {
      agency = await prisma.company.findFirst({ where: { name: agencyName } });
      if (!agency) agency = await prisma.company.create({ data: { name: agencyName, type: "agency" } });
    }

    const pmCode = cleanStr(row["PM"]);
    const managerName = cleanStr(row["담당자"]);
    const manager = await findUserByName(managerName);

    const isAdvance = /\(선금\)/.test(title);
    const isBalance = /\(잔금\)/.test(title);
    const projectCodeUnique = `${expectedYear}-${code}-${isAdvance ? "A" : isBalance ? "B" : "M"}`;
    const { start, end } = parseDateRange(row["수행일자"]);

    const confirmedRev = String(row["확정매출"] ?? "0").replace(/[^\d]/g, "");
    const invoiceAmt = String(row["계산서발행금액"] ?? "0").replace(/[^\d]/g, "");

    // 업체 컨택 추가
    if (company && row["업체담당자"]) {
      const cname = String(row["업체담당자"]);
      const exists = await prisma.companyContact.findFirst({
        where: { companyId: company.id, name: cname },
      });
      if (!exists) {
        await prisma.companyContact.create({
          data: {
            companyId: company.id,
            name: cname,
            phone: cleanStr(row["전화번호"]),
            email: cleanStr(row["이메일"]),
            isPrimary: true,
          },
        });
      }
    }

    await prisma.project.upsert({
      where: { projectCode: projectCodeUnique },
      update: {},
      create: {
        projectCode: projectCodeUnique,
        displayCode: code,
        sortOrder: order,
        year: expectedYear,
        title,
        companyId: company?.id ?? null,
        agencyId: agency?.id ?? null,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        serviceType: SERVICE_MAP[serviceRaw] ?? serviceRaw ?? null,
        serviceDetail: cleanStr(row["상세서비스"]),
        status: STATUS_MAP[statusRaw] ?? "request_received",
        source: "nurture",
        confirmedYn: true,
        pmCode,
        managerId: manager?.id ?? null,
        confirmedRevenue: BigInt(confirmedRev || "0"),
        nurtureType: row["신규육성"] === "신규" ? "new" : row["신규육성"] === "육성" ? "nurture" : null,
        region,
        startDate: start,
        endDate: end,
        isAdvance,
        isBalance,
        parentProjectCode: isAdvance || isBalance ? `${expectedYear}-${code}` : null,
        requestStatus:
          row["요청수신"] === "작성완료"
            ? "received"
            : row["요청수신"] === "접수"
              ? "submitted"
              : row["요청수신"] === "해당없음"
                ? "na"
                : null,
        agreementYn: row["협약"] === "Yes",
        advancePaidYn: row["선금"] === "Yes",
        midReportDate: excelDate(row["중간보고일자"]),
        midReportYn: row["중간보고"] === "Yes",
        finalReportDate: excelDate(row["완료보고일자"]),
        finalReportYn: row["완료보고"] === "Yes",
        revisionYn: row["보완"] === "Yes",
        keyword: cleanStr(row["키워드"]),
        notes: cleanStr(row["비고"]),
      },
    });

    // 세금계산서 (있으면)
    if (row["계산서발행"] === "Yes" || invoiceAmt !== "0") {
      const project = await prisma.project.findUnique({ where: { projectCode: projectCodeUnique } });
      if (project) {
        const existing = await prisma.taxInvoice.findFirst({ where: { projectId: project.id } });
        if (!existing) {
          await prisma.taxInvoice.create({
            data: {
              projectId: project.id,
              companyId: company?.id ?? null,
              amount: BigInt(invoiceAmt || "0"),
              issueDate: excelDate(row["발행일자"]),
              issuedYn: row["계산서발행"] === "Yes",
              vatReceivedYn: row["부가세입금"] === "Yes",
              settlementDoneYn: row["정산완료"] === "Yes",
              paymentDoneYn: row["입금완료"] === "Yes",
              paymentDate: excelDate(row["입금일자"]),
              description: cleanStr(row["품목"]),
            },
          });
        }
      }
    }
    count++;
  }
  console.log(`✓ ${expectedYear}년 육성: ${count}건`);
  return count;
}

// ───── main ─────
async function main() {
  console.log("\n📁 노션/엑셀 과거 자료 시드 시작...\n");

  const totals: Record<number, number> = {};
  totals[2021] = await seedYear2021();
  totals[2022] = await seedYear2022Or2023(
    path.join(BASE, "01.프로젝트관리_22년_(주)대동CMC(1).xlsm"),
    2022
  );
  totals[2023] = await seedYear2022Or2023(
    path.join(BASE, "01.프로젝트관리_23년_(주)대동CMC(1).xlsm"),
    2023
  );
  totals[2024] = 0;
  totals[2024] += await seedNotionDiscoveryCsv(
    path.join(BASE, "2024 발굴 9d182b601d6b48c3ab19fd1fab237986.csv"),
    2024
  );
  totals[2024] += await seedNotionNurtureCsv(
    path.join(BASE, "2024 육성 e25257628a9644ba9a19242bc60ad36c.csv"),
    2024
  );
  totals[2025] = 0;
  totals[2025] += await seedNotionDiscoveryCsv(
    path.join(BASE, "2025 발굴 13c2862807ac8094ad17d686c0afdea0.csv"),
    2025
  );
  totals[2025] += await seedNotionNurtureCsv(
    path.join(BASE, "2025 육성 16e2862807ac80fc895cd3277451756e.csv"),
    2025
  );

  // 2023년도 데이터가 24 발굴 CSV에도 일부 있음 → 별도 추가 시드
  console.log("\n📊 시드 결과");
  for (const [y, c] of Object.entries(totals)) console.log(`  ${y}년: ${c}건`);

  // 전체 통계
  const grandTotal = await prisma.project.groupBy({
    by: ["year"],
    _count: true,
    orderBy: { year: "desc" },
  });
  console.log("\n📊 DB 현재 연도별 프로젝트:");
  for (const g of grandTotal) console.log(`  ${g.year}년: ${g._count}건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
