import CardPurchasesClient from "@/components/CardPurchasesClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CardPurchasesPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const year = searchParams.year ?? "";
  const where: any = {};
  if (year) {
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${Number(year) + 1}-01-01`);
    where.approvalDate = { gte: start, lt: end };
  }
  const [items, agg, allDates] = await Promise.all([
    prisma.cardPurchase.findMany({ where, orderBy: { approvalDate: "desc" }, take: 200 }),
    prisma.cardPurchase.aggregate({
      where,
      _sum: { amount: true, supplyAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.cardPurchase.findMany({ select: { approvalDate: true } }),
  ]);
  const years = Array.from(new Set(allDates.map((d) => new Date(d.approvalDate).getFullYear())))
    .filter((y) => y > 2000)
    .sort((a, b) => b - a);

  return (
    <CardPurchasesClient
      initialItems={items.map(serializeProject) as any}
      summary={{
        count: agg._count,
        amount: (agg._sum.amount ?? 0n).toString(),
        supplyAmount: (agg._sum.supplyAmount ?? 0n).toString(),
        taxAmount: (agg._sum.taxAmount ?? 0n).toString(),
      }}
      currentYear={year}
      years={years}
    />
  );
}
