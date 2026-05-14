import ProjectsClient from "@/components/ProjectsClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { year?: string; manager?: string };
}) {
  // 연도별 데이터 분리: URL 파라미터 우선, 없으면 현재 연도
  const currentYear = new Date().getFullYear();
  const year = searchParams.year ? Number(searchParams.year) : currentYear;
  const managerId = searchParams.manager?.trim() || null;

  const where: any = { year };
  if (managerId) where.managerId = managerId;

  // 선택된 담당자 정보 (헤더 표시용)
  const selectedManager = managerId
    ? await prisma.user.findUnique({
        where: { id: managerId },
        select: { id: true, name: true, dept: true, position: true, pmCode: true },
      })
    : null;

  const [projects, companies, users, allYears, customOptions] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        company: { include: { contacts: { take: 1, orderBy: { isPrimary: "desc" } } } },
        agency: true,
        manager: true,
        taxInvoices: { orderBy: { createdAt: "asc" } },
        deliverables: { orderBy: { seq: "asc" } },
        _count: { select: { histories: true } },
      },
      orderBy: [{ source: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, pmCode: true, position: true, isInternal: true },
    }),
    // DB에 존재하는 모든 연도 (버튼 표시용)
    prisma.project.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    // 사용자가 추가한 드롭다운 옵션들
    prisma.dropdownOption.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const years = allYears.map((y) => y.year).filter((y) => y > 2000);

  // _count.histories → historyCount 평탄화
  const projectsWithCount = projects.map((p: any) => ({
    ...p,
    historyCount: p._count?.histories ?? 0,
  }));

  return (
    <ProjectsClient
      initialProjects={projectsWithCount.map(serializeProject) as any}
      companies={companies as any}
      users={users as any}
      currentYear={year}
      years={years}
      currentManagerId={managerId}
      selectedManager={selectedManager as any}
      customOptions={customOptions as any}
    />
  );
}
