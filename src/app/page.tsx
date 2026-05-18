import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BIZ_CATEGORY, getBizMeta, getStatusMeta, SERVICE_TYPE, getServiceLabel } from "@/lib/enums";
import {
  ArrowRight,
  FolderKanban,
  Building2,
  TrendingUp,
  Calendar,
  Sparkles,
  FileText,
  Target,
} from "lucide-react";
import Donut from "@/components/dashboard/Donut";
import UpcomingReportsClient from "@/components/dashboard/UpcomingReportsClient";
import InternalStaffWidget from "@/components/InternalStaffWidget";
import MajorTasksWidget from "@/components/MajorTasksWidget";
import clsx from "clsx";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 매출 목표 — 추후 settings 테이블로 분리 가능
const REVENUE_TARGET = 5_000_000_000;

const BIZ_HEX: Record<string, string> = {
  innovation: "#3f63f5",
  export: "#06b6d4",
  contract: "#8b5cf6",
  certification: "#10b981",
  rental: "#f59e0b",
};

const PIPELINE = [
  "request_received",
  "contract_pending",
  "cost_audit",
  "in_progress",
  "mid_completed",
  "review_pending",
  "settlement_request",
  "settlement_done",
  "payment_done",
] as const;

const PIPELINE_HEX: Record<string, string> = {
  request_received: "#94a3b8",
  contract_pending: "#f59e0b",
  cost_audit: "#fb923c",
  in_progress: "#3f63f5",
  mid_completed: "#0ea5e9",
  review_pending: "#6366f1",
  settlement_request: "#a855f7",
  settlement_done: "#10b981",
  payment_done: "#059669",
};

