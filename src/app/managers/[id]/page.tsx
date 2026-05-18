import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { serializeProject } from "@/lib/serialize";
import MyLeaveAttendanceWidget from "@/components/MyLeaveAttendanceWidget";
import ProjectsClient from "@/components/ProjectsClient";
import PersonalDashboardClient from "./PersonalDashboardClient";

export const dynamic = "force-dynamic";

// 주(週)의 월~금 범위 (KST). 토/일은 위클리 플래너에서 제외
function getWeekRange(d: Date): { start: Date; end: Date } {
  const day = d.getDay(); // 0=일 ~ 6=토
  // 일요일(0) → 이전주 월요일 기준이 아니라 다음주 월요일? 한국 관습은 월요일 시작.
  //   일요일이면 +1, 그 외는 -(day-1)
  const offset = day === 0 ? 1 : -(day - 1);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 0, 0, 0); // 월
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4, 23, 59, 59); // 금
  return { start, end };
}

export default async function ManagerDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { week?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?from=/managers/${params.id}`);

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      dept: true,
      position: true,
      pmCode: true,
      isInternal: true,
      role: true,
    },
  });
  if (!user) notFound();

  const isOwner = user.id === me.id;
  const isAdmin = me.role === "admin";
  // 본인 또는 admin 만 위클리 플래너 접근. 외 사용자는 프로젝트 리스트만 보임
  const canSeeWeeklyPlanner = isOwner || isAdmin;

  // 기준 주 (week=YYYY-MM-DD 파라미터로 주의 임의 날짜 지정 가능)
  const baseDate = searchParams.week ? new Date(searchParams.week) : new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange(baseDate);

  // 담당 프로젝트 (현재 연도) — ProjectsClient 가 필요한 풀 데이터 로드
  const year = new Date().getFullYear();
  const [projects, companies, allUsers, allYears, customOptions] = await Promise.all([
    prisma.project.findMany({
      where: { managerId: user.id, year },
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
      select: { id: true, name: true, pmCode: true, position: true, isInternal: true, isPM: true },
    }),
    prisma.project.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    prisma.dropdownOption.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
  ]);
  const yearsList = allYears.map((y) => y.year).filter((y) => y > 2000);
  const projectsWithCount = projects.map((p: any) => ({
    ...p,
    historyCount: p._count?.histories ?? 0,
  }));

  // 위클리 플래너 데이터 (본인/admin 만)
  let weeklyTasks: any[] = [];
  if (canSeeWeeklyPlanner) {
    // 오늘 0시 기준
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 본인 대시보드일 때만 — 어제 이전의 '빈 placeholder' 자동 청소
    //   title 이 빈 문자열인 행은 사용자가 입력 안 한 채 남겨둔 흔적이므로 안전 삭제
    if (isOwner) {
      await prisma.weeklyTask.deleteMany({
        where: {
          userId: user.id,
          title: "",
          date: { lt: todayStart },
        },
      });
    }

    const tasks = await prisma.weeklyTask.findMany({
      where: { userId: user.id, date: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    weeklyTasks = tasks.map(serializeProject) as any[];
  }

  // 공용 카테고리 (task_category) — 통합 대시보드의 업무현황과 동일
  const categories = await prisma.dropdownOption.findMany({
    where: { category: "task_category" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, value: true, label: true, color: true },
  });

  return (
    <div className="px-8 py-7 max-w-[1500px] mx-auto">
      <div className="mb-5">
        <Link
          href="/managers"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 담당자별 관리
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-base font-semibold flex items-center justify-center shrink-0">
              {user.name.slice(0, 1)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{user.name} 담당자 대시보드</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {user.dept} · {user.position}
                {user.pmCode && (
                  <span className="ml-2 font-mono text-[10.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {user.pmCode}
                  </span>
                )}
                {isOwner && (
                  <span className="ml-2 text-[10.5px] bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-1.5 py-0.5 rounded">
                    내 대시보드
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-[12px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded">
            {year}년 담당 프로젝트 <strong className="text-slate-800 tabular-nums">{projects.length}</strong>건
          </div>
        </div>
      </div>

      {/* 내 근태/연차 — 본인이 자기 대시보드 볼 때만 표시 (위젯은 viewer 기준) */}
      {isOwner && <MyLeaveAttendanceWidget />}

      <PersonalDashboardClient
        userId={user.id}
        isOwner={isOwner}
        isAdmin={isAdmin}
        canSeeWeeklyPlanner={canSeeWeeklyPlanner}
        weekStartISO={weekStart.toISOString()}
        initialTasks={weeklyTasks}
        projects={[]}
        initialCategories={categories}
      />

      {/* 담당 프로젝트 전체 — /projects?manager=user.id 와 동일한 풀 테이블을 인라인으로 표시 */}
      <div className="mt-6">
        <ProjectsClient
          initialProjects={projectsWithCount.map(serializeProject) as any}
          companies={companies as any}
          users={allUsers as any}
          currentYear={year}
          years={yearsList}
          currentManagerId={user.id}
          selectedManager={{
            id: user.id,
            name: user.name,
            dept: user.dept,
            position: user.position,
            pmCode: user.pmCode,
          } as any}
          customOptions={customOptions as any}
        />
      </div>
    </div>
  );
}
