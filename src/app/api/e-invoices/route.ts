import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 대동CMC 사업자번호 — 매출/매입 자동 판정용
const OUR_BIZ_NO = "8298801029"; // 829-88-01029 → 숫자만

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

// ─── GET: 조회 ───
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // sales / purchase
  const year = searchParams.get("year");
  const q = searchParams.get("q");

  const where: any = {};
  if (type) where.type = type;
  if (year) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);
    where.writeDate = { gte: start, lt: end };
  }
  if (q) {
    where.OR = [
      { supplierName: { contains: q } },
      { buyerName: { contains: q } },
      { itemName: { contains: q } },
      { approvalNo: { contains: q } },
      { supplierBizNo: { contains: q.replace(/[^\d]/g, "") } },
      { buyerBizNo: { contains: q.replace(/[^\d]/g, "") } },
      { note: { contains: q } },
    ];
  }

  const items = await prisma.electronicTaxInvoice.findMany({
    where,
    orderBy: { writeDate: "desc" },
    take: 2000, // 안전 상한
  });

  // 요약
  const agg = await prisma.electronicTaxInvoice.aggregate({
    where,
    _sum: { totalAmount: true, supplyAmount: true, taxAmount: true },
    _count: true,
  });

  return NextResponse.json({
    items: items.map(serializeProject),
    summary: {
      count: agg._count,
      totalAmount: agg._sum.totalAmount?.toString() ?? "0",
      supplyAmount: agg._sum.supplyAmount?.toString() ?? "0",
      taxAmount: agg._sum.taxAmount?.toString() ?? "0",
    },
  });
}

// ─── POST: 엑셀 업로드 ───
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "files required" }, { status: 400 });
  }

  let parsed = 0;
  let upserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filename = (file as any).name || "unknown";
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        errors.push(`${filename}: 시트 없음`);
        continue;
      }
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
      const header = (rows[5] ?? []) as any[];
      // 품목 컬럼은 파일 버전에 따라 위치가 달라(구버전 매출엔 수탁사업자 칼럼 끼어있음) — 헤더 이름으로 인덱스 추출
      const idxItemDate = header.indexOf("품목일자");
      const idxItemName = header.indexOf("품목명");
      const idxItemSpec = header.indexOf("품목규격");
      const idxItemQty = header.indexOf("품목수량");
      const idxItemUnit = header.indexOf("품목단가");
      const idxItemNote = header.indexOf("품목비고");

      // 파일명으로 1차 판정
      const fnameLower = filename.toLowerCase();
      let defaultType: "sales" | "purchase" =
        filename.includes("매출") || fnameLower.includes("sales")
          ? "sales"
          : filename.includes("매입") || fnameLower.includes("purchase")
            ? "purchase"
            : "sales";

      // row 5가 헤더, row 6+ 데이터
      for (let i = 6; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;
        const approvalNo = toStr(r[1]);
        if (!approvalNo) continue;
        const writeDate = excelDate(r[0]);
        if (!writeDate) continue;

        const supplierBizNo = normBizNo(r[4]);
        const buyerBizNo = normBizNo(r[9]);
        // 내용 기반 보정: 공급자가 우리면 매출, 공급받는자가 우리면 매입
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
        } catch (e: any) {
          skipped++;
        }
        parsed++;
      }
    } catch (e: any) {
      errors.push(`${filename}: ${e.message ?? String(e)}`);
    }
  }

  revalidatePath("/invoices");
  return NextResponse.json({ parsed, upserted, skipped, errors });
}