async function getDashboardData() {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00`);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekLater = new Date(today);
  weekLater.setDate(weekLater.getDate() + 7);

  // 2026년 매출 기준 = project.year=2026 OR 2026년에 세금계산서 발행된 프로젝트
  const yearScopedWhere = {
    OR: [
      { year },
      { taxInvoices: { some: { issueDate: { gte: yearStart, lt: yearEnd } } } },
    ],
  };

  const [
    projectCount,
    statusGroups,
    bizGroups,
    discoveryConfirmed,
    nurtureRevenue,
    invoicesThisYear,
    managerGroups,
    dueProjects,
    dueThisMonth,
    inProgressTotal,
  ] = await Promise.all([
    prisma.project.count({ where: { year } }),
    // 진행현황 파이프라인은 '육성'만 집계 (발굴은 별도 카운트로 앞에 붙임)
    prisma.project.groupBy({ by: ["status"], where: { year, source: "nurture" }, _count: true }),
    prisma.project.groupBy({ by: ["bizCategory"], where: { year }, _count: true }),
    // 발굴 확정 매출
    prisma.project.aggregate({
      where: { source: "discovery", confirmedYn: true, ...yearScopedWhere },
      _sum: { confirmedRevenue: true },
      _count: true,
    }),
    // 육성 매출현황 (전체)
    prisma.project.aggregate({
      where: { source: "nurture", ...yearScopedWhere },
      _sum: { confirmedRevenue: true },
      _count: true,
    }),
    // 2026년 세금계산서 발행 내역
    prisma.taxInvoice.findMany({
      where: {
        issuedYn: true,
        issueDate: { gte: yearStart, lt: yearEnd },
      },
      select: { amount: true, issueDate: true, paymentDoneYn: true },
    }),
    // 담당자별 카운트 (진행중 vs 완료) — finalReportYn 체크 여부로 분류
    prisma.project.groupBy({
      by: ["managerId", "finalReportYn"],
      where: { year, managerId: { not: null } },
      _count: true,
    }),
    // 월별 마감현황: 육성 프로젝트 중 완료보고 미완료 + 의미있는 서비스 타입만
    //   제외: 인증(certification), 임대(rental), 비용정산(cost_settlement), 서비스없음(null)
    prisma.project.findMany({
      where: {
        year,
        source: "nurture",
        finalReportYn: false,
        serviceType: { notIn: ["certification", "rental", "cost_settlement"], not: null },
      },
      select: { finalReportDate: true, serviceType: true, finalReportYn: true, title: true, displayCode: true },
    }),
    // 이번달 마감 예정 = 종료일자가 이번달에 속한 건 (이미 지난 일자 포함, 완료보고 미완료만)
    prisma.project.count({
      where: { year, endDate: { gte: monthStart, lte: monthEnd }, finalReportYn: false },
    }),
    // 전체 진행중 = 완료보고(finalReportYn) 체크되기 전 모든 프로젝트
    prisma.project.count({
      where: { year, finalReportYn: false },
    }),
  ]);

  // 1주 이내 중간/완료 보고 마감 예정 (완료 포함 — D-day 옆에 '완료' 뱃지 표시)
  const upcomingMid = await prisma.project.findMany({
    where: { midReportDate: { gte: today, lte: weekLater } },
    include: { manager: { select: { name: true, pmCode: true } } },
    orderBy: { midReportDate: "asc" },
  });
  const upcomingFinal = await prisma.project.findMany({
    where: { finalReportDate: { gte: today, lte: weekLater } },
    include: { manager: { select: { name: true, pmCode: true } } },
    orderBy: { finalReportDate: "asc" },
  });
  const upcomingReports = [
    ...upcomingMid.map((p) => ({
      kind: "mid" as const,
      project: p,
      date: p.midReportDate!,
      done: p.midReportYn,
    })),
    ...upcomingFinal.map((p) => ({
      kind: "final" as const,
      project: p,
      date: p.finalReportDate!,
      done: p.finalReportYn,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const inProgressCompanies = await prisma.project.findMany({
    where: { year, status: "in_progress", companyId: { not: null } },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  const managerIds = Array.from(new Set(managerGroups.map((g) => g.managerId!).filter(Boolean)));
  const managers = await prisma.user.findMany({
    where: { id: { in: managerIds } },
    select: { id: true, name: true, pmCode: true, position: true, dept: true },
  });
  const managerMap = new Map(managers.map((m) => [m.id, m]));

  // 진행중 = 완료보고(finalReportYn) 체크되기 전 모든 단계 / 완료 = finalReportYn 체크됨
  const managerSummary = new Map<
    string,
    { total: number; inProgress: number; done: number; manager: typeof managers[0] }
  >();
  for (const g of managerGroups) {
    const m = managerMap.get(g.managerId!);
    if (!m) continue;
    if (!managerSummary.has(m.id))
      managerSummary.set(m.id, { total: 0, inProgress: 0, done: 0, manager: m });
    const s = managerSummary.get(m.id)!;
    s.total += g._count;
    if (g.finalReportYn) s.done += g._count;
    else s.inProgress += g._count;
  }

  // 매출 집계
  const discoveryConfirmedRevenue = Number(discoveryConfirmed._sum.confirmedRevenue ?? 0);
  const nurtureTotalRevenue = Number(nurtureRevenue._sum.confirmedRevenue ?? 0);
  const finalConfirmedRevenue = discoveryConfirmedRevenue + nurtureTotalRevenue;

  const invoiceTotal = invoicesThisYear.reduce((acc, t) => acc + Number(t.amount), 0);
  const invoicePaid = invoicesThisYear.filter((t) => t.paymentDoneYn).reduce((acc, t) => acc + Number(t.amount), 0);

  // 월별 매출
  const monthlyInvoice = Array.from({ length: 12 }, () => 0);
  for (const inv of invoicesThisYear) {
    if (!inv.issueDate) continue;
    const m = new Date(inv.issueDate).getMonth();
    monthlyInvoice[m] += Number(inv.amount);
  }

  return {
    year,
    projectCount,
    statusGroups,
    bizGroups,
    managerSummary: Array.from(managerSummary.values()).sort((a, b) => b.total - a.total),
    inProgressCompanyCount: inProgressCompanies.length,
    finalConfirmedRevenue,
    discoveryConfirmedRevenue,
    discoveryCount: discoveryConfirmed._count,
    nurtureTotalRevenue,
    nurtureCount: nurtureRevenue._count,
    invoiceTotal,
    invoicePaid,
    monthlyInvoice,
    dueProjects,
    dueThisMonth,
    inProgressTotal,
    upcomingReports,
    todayMs: today.getTime(),
  };
}

function formatWon(n: number): string {
  return `₩${n.toLocaleString()}`;
}

function formatWonShort(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return n.toLocaleString();
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const today = new Date();
  const dateLabel = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const bizDonut = BIZ_CATEGORY.map((b) => ({
    key: b.value,
    label: b.label,
    value: data.bizGroups.find((g) => g.bizCategory === b.value)?._count ?? 0,
    color: BIZ_HEX[b.value] ?? "#94a3b8",
  }));

  const targetPct = Math.min(100, (data.finalConfirmedRevenue / REVENUE_TARGET) * 100);
  const invoicePct = Math.min(100, (data.invoiceTotal / REVENUE_TARGET) * 100);

  return (
    <div className="px-8 py-7 max-w-[1500px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500 font-medium tracking-wide">
              {dateLabel} {weekdays[today.getDay()]}요일
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.year}년 사업 진행 현황 · 프로젝트 {data.projectCount}건 · 진행 {data.inProgressTotal}건
          </p>
        </div>
        <Link
          href="/projects"
          className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
        >
          프로젝트 관리로 이동 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 매출 하이라이트 + 사무실 근무현황 (2단 레이아웃) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* 왼쪽: 매출 하이라이트 */}
        <div className="rounded-2xl shadow-card relative overflow-hidden text-white p-5 bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -right-4 -bottom-16 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-white/80" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-white/80">
                {data.year}년 최종확정매출
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold tabular-nums tracking-tight">
                {formatWon(data.finalConfirmedRevenue)}
              </span>
              <span className="text-xs text-white/70">/ {formatWon(REVENUE_TARGET)}</span>
            </div>
            <div className="text-[11px] text-white/80 mb-2">
              목표 대비 <span className="font-semibold text-white">{targetPct.toFixed(1)}%</span> · 잔여{" "}
              {formatWonShort(Math.max(0, REVENUE_TARGET - data.finalConfirmedRevenue))}
            </div>
            <div className="h-2 bg-white/15 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-amber-100"
                style={{ width: `${targetPct}%` }}
              />
              <div
                className="absolute top-0 h-full bg-white/40"
                style={{ left: `${invoicePct}%`, width: "2px" }}
                title={`세금계산서 발행: ${invoicePct.toFixed(1)}%`}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/70 mb-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-1 rounded-sm bg-gradient-to-r from-amber-300 to-amber-100" /> 확정매출
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-0.5 h-2 bg-white/70" /> 발행시점
              </span>
            </div>

            {/* 발굴 vs 육성 breakdown */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/15">
              <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2">
                <div className="text-[9.5px] text-white/70 uppercase tracking-wider font-semibold">발굴 확정</div>
                <div className="mt-0.5 text-base font-bold tabular-nums">
                  {formatWonShort(data.discoveryConfirmedRevenue)}
                </div>
                <div className="text-[9px] text-white/60">{data.discoveryCount}건</div>
              </div>
              <div className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2">
                <div className="text-[9.5px] text-white/70 uppercase tracking-wider font-semibold">육성 매출</div>
                <div className="mt-0.5 text-base font-bold tabular-nums">
                  {formatWonShort(data.nurtureTotalRevenue)}
                </div>
                <div className="text-[9px] text-white/60">{data.nurtureCount}건</div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 사무실 근무 현황 (내부직원만) */}
        <InternalStaffWidget />
      </div>

      {/* 주요 업무 진행현황 (노션 같은 핀 보드) */}
      <MajorTasksWidget />

      {/* KPI 4 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {/* 프로젝트 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              {data.year}년 프로젝트
            </span>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-50 text-brand-600">
              <FolderKanban className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{data.projectCount.toLocaleString()}</span>
            <span className="text-sm text-slate-400">건</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
            {bizDonut.map((b) => {
              const w = data.projectCount ? (b.value / data.projectCount) * 100 : 0;
              if (w === 0) return null;
              return <div key={b.key} style={{ width: `${w}%`, background: b.color }} />;
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {bizDonut.filter((b) => b.value > 0).map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1 text-slate-600">
                <span className="w-1.5 h-1.5 rounded-sm" style={{ background: b.color }} />
                {b.label} <span className="font-semibold text-slate-800">{b.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 세금계산서 발행 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              세금계산서 발행
            </span>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
              <FileText className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums tracking-tight">{formatWon(data.invoiceTotal)}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            입금완료 <span className="font-semibold text-emerald-600 tabular-nums">{formatWonShort(data.invoicePaid)}</span> · 미입금 <span className="font-semibold text-slate-700 tabular-nums">{formatWonShort(data.invoiceTotal - data.invoicePaid)}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full bg-emerald-500" style={{ width: `${data.invoiceTotal ? (data.invoicePaid / data.invoiceTotal) * 100 : 0}%` }} />
          </div>
        </div>

        {/* 진행중 업체 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">진행중 업체</span>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600">
              <Building2 className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{data.inProgressCompanyCount.toLocaleString()}</span>
            <span className="text-sm text-slate-400">개사</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            서비스진행중 상태의 distinct 업체. {data.year}년 기준
          </p>
        </div>

        {/* 이번달 마감 예정 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">이번달 마감 예정</span>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
              <Calendar className="w-4.5 h-4.5" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{data.dueThisMonth.toLocaleString()}</span>
            <span className="text-sm text-slate-400">건</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            {today.getMonth() + 1}월 종료일자 도래 · 완료보고 미완료 건
          </p>
        </div>
      </div>

      {/* 1주 이내 보고 마감 */}
      <UpcomingReportsClient items={data.upcomingReports as any} todayMs={data.todayMs} />

      {/* 파이프라인 */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold">진행현황 파이프라인</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">육성</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {data.year}년 · 발굴 확정 {data.discoveryCount}건 · 육성 {data.statusGroups.reduce((acc, g) => acc + g._count, 0).toLocaleString()}건
          </span>
        </div>
        <Pipeline statusGroups={data.statusGroups} discoveryConfirmedCount={data.discoveryCount} />
      </div>

      {/* 월별 매출 추이 */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">월별 매출 추이</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{data.year}년 세금계산서 발행일자 기준</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">연간 발행 누계</div>
            <div className="text-base font-semibold tabular-nums text-slate-800">{formatWon(data.invoiceTotal)}</div>
          </div>
        </div>
        <MonthlyInvoiceChart monthly={data.monthlyInvoice} />
      </div>

      {/* 사업영역 도넛 + 담당자 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card title="사업영역별 분포">
          <Donut segments={bizDonut} centerLabel={`${data.year}년`} centerValue={data.projectCount.toLocaleString()} />
        </Card>
        <Card title="담당자별 프로젝트 수">
          <ManagerList items={data.managerSummary} />
        </Card>
      </div>

      {/* 월별 마감현황 */}
      <Card title={`월별 마감현황 — ${data.year}년 육성 프로젝트 (완료보고일자 기준)`}>
        <DueByMonth items={data.dueProjects as any} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200/70 p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}


/* ─────── 월별 매출 차트 ─────── */

function MonthlyInvoiceChart({ monthly }: { monthly: number[] }) {
  const max = Math.max(1, ...monthly);
  const niceCeil = Math.ceil(max / 100_000_000) * 100_000_000 || 100_000_000;
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => (niceCeil / gridSteps) * (gridSteps - i));
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div>
      <div className="flex">
        <div className="w-14 flex flex-col justify-between text-[10px] text-slate-400 tabular-nums text-right pr-2 h-56">
          {gridLines.map((v, i) => (
            <div key={i}>{formatWonShort(v)}</div>
          ))}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex flex-col justify-between">
            {gridLines.map((_, i) => (
              <div key={i} className={`border-t ${i === gridLines.length - 1 ? "border-slate-300" : "border-slate-100"}`} />
            ))}
          </div>
          <div className="flex items-end gap-2 h-56 relative">
            {monthly.map((amt, i) => {
              const pct = (amt / niceCeil) * 100;
              const isCurrent = i + 1 === currentMonth;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group h-full">
                  <span className={`text-[10px] tabular-nums font-semibold transition ${amt > 0 ? "text-slate-700 opacity-100" : "opacity-0"}`}>
                    {amt > 0 ? formatWonShort(amt) : ""}
                  </span>
                  <div
                    className={`w-full max-w-[36px] rounded-md transition cursor-pointer ${
                      isCurrent
                        ? "bg-gradient-to-t from-brand-600 to-brand-400"
                        : amt > 0
                          ? "bg-gradient-to-t from-brand-500 to-brand-300 group-hover:from-brand-600 group-hover:to-brand-400"
                          : "bg-slate-100"
                    }`}
                    style={{ height: `${pct}%`, minHeight: amt > 0 ? "4px" : "2px" }}
                    title={`${i + 1}월: ${formatWon(amt)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {monthly.map((_, i) => {
              const isCurrent = i + 1 === currentMonth;
              return (
                <div key={i} className="flex-1 text-center">
                  <span className={`text-[10px] ${isCurrent ? "text-brand-600 font-semibold" : "text-slate-500"}`}>
                    {i + 1}월
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────── 파이프라인 ─────── */

function Pipeline({
  statusGroups,
  discoveryConfirmedCount,
}: {
  statusGroups: { status: string; _count: number }[];
  discoveryConfirmedCount: number;
}) {
  const total = statusGroups.reduce((a, g) => a + g._count, 0) || 1;
  const counts = new Map(statusGroups.map((g) => [g.status, g._count]));

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden mb-5 bg-slate-100">
        {PIPELINE.map((s) => {
          const c = counts.get(s) ?? 0;
          if (c === 0) return null;
          return (
            <div
              key={s}
              className="transition-all hover:brightness-110"
              style={{ width: `${(c / total) * 100}%`, background: PIPELINE_HEX[s] }}
              title={`${getStatusMeta(s).label}: ${c}건`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-9 gap-2">
        {/* 발굴 확정 — 파이프라인 진입 전 단계 */}
        <div className="relative rounded-xl p-3 border border-dashed border-brand-200 bg-brand-50/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="text-[10px] text-brand-700 font-medium truncate">발굴 확정</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tabular-nums tracking-tight text-brand-600">{discoveryConfirmedCount}</span>
            <span className="text-[10px] text-slate-400 tabular-nums">건</span>
          </div>
          <div className="hidden lg:block absolute -right-1 top-1/2 -translate-y-1/2 z-10 text-slate-300">
            <svg width="8" height="8" viewBox="0 0 8 8">
              <path d="M2 1 L6 4 L2 7" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {PIPELINE.map((s, idx) => {
          const meta = getStatusMeta(s);
          const c = counts.get(s) ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          const color = PIPELINE_HEX[s];
          return (
            <div key={s} className="relative rounded-xl p-3 hover:shadow-sm transition border border-slate-100 bg-slate-50/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-slate-500 font-medium truncate">{meta.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums tracking-tight" style={{ color }}>{c}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">·{pct}%</span>
              </div>
              {idx < PIPELINE.length - 1 && (
                <div className="hidden lg:block absolute -right-1 top-1/2 -translate-y-1/2 z-10 text-slate-300">
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M2 1 L6 4 L2 7" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────── 담당자 ─────── */

function ManagerList({
  items,
}: {
  items: {
    total: number;
    inProgress: number;
    done: number;
    manager: { id: string; name: string; pmCode: string | null; position: string; dept: string };
  }[];
}) {
  if (items.length === 0) {
    return <div className="text-xs text-slate-400 py-8 text-center">담당자가 지정된 프로젝트가 없습니다</div>;
  }
  const max = Math.max(...items.map((i) => i.total));

  return (
    <ul className="space-y-2.5">
      {items.map((g) => {
        const m = g.manager;
        const pct = max ? (g.total / max) * 100 : 0;
        const inProgressW = g.total > 0 ? (g.inProgress / g.total) * 100 : 0;
        const doneW = g.total > 0 ? (g.done / g.total) * 100 : 0;
        return (
          <li key={m.id}>
            <Link
              href={`/managers/${m.id}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 hover:ring-1 hover:ring-brand-100 transition cursor-pointer group"
              title={`${m.name} 담당자 대시보드 열기`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {m.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-700">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{m.position}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-800 shrink-0">
                    {g.total}
                    <span className="text-[10px] text-slate-400 ml-0.5">건</span>
                  </span>
                </div>
                <div
                  className="flex h-1.5 rounded-full overflow-hidden bg-slate-100"
                  style={{ width: `${pct}%`, minWidth: "20px" }}
                >
                  <div className="bg-brand-500" style={{ width: `${inProgressW}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${doneW}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-sm bg-brand-500" />
                    진행중 <strong className="text-brand-700 tabular-nums">{g.inProgress}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                    완료 <strong className="text-emerald-700 tabular-nums">{g.done}</strong>
                  </span>
                </div>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ─────── 월별 마감 ─────── */

const SERVICE_COLORS: Record<string, string> = {
  consulting: "#3f63f5",
  marketing: "#f59e0b",
  tech_support: "#94a3b8",
  export_consulting: "#ec4899",
  translation: "#a78bfa",
  exhibition: "#22c55e",
  contract_work: "#10b981",
  certification: "#84cc16",
  rental: "#fb923c",
  cost_settlement: "#64748b",
};

function DueByMonth({ items }: { items: { finalReportDate: Date | string | null; serviceType: string | null; finalReportYn: boolean }[] }) {
  const byMonth = new Map<string, Map<string, number>>();
  const noDateByService = new Map<string, number>();
  let noDateTotal = 0;
  for (const p of items) {
    const svcKey = p.serviceType || "_unknown";
    if (!p.finalReportDate) {
      noDateByService.set(svcKey, (noDateByService.get(svcKey) ?? 0) + 1);
      noDateTotal++;
      continue;
    }
    const d = new Date(p.finalReportDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, new Map());
    const m = byMonth.get(key)!;
    m.set(svcKey, (m.get(svcKey) ?? 0) + 1);
  }

  const months = Array.from(byMonth.keys()).sort();
  // "완료보고일자 없음" 버킷도 함께 표시 (있으면 맨 앞)
  const totals = months.map((m) => Array.from(byMonth.get(m)!.values()).reduce((a, b) => a + b, 0));
  const maxTotal = Math.max(1, noDateTotal, ...totals);
  const niceCeil = Math.ceil(maxTotal / 5) * 5 || 5;
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => Math.round((niceCeil / gridSteps) * (gridSteps - i)));

  const usedServices = new Set<string>();
  byMonth.forEach((m) => m.forEach((_, k) => usedServices.add(k)));
  noDateByService.forEach((_, k) => usedServices.add(k));

  if (months.length === 0 && noDateTotal === 0) {
    return <div className="text-xs text-slate-400 py-16 text-center">육성 프로젝트가 없습니다</div>;
  }

  return (
    <div>
      <div className="flex">
        <div className="w-8 flex flex-col justify-between text-[10px] text-slate-400 tabular-nums text-right pr-2 h-56">
          {gridLines.map((v) => (
            <div key={v}>{v}</div>
          ))}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 flex flex-col justify-between">
            {gridLines.map((v, i) => (
              <div key={v} className={`border-t ${i === gridLines.length - 1 ? "border-slate-300" : "border-slate-100"}`} />
            ))}
          </div>
          <div className="flex items-end gap-2 h-56 relative">
            {/* '완료보고일자 없음' 버킷 — 회색 톤으로 맨 앞 */}
            {noDateTotal > 0 && (
              <div className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group h-full">
                <span className="text-[10px] tabular-nums text-slate-700 font-semibold">{noDateTotal}</span>
                <div
                  className="w-full max-w-[44px] flex flex-col-reverse rounded-md overflow-hidden cursor-pointer transition group-hover:shadow-md border border-slate-200"
                  style={{ height: `${(noDateTotal / niceCeil) * 100}%`, minHeight: "3px" }}
                  title={`완료보고일자 미지정: ${noDateTotal}건`}
                >
                  {Array.from(noDateByService.entries())
                    .sort(([a], [b]) => (a > b ? 1 : -1))
                    .map(([svc, count]) => {
                      const segHeight = (count / noDateTotal) * 100;
                      const color = SERVICE_COLORS[svc] ?? "#e2e8f0";
                      return (
                        <div
                          key={svc}
                          style={{ height: `${segHeight}%`, background: color, opacity: 0.55 }}
                          title={`${getServiceLabel(svc) || "기타"}: ${count}건`}
                        />
                      );
                    })}
                </div>
              </div>
            )}
            {months.map((m, i) => {
              const monthData = byMonth.get(m)!;
              const total = totals[i];
              const heightPct = (total / niceCeil) * 100;
              return (
                <div key={m} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group h-full">
                  <span className="text-[10px] tabular-nums text-slate-700 font-semibold">{total}</span>
                  <div
                    className="w-full max-w-[44px] flex flex-col-reverse rounded-md overflow-hidden cursor-pointer transition group-hover:shadow-md"
                    style={{ height: `${heightPct}%`, minHeight: "3px" }}
                  >
                    {Array.from(monthData.entries())
                      .sort(([a], [b]) => (a > b ? 1 : -1))
                      .map(([svc, count]) => {
                        const segHeight = (count / total) * 100;
                        const color = SERVICE_COLORS[svc] ?? "#cbd5e1";
                        return (
                          <div
                            key={svc}
                            style={{ height: `${segHeight}%`, background: color }}
                            title={`${getServiceLabel(svc) || "기타"}: ${count}건`}
                          />
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {noDateTotal > 0 && (
              <div className="flex-1 text-center">
                <div className="text-[10px] text-slate-500">완료보고일자 없음</div>
              </div>
            )}
            {months.map((m) => {
              const [year, mo] = m.split("-");
              const isThisMonth = new Date().getFullYear() === Number(year) && new Date().getMonth() + 1 === Number(mo);
              return (
                <div key={m} className="flex-1 text-center">
                  <div className={`text-[10px] ${isThisMonth ? "text-brand-600 font-semibold" : "text-slate-500"}`}>
                    {Number(mo)}월
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1.5">
        {SERVICE_TYPE.filter((s) => usedServices.has(s.value)).map((s) => (
          <span key={s.value} className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERVICE_COLORS[s.value] ?? "#cbd5e1" }} />
            {s.label}
          </span>
        ))}
        {usedServices.has("_unknown") && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />
            서비스 없음
          </span>
        )}
      </div>
    </div>
  );
}
