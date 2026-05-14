/*
 * 실적 관리: 혁신/수출 서비스 수행이력 import
 *
 * 파일:
 *   - 수출 서비스수행이력_20260514143330.xlsx  → type=export (9컬럼)
 *     0:번호 1:서비스명 2:서비스이용금액 3:요금형태 4:시작일 5:종료일 6:수요기업명 7:처리일자 8:진행상태
 *
 *   - 혁신 수행중인 서비스_20260514.xlsx  → type=innovation (18컬럼)
 *     0:번호 1:서비스명 2:서비스요금 3:처리금액 4:요금형태 5:시작일 6:종료일 7:지원사업명
 *     8:연도 9:차수 10:사업기간시작일 11:사업기간종료일 12:사업자번호변경여부 13:참여기업
 *     14:처리일자 15:진행상태 16:국가 17:지역
 *
 * 매칭: 수요기업/참여기업 → Company.name 정규화 매칭. 못 찾으면 clientCompanyId=null + clientName text 저장.
 *
 * 멱등성: --reset 으로 TrackRecord 전체 삭제 후 재생성. 기본은 중복 스킵.
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();
const BASE = path.join(__dirname, "..", "..", "노션 프로젝트 관리 DB");
const FILE_EXPORT = path.join(BASE, "수출 서비스수행이력_20260514143330.xlsx");
const FILE_INNOVATION = path.join(BASE, "혁신 수행중인 서비스_20260514.xlsx");
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

function cleanInt(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).replace(/[^\d-]/g, "");
  if (!s || s === "-") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function cleanBool(raw: any): boolean {
  if (raw == null) return false;
  const s = String(raw).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "TRUE" || s === "O";
}

function parseDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") {
    // Excel serial date
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    // ISO-like "2025-09-23" or "2026-04-15 10:38:52.0"
    const m1 = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m1) return new Date(`${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`);
    const n = Number(s);
    if (!isNaN(n) && n > 1000) return parseDate(n);
  }
  return null;
}

/** 회사명 정규화 (Company 매칭용) */
function normCompanyName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/\([주㈜재]\)/g, "")
    .replace(/[㈜㈐]/g, "")
    .replace(/주식회사/g, "")
    .replace(/유한회사/g, "")
    .replace(/유한책임회사/g, "")
    .toLowerCase();
}

async function main() {
  if (RESET) {
    console.log("⚠️  --reset: 기존 TrackRecord 전체 삭제");
    await prisma.trackRecord.deleteMany({});
  }

  // 거래처 캐시
  const allCompanies = await prisma.company.findMany({ select: { id: true, name: true } });
  const byNorm = new Map<string, { id: string; name: string }>();
  for (const c of allCompanies) {
    const k = normCompanyName(c.name);
    if (!byNorm.has(k)) byNorm.set(k, c);
  }
  console.log(`📚 기존 거래처: ${allCompanies.length}개사`);

  // ── 수출 import ──
  const exportWb = XLSX.readFile(FILE_EXPORT);
  const exportRows = XLSX.utils.sheet_to_json<any[]>(exportWb.Sheets[exportWb.SheetNames[0]], {
    header: 1,
    defval: null,
  });
  console.log(`\n📦 수출 ${exportRows.length}행`);
  let exportCreated = 0;
  let exportMatched = 0;
  for (let i = 1; i < exportRows.length; i++) {
    const r = exportRows[i] as any[];
    if (!r || r.length === 0) continue;
    const seqNo = cleanInt(r[0]);
    const serviceName = cleanStr(r[1]);
    const clientName = cleanStr(r[6]);
    if (!serviceName && !clientName) continue;

    const norm = clientName ? normCompanyName(clientName) : null;
    const match = norm ? byNorm.get(norm) : null;
    if (match) exportMatched++;

    await prisma.trackRecord.create({
      data: {
        type: "export",
        seqNo,
        serviceName: serviceName ?? "(미지정)",
        serviceFee: cleanNum(r[2]),
        feeType: cleanStr(r[3]),
        startDate: parseDate(r[4]),
        endDate: parseDate(r[5]),
        clientCompanyId: match?.id ?? null,
        clientName: clientName ?? "(미지정)",
        processedDate: parseDate(r[7]),
        status: cleanStr(r[8]),
      },
    });
    exportCreated++;
  }
  console.log(`   ✓ 수출 ${exportCreated}건 신규 / 거래처 매칭 ${exportMatched}건`);

  // ── 혁신 import ──
  const innoWb = XLSX.readFile(FILE_INNOVATION);
  const innoRows = XLSX.utils.sheet_to_json<any[]>(innoWb.Sheets[innoWb.SheetNames[0]], {
    header: 1,
    defval: null,
  });
  console.log(`\n📦 혁신 ${innoRows.length}행`);
  let innoCreated = 0;
  let innoMatched = 0;
  for (let i = 1; i < innoRows.length; i++) {
    const r = innoRows[i] as any[];
    if (!r || r.length === 0) continue;
    const seqNo = cleanInt(r[0]);
    const serviceName = cleanStr(r[1]);
    const clientName = cleanStr(r[13]);
    if (!serviceName && !clientName) continue;

    const norm = clientName ? normCompanyName(clientName) : null;
    const match = norm ? byNorm.get(norm) : null;
    if (match) innoMatched++;

    await prisma.trackRecord.create({
      data: {
        type: "innovation",
        seqNo,
        serviceName: serviceName ?? "(미지정)",
        serviceFee: cleanNum(r[2]),
        processedAmount: r[3] != null ? cleanNum(r[3]) : null,
        feeType: cleanStr(r[4]),
        startDate: parseDate(r[5]),
        endDate: parseDate(r[6]),
        supportProgram: cleanStr(r[7]),
        year: cleanInt(r[8]),
        round: cleanInt(r[9]),
        bizPeriodStart: parseDate(r[10]),
        bizPeriodEnd: parseDate(r[11]),
        bizNoChanged: cleanBool(r[12]),
        clientCompanyId: match?.id ?? null,
        clientName: clientName ?? "(미지정)",
        processedDate: parseDate(r[14]),
        status: cleanStr(r[15]),
        country: cleanStr(r[16]),
        region: cleanStr(r[17]),
      },
    });
    innoCreated++;
  }
  console.log(`   ✓ 혁신 ${innoCreated}건 신규 / 거래처 매칭 ${innoMatched}건`);

  const total = await prisma.trackRecord.count();
  const byType = await prisma.trackRecord.groupBy({ by: ["type"], _count: true });
  const byStatus = await prisma.trackRecord.groupBy({ by: ["status"], _count: true });

  console.log(`\n✅ 완료 · 총 ${total}건`);
  console.log(`   타입별: ${byType.map((t) => `${t.type}=${t._count}`).join(" / ")}`);
  console.log(
    `   상태별 (상위): ${byStatus
      .sort((a, b) => b._count - a._count)
      .slice(0, 6)
      .map((t) => `${t.status ?? "(없음)"}=${t._count}`)
      .join(" / ")}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
