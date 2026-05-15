import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Users, FolderKanban, Activity, Search } from "lucide-react";
import { getStatusMeta, BIZ_CATEGORY, getBizMeta } from "@/lib/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManagersPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const currentYear = new Date().getFullYear();
  const year = searchParams.year ? Number(searchParams.year) : currentYear;

  // 연도 + 매니저별 집계
  const grouped = await prisma.project.groupBy({
    by: ["managerId"],
    where: { year, managerId: { not: null } },
    _count: true,
  });

  // 매니저 카드 대상자
  //   1) 올해 프로젝트가 있는 매니저
  //   2) 내부직원(isInternal) 인 활성 직원 — 프로젝트가 없어도 본인 대시보드(주간 플래너) 사용 위해 노출
  const projectManagerIds = grouped.map((g) => g.managerId!).filter(Boolean);
  const allCandidates = await prisma.user.findMany({
    where: {
      status: "active",
      OR: [
        { id: { in: projectManagerIds } },
        { isInternal: true },
      ],
    },
    select: { id: true, name: true, dept: true, position: true, pmCode: true, status: true },
  });
  const mMap = new Map(allCandidates.map((m) => [m.id, m]));

  // 추가 정보 (진행중 / 사업영역별)
  const inProgressGroups = await prisma.project.groupBy({
    by: ["managerId"],
    where: { year, managerId: { not: null }, status: "in_progress" },
    _count: true,
  });
  const inProgressMap = new Map(inProgressGroups.map((g) => [g.managerId!, g._count]));

  const bizGroups = await prisma.project.groupBy({
    by: ["managerId", "bizCategory"],
    where: { year, managerId: { not: null } },
    _count: true,
  });
  const bizMap = new Map<string, Map<string, number>>();
  for (const g of bizGroups) {
    if (!bizMap.has(g.managerId!)) bizMap.set(g.managerId!, new Map());
    bizMap.get(g.managerId!)!.set(g.bizCategory, g._count);
  }

  // 연도 옵션
  const allYears = await prisma.project.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });

  // 카드 = (프로젝트 매니저) ∪ (내부직원 with no projects this year)
  const projectIdSet = new Set(projectManagerIds);
  const cards: {
    manager: typeof allCandidates[0];
    total: number;
    inProg: number;
    biz: Map<string, number>;
  }[] = [];
  for (const g of grouped) {
    const m = mMap.get(g.managerId!);
    if (!m) continue;
    cards.push({
      manager: m,
      total: g._count,
      inProg: inProgressMap.get(g.managerId!) ?? 0,
      biz: bizMap.get(g.managerId!) ?? new Map(),
    });
  }
  // 프로젝트 없는 내부직원 추가
  for (const m of allCandidates) {
    if (projectIdSet.has(m.id)) continue;
    cards.push({ manager: m, total: 0, inProg: 0, biz: new Map() });
  }
  cards.sort((a, b) => b.total - a.total || a.manager.name.localeCompare(b.manager.name));

  const totalProjects = cards.reduce((s, c) => s + c.total, 0);

  return (
    <div className="px-8 py-7 max-w-[1500px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500 font-medium tracking-wide">담당자별 관리</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">담당자 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            {year}년 · 담당자 {cards.length}명 · 총 {totalProjects}건
          </p>
        </div>
        {/* 연도 버튼 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {allYears.map((y) => (
            <Link
              key={y.year}
              href={`/managers?year=${y.year}`}
              className={`min-w-[60px] px-3 h-8 text-xs font-semibold rounded-lg border transition-all tabular-nums inline-flex items-center justify-center ${
                year === y.year
                  ? "bg-brand-600 text-white border-brand-600 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {y.year}년
            </Link>
          ))}
        </div>
      </div>

      {/* 담당자 카드 그리드 */}
      {cards.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-sm">
          {year}년에 담당자가 지정된 프로젝트가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link
              key={c.manager.id}
              href={`/managers/${c.manager.id}`}
              className="group bg-white rounded-2xl border border-slate-200/70 shadow-card hover:shadow-lg hover:border-brand-300 hover:-translate-y-0.5 transition p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                    {c.manager.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-800">{c.manager.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {c.manager.dept} · {c.manager.position}
                      {c.manager.pmCode && (
                        <span className="ml-1.5 font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                          {c.manager.pmCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat icon={<FolderKanban className="w-3 h-3" />} label="총 프로젝트" value={`${c.total}건`} color="brand" />
                <Stat icon={<Activity className="w-3 h-3" />} label="진행중" value={`${c.inProg}건`} color="emerald" />
              </div>

              {/* 사업영역 분포 막대 */}
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mb-2">
                {BIZ_CATEGORY.map((b) => {
                  const cnt = c.biz.get(b.value) ?? 0;
                  if (cnt === 0) return null;
                  return (
                    <div
                      key={b.value}
                      style={{ width: `${(cnt / c.total) * 100}%` }}
                      className={b.color.split(" ")[0].replace("bg-", "bg-")}
                      title={`${b.label}: ${cnt}건`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                {BIZ_CATEGORY.map((b) => {
                  const cnt = c.biz.get(b.value) ?? 0;
                  if (cnt === 0) return null;
                  return (
                    <span key={b.value} className="inline-flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-sm ${b.color.split(" ")[0]}`} />
                      {b.label} {cnt}
                    </span>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-brand-600 inline-flex items-center gap-1 font-medium">
                <Search className="w-3 h-3" /> 담당자 대시보드 열기
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "brand" | "emerald";
}) {
  const palette = {
    brand: { bg: "bg-brand-50", text: "text-brand-700" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  }[color];
  return (
    <div className={`rounded-lg ${palette.bg} px-2.5 py-1.5`}>
      <div className={`text-[9.5px] uppercase tracking-wider font-semibold ${palette.text} flex items-center gap-0.5`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-sm font-bold tabular-nums ${palette.text} mt-0.5`}>{value}</div>
    </div>
  );
}
