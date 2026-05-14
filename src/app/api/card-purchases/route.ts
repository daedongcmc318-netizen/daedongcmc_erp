import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
  try { return BigInt(cleaned); } catch { return 0n; }
}
function excelDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "string") {
    const m = raw.match(/(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
    if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const q = searchParams.get("q");

  const where: any = {};
  if (year) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);
    where.approvalDate = { gte: start, lt: end };
  }
  if (q) {
    where.OR = [
      { merchantName: { contains: q } },
      { cardName: { contains: q } },
      { category: { contains: q } },
      { note: { contains: q } },
    ];
  }
  const items = await prisma.cardPurchase.findMany({
    where,
    orderBy: { approvalDate: "desc" },
    take: 500,
  });
  const agg = await prisma.cardPurchase.aggregate({
    where,
    _sum: { amount: true, supplyAmount: true, taxAmount: true },
    _count: true,
  });
  return NextResponse.json({
    items: items.map(serializeProject),
    summary: {
      count: agg._count,
      amount: (agg._sum.amount ?? 0n).toString(),
      supplyAmount: (agg._sum.supplyAmount ?? 0n).toString(),
      taxAmount: (agg._sum.taxAmount ?? 0n).toString(),
    },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (files.length === 0) return NextResponse.json({ error: "files required" }, { status: 400 });

  let parsed = 0;
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filename = (file as any).name || "unknown";
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

      // 헤더 자동 탐지 (첫 5행 안에 '승인일자'가 있는 row를 헤더로)
      let headerIdx = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (rows[i]?.some((c: any) => String(c ?? "").includes("승인일자") || String(c ?? "").includes("거래일자"))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        errors.push(`${filename}: 헤더(승인일자/거래일자) 미발견`);
        continue;
      }
      const header = rows[headerIdx] as any[];
      const idxDate = header.findIndex((h) => String(h ?? "").match(/승인일자|거래일자|이용일자/));
      const idxApprovalNo = header.findIndex((h) => String(h ?? "").includes("승인번호"));
      const idxCardNo = header.findIndex((h) => String(h ?? "").includes("카드번호"));
      const idxCardName = header.findIndex((h) => String(h ?? "").match(/카드명|카드구분/));
      const idxMerchant = header.findIndex((h) => String(h ?? "").match(/가맹점|상호/));
      const idxCategory = header.findIndex((h) => String(h ?? "").match(/업종|카테고리/));
      const idxAmount = header.findIndex((h) => String(h ?? "").match(/^금액|총액|결제금액|청구금액/));
      const idxSupply = header.findIndex((h) => String(h ?? "").includes("공급가액"));
      const idxTax = header.findIndex((h) => String(h ?? "").includes("세액"));
      const idxInst = header.findIndex((h) => String(h ?? "").includes("할부"));
      const idxNote = header.findIndex((h) => String(h ?? "").match(/비고|메모/));

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0) continue;
        const dt = idxDate >= 0 ? excelDate(r[idxDate]) : null;
        if (!dt) continue;
        const merchant = idxMerchant >= 0 ? toStr(r[idxMerchant]) : null;
        if (!merchant) continue;

        const approvalNo = idxApprovalNo >= 0 ? toStr(r[idxApprovalNo]) : null;
        const data: any = {
          approvalDate: dt,
          merchantName: merchant,
          approvalNo,
          cardNo: idxCardNo >= 0 ? toStr(r[idxCardNo]) : null,
          cardName: idxCardName >= 0 ? toStr(r[idxCardName]) : null,
          category: idxCategory >= 0 ? toStr(r[idxCategory]) : null,
          amount: idxAmount >= 0 ? toBigInt(r[idxAmount]) : 0n,
          supplyAmount: idxSupply >= 0 ? toBigInt(r[idxSupply]) : 0n,
          taxAmount: idxTax >= 0 ? toBigInt(r[idxTax]) : 0n,
          installment: idxInst >= 0 ? toStr(r[idxInst]) : null,
          note: idxNote >= 0 ? toStr(r[idxNote]) : null,
          sourceFile: filename,
        };

        try {
          if (approvalNo) {
            const exists = await prisma.cardPurchase.findUnique({
              where: { approvalNo },
              select: { id: true },
            });
            if (exists) {
              await prisma.cardPurchase.update({ where: { approvalNo }, data });
              updated++;
            } else {
              await prisma.cardPurchase.create({ data });
              created++;
            }
          } else {
            await prisma.cardPurchase.create({ data });
            created++;
          }
        } catch {
          // skip
        }
        parsed++;
      }
    } catch (e: any) {
      errors.push(`${filename}: ${e.message ?? String(e)}`);
    }
  }
  revalidatePath("/card-purchases");
  return NextResponse.json({ parsed, created, updated, errors });
}
