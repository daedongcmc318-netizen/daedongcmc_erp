import InvoicesClient from "@/components/InvoicesClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 200;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { type?: string; year?: string };
}) {
  const type = searchParams.type ?? "sales";
  const year = searchParams.year ?? "";
  const where: any = { type };
  if (year) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);
    where.writeDate = { gte: start, lt: end };
  }
  const [items, agg, allDates] = await Promise.all([
    prisma.electronicTaxInvoice.findMany({
      where,
      orderBy: { writeDate: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.electronicTaxInvoice.aggregate({
      where,
      _sum: { totalAmount: true, supplyAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.electronicTaxInvoice.findMany({ select: { writeDate: true } }),
  ]);
  const allYears = Array.from(
    new Set(allDates.map((d) => new Date(d.writeDate).getFullYear()))
  )
    .filter((y) => y > 2000)
    .sort((a, b) => b - a);

  // 요약 카드도 연도 필터에 맞춰 집계 (type 필터는 제외 → 매출/매입 양쪽 모두 보여줌)
  const summaryWhere: any = {};
  if (year) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);
    summaryWhere.writeDate = { gte: start, lt: end };
  }
  const totalsByType = await prisma.electronicTaxInvoice.groupBy({
    by: ["type"],
    where: summaryWhere,
    _sum: { totalAmount: true, supplyAmount: true, taxAmount: true },
    _count: true,
  });

  return (
    <InvoicesClient
      initialItems={items.map(serializeProject) as any}
      initialSummary={{
        count: agg._count,
        totalAmount: (agg._sum.totalAmount ?? 0n).toString(),
        supplyAmount: (agg._sum.supplyAmount ?? 0n).toString(),
        taxAmount: (agg._sum.taxAmount ?? 0n).toString(),
      }}
      totalsByType={totalsByType.map((t) => ({
        type: t.type,
        count: t._count,
        totalAmount: (t._sum.totalAmount ?? 0n).toString(),
        supplyAmount: (t._sum.supplyAmount ?? 0n).toString(),
        taxAmount: (t._sum.taxAmount ?? 0n).toString(),
      }))}
      currentType={type as "sales" | "purchase"}
      currentYear={year}
      years={allYears}
    />
  );
}
