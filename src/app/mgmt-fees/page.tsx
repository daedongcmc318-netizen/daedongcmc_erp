import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import MgmtFeesClient from "@/components/MgmtFeesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MgmtFeesPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/mgmt-fees");
  if (me.role !== "admin") {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">
          업체별 관리비는 관리자(admin) 권한 사용자만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  const years = await prisma.mgmtFeeBudget.groupBy({ by: ["year"], _count: true });
  const yearList = years.map((y) => y.year).sort((a, b) => b - a);
  const currentYear = searchParams.year ? Number(searchParams.year) : yearList[0] ?? new Date().getFullYear();

  const budgets = await prisma.mgmtFeeBudget.findMany({
    where: { year: currentYear },
    include: {
      clientCompany: { select: { id: true, name: true, repName: true } },
      project: { select: { id: true, title: true, displayCode: true, year: true } },
      expenses: { include: { vendorCompany: { select: { id: true, name: true } } }, orderBy: { seq: "asc" } },
    },
    orderBy: [{ bizCategory: "asc" }, { seq: "asc" }],
  });

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const projects = await prisma.project.findMany({
    where: { year: currentYear },
    select: { id: true, title: true, displayCode: true, year: true, companyId: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <MgmtFeesClient
      initialBudgets={budgets.map(serializeProject) as any}
      companies={companies}
      projects={projects}
      years={yearList}
      currentYear={currentYear}
    />
  );
}
