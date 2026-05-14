import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET ?q=...&amount=...&date=...&limit=30
 *   세금계산서 검색 (실적관리 picker용)
 *   - q: supplierName/buyerName/bizNo/approvalNo 일부 매칭
 *   - amount: ±2% 범위 + totalAmount, supplyAmount 둘 다 검사
 *   - date: writeDate 기준 ±90일 우선 정렬
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const amountStr = url.searchParams.get("amount");
  const dateStr = url.searchParams.get("date");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);

  const where: any = {};
  if (q) {
    where.OR = [
      { supplierName: { contains: q, mode: "insensitive" } },
      { buyerName: { contains: q, mode: "insensitive" } },
      { supplierBizNo: { contains: q } },
      { buyerBizNo: { contains: q } },
      { approvalNo: { contains: q } },
      { itemName: { contains: q, mode: "insensitive" } },
    ];
  }

  // 금액 범위 (옵션, ±2%)
  if (amountStr) {
    const amount = BigInt(amountStr);
    if (amount > BigInt(0)) {
      const low = (amount * BigInt(98)) / BigInt(100);
      const high = (amount * BigInt(102)) / BigInt(100);
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { totalAmount: { gte: low, lte: high } },
            { supplyAmount: { gte: low, lte: high } },
          ],
        },
      ];
    }
  }

  const items = await prisma.electronicTaxInvoice.findMany({
    where,
    select: {
      id: true,
      type: true,
      approvalNo: true,
      writeDate: true,
      issueDate: true,
      supplierName: true,
      supplierBizNo: true,
      buyerName: true,
      buyerBizNo: true,
      totalAmount: true,
      supplyAmount: true,
      itemName: true,
    },
    orderBy: { writeDate: "desc" },
    take: limit,
  });

  // 날짜 근접도 기준으로 재정렬 (옵션)
  let sorted = items;
  if (dateStr) {
    const refDate = new Date(dateStr);
    if (!isNaN(refDate.getTime())) {
      sorted = items
        .map((it) => ({
          it,
          dist: Math.abs((new Date(it.writeDate).getTime() - refDate.getTime()) / 86400000),
        }))
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.it);
    }
  }

  return NextResponse.json(sorted.map(serializeProject));
}
