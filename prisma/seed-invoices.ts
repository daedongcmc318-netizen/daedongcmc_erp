/*
 * 전자세금계산서 일괄 시드 — '세금계산서 DB/' 폴더 내 매입/매출 .xls 전체 적재
 * 멱등성: 승인번호(approvalNo)로 upsert
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const BASE = path.join(__dirname, "..", "..", "세금계산서 DB");
const SALES_DIR = path.join(BASE, "09.(주)대동CMC_매출세금계산서목록_'18~'22");
const PURCHASE_DIR = path.join(BASE, "08.(주)대동CMC_매입세금계산서목록_'18~'22");
const OUR_BIZ_NO = "8298801029";

function normBizNo(raw: any): string {
  if (raw == null) return "";
  return String(raw).replace(/[^\d]/g, "");
}
function toStr(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}
function toBigInt(raw: any): bigint {
  if (raw == null) return 0n;
  if (typeof raw === "number") return BigInt(Math.round(raw));
  const cleaned = String(raw).replace(/[^\d-]/g, "");
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

async function processFile(filePath: string, defaultType: "sales" | "purchase") {
  const filename = path.basename(filePath);
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch (e: any) {
    console.log(`✗ ${filename}: 읽기 실패 — ${e.message}`);
    return { parsed: 0, upserted: 0 };
  }
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  } catch (e: any) {
    console.log(`✗ ${filename}: 파싱 실패 — ${e.message}`);
    return { parsed: 0, upserted: 0 };
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { parsed: 0, upserted: 0 };
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  const header = (rows[5] ?? []) as any[];
  // 품목 컬럼들은 파일에 따라 25 또는 27부터 시작 (구버전 매출 파일엔 '수탁사업자등록번호', '상호' 추가 컬럼이 있음)
  // 헤더 이름으로 인덱스를 찾는다
  const idxItemDate = header.indexOf("품목일자");
  const idxItemName = header.indexOf("품목명");
  const idxItemSpec = header.indexOf("품목규격");
  const idxItemQty = header.indexOf("품목수량");
  const idxItemUnit = header.indexOf("품목단가");
  const idxItemNote = header.indexOf("품목비고");

  let parsed = 0;
  let upserted = 0;
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const approvalNo = toStr(r[1]);
    if (!approvalNo) continue;
    const writeDate = excelDate(r[0]);
    if (!writeDate) continue;
    const supplierBizNo = normBizNo(r[4]);
    const buyerBizNo = normBizNo(r[9]);
    let type: "sales" | "purchase" = defaultType;
    if (supplierBizNo === OUR_BIZ_NO) type = "sales";
    else if (buyerBizNo === OUR_BIZ_NO) type = "purchase";

    const data: any = {
      type,
      approvalNo,
      writeDate,
      issueDate: excelDate(r[2]),
      sendDate: excelDate(r[3]),
      supplierBizNo,
      supplierSubNo: toStr(r[5]),
      supplierName: toStr(r[6]) ?? "(미상)",
      supplierRep: toStr(r[7]),
      supplierAddr: toStr(r[8]),
      buyerBizNo,
      buyerSubNo: toStr(r[10]),
      buyerName: toStr(r[11]) ?? "(미상)",
      buyerRep: toStr(r[12]),
      buyerAddr: toStr(r[13]),
      totalAmount: toBigInt(r[14]),
      supplyAmount: toBigInt(r[15]),
      taxAmount: toBigInt(r[16]),
      category: toStr(r[17]),
      invoiceKind: toStr(r[18]),
      issueType: toStr(r[19]),
      note: toStr(r[20]),
      paymentType: toStr(r[21]),
      supplierEmail: toStr(r[22]),
      buyerEmail: toStr(r[23]),
      buyerEmail2: toStr(r[24]),
      itemDate: idxItemDate >= 0 ? excelDate(r[idxItemDate]) : null,
      itemName: idxItemName >= 0 ? toStr(r[idxItemName]) : null,
      itemSpec: idxItemSpec >= 0 ? toStr(r[idxItemSpec]) : null,
      itemQty: idxItemQty >= 0 ? toStr(r[idxItemQty]) : null,
      itemUnitPrice: idxItemUnit >= 0 ? toStr(r[idxItemUnit]) : null,
      itemNote: idxItemNote >= 0 ? toStr(r[idxItemNote]) : null,
      sourceFile: filename,
    };

    try {
      await prisma.electronicTaxInvoice.upsert({
        where: { approvalNo },
        update: data,
        create: data,
      });
      upserted++;
    } catch {
      // 중복 키 등 무시
    }
    parsed++;
  }
  return { parsed, upserted };
}

async function main() {
  // 디렉토리 최상위 .xls만 (하위 폴더는 중복 위험 있어 제외)
  const salesFiles = fs.readdirSync(SALES_DIR).filter((f) => /^\d{4}[\s_].*매출전자세금계산서.*\.xls$/i.test(f));
  const purchaseFiles = fs.readdirSync(PURCHASE_DIR).filter((f) => /^\d{4}[\s_].*매입전자세금계산서.*\.xls$/i.test(f));

  let totalParsed = 0;
  let totalUpserted = 0;

  console.log(`\n📁 매출 ${salesFiles.length}개 파일`);
  for (const f of salesFiles) {
    const { parsed, upserted } = await processFile(path.join(SALES_DIR, f), "sales");
    totalParsed += parsed;
    totalUpserted += upserted;
    console.log(`  ✓ ${f} — 파싱 ${parsed} / 적재 ${upserted}`);
  }

  console.log(`\n📁 매입 ${purchaseFiles.length}개 파일`);
  for (const f of purchaseFiles) {
    const { parsed, upserted } = await processFile(path.join(PURCHASE_DIR, f), "purchase");
    totalParsed += parsed;
    totalUpserted += upserted;
    console.log(`  ✓ ${f} — 파싱 ${parsed} / 적재 ${upserted}`);
  }

  // 최종 통계
  const total = await prisma.electronicTaxInvoice.count();
  const salesAgg = await prisma.electronicTaxInvoice.aggregate({
    where: { type: "sales" },
    _sum: { totalAmount: true, supplyAmount: true },
    _count: true,
  });
  const purchaseAgg = await prisma.electronicTaxInvoice.aggregate({
    where: { type: "purchase" },
    _sum: { totalAmount: true, supplyAmount: true },
    _count: true,
  });

  console.log(`\n📊 전체 — 파싱 ${totalParsed} / 적재 ${totalUpserted}`);
  console.log(`📊 DB 총 ${total}건`);
  console.log(
    `   매출 ${salesAgg._count}건 / 합계 ₩${(salesAgg._sum.totalAmount ?? 0n).toString()}`
  );
  console.log(
    `   매입 ${purchaseAgg._count}건 / 합계 ₩${(purchaseAgg._sum.totalAmount ?? 0n).toString()}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
