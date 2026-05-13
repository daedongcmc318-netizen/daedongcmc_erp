import CompaniesClient from "@/components/CompaniesClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OUR_BIZ = "8298801029";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      contacts: { take: 1, orderBy: { isPrimary: "desc" } },
      _count: { select: { clientProjects: true, agencyProjects: true } },
    },
  });

  // 거래처별 세금계산서 건수 매핑 (사업자번호 매칭)
  // 한 번에 모든 거래처의 카운트를 효율적으로 가져오기 위해 invoice를 한 번만 스캔하고 집계
  const invoices = await prisma.electronicTaxInvoice.findMany({
    select: { supplierBizNo: true, buyerBizNo: true },
  });
  const invByBiz = new Map<string, number>();
  for (const inv of invoices) {
    const otherBiz = inv.supplierBizNo === OUR_BIZ ? inv.buyerBizNo : inv.supplierBizNo;
    if (!otherBiz) continue;
    invByBiz.set(otherBiz, (invByBiz.get(otherBiz) ?? 0) + 1);
  }

  const enriched = companies.map((c) => {
    const bizNo = (c.bizNo ?? "").replace(/[^\d]/g, "");
    const invoiceCount = bizNo && !c.bizNo?.startsWith("temp-") ? invByBiz.get(bizNo) ?? 0 : 0;
    return { ...c, invoiceCount };
  });

  return <CompaniesClient initialCompanies={enriched.map(serializeProject) as any} />;
}
