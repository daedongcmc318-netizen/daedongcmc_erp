"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react";
import clsx from "clsx";

type User = {
  id: string;
  name: string;
  dept: string;
  position: string;
  isInternal: boolean;
  pmCode: string | null;
  consultantGrade: string | null;
  consultantRate: string | null;
};

type Project = {
  id: string;
  title: string;
  displayCode: string | null;
  year: number;
  managerId: string | null;
  confirmedRevenue: string;
};

type Assignment = {
  id: string;
  date: string;
  consultantId: string;
};

type Plan = {
  id: string;
  year: number;
  title: string;
  projectId: string | null;
  managerId: string | null;
  consultingBudget: string;
  dailyRate: string;
  requiredMD: number;
  startDate: string | null;
  endDate: string | null;
  contractEndDate: string | null;
  notes: string | null;
  sortOrder: number;
  manager: { id: string; name: string } | null;
  project: { id: string; title: string; displayCode: string | null } | null;
  assignments: Assignment[];
};

const GRADE_ORDER: Record<string, number> = {
  특급: 0,
  "1급": 1,
  "2급": 2,
  "3급": 3,
  "4급": 4,
  "5급": 5,
};

/** 전체 기간 시작/종료 (UI 디폴트, 사용자가 조정 가능) */
const DEFAULT_RANGE_START = "2026-03-02";
const DEFAULT_RANGE_END = "2026-10-30";

function fmtKRW(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  return `₩${n.toLocaleString()}`;
}

function fmtKRWShort(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return `₩${n.toLocaleString()}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetweenInclusive(start: Date, end: Date): Date[] {
  const list: Date[] = [];
  const cur = new Date(start);
  cur.setHours(12, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(12, 0, 0, 0);
  while (cur <= stop) {
    list.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return list;
}

function countWeekdays(start: Date, end: Date): number {
  let n = 0;
  for (const d of daysBetweenInclusive(start, end)) if (!isWeekend(d)) n++;
  return n;
}

export default function ConsultantMDClient({
  year,
  initialPlans,
  users,
  projects,
}: {
  year: number;
  initialPlans: Plan[];
  users: User[];
  projects: Project[];
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showGradeHelp, setShowGradeHelp] = useState(false);

  // 전체 기간 + 가용 MD 기간
  const [rangeStart, setRangeStart] = useState(DEFAULT_RANGE_START);
  const [rangeEnd, setRangeEnd] = useState(DEFAULT_RANGE_END);
  const [availStart, setAvailStart] = useState(`${year}-03-04`);
  const [availEnd, setAvailEnd] = useState(`${year}-07-31`);

  // 표시할 모든 날짜 (전체 기간, 평일+주말)
  const allDates = useMemo(() => {
    const start = new Date(rangeStart + "T00:00:00");
    const end = new Date(rangeEnd + "T00:00:00");
    return daysBetweenInclusive(start, end);
  }, [rangeStart, rangeEnd]);

  // 월 그룹 (sticky 헤더용)
  const monthGroups = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const d of allDates) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!m.has(k)) m.set(k, { label: `${d.getMonth() + 1}월`, count: 0 });
      m.get(k)!.count++;
    }
    return Array.from(m.entries()).map(([k, v]) => ({ key: k, ...v }));
  }, [allDates]);

  const availableMD = useMemo(
    () =>
      countWeekdays(new Date(availStart + "T00:00:00"), new Date(availEnd + "T00:00:00")),
    [availStart, availEnd]
  );

  // 컨설턴트 (등급 보유자만, 등급 → 이름 정렬)
  const consultants = useMemo(
    () =>
      users
        .filter((u) => u.consultantGrade)
        .sort((a, b) => {
          const oa = GRADE_ORDER[a.consultantGrade!] ?? 99;
          const ob = GRADE_ORDER[b.consultantGrade!] ?? 99;
          if (oa !== ob) return oa - ob;
          return a.name.localeCompare(b.name);
        }),
    [users]
  );

  // 컨설턴트별 사업 그룹
  const plansByConsultant = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const c of consultants) m.set(c.id, []);
    for (const p of plans) {
      if (p.managerId && m.has(p.managerId)) {
        m.get(p.managerId)!.push(p);
      }
    }
    // sortOrder 정렬
    for (const arr of m.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [plans, consultants]);

  // 미배정 사업
  const unassignedPlans = useMemo(
    () => plans.filter((p) => !p.managerId || !plansByConsultant.has(p.managerId)),
    [plans, plansByConsultant]
  );

  // (consultantId, dateKey) → planId 인덱스
  const cellMap = useMemo(() => {
    const m = new Map<string, { planId: string; assignmentId: string }>();
    for (const p of plans) {
      for (const a of p.assignments) {
        m.set(`${a.consultantId}::${a.date.slice(0, 10)}`, { planId: p.id, assignmentId: a.id });
      }
    }
    return m;
  }, [plans]);

  // 컨설턴트별 배정 MD/비용
  const consultantStats = useMemo(() => {
    const m = new Map<string, { md: number; cost: number }>();
    for (const c of consultants) m.set(c.id, { md: 0, cost: 0 });
    for (const p of plans) {
      for (const a of p.assignments) {
        const s = m.get(a.consultantId);
        if (!s) continue;
        const r = Number(consultants.find((c) => c.id === a.consultantId)?.consultantRate ?? 0);
        s.md++;
        s.cost += r;
      }
    }
    return m;
  }, [plans, consultants]);

  // ─── plan CRUD ───
  async function createPlan(payload: {
    title: string;
    projectId: string | null;
    managerId: string | null;
    consultingBudget: number;
    dailyRate: number;
  }) {
    const res = await fetch("/api/consultant-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, year }),
    });
    if (!res.ok) {
      alert("사업 추가 실패");
      return;
    }
    const created = await res.json();
    setPlans((prev) => [...prev, created]);
    setShowPlanForm(false);
  }

  async function deletePlan(id: string) {
    if (!confirm("이 사업과 모든 배정을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/consultant-plans/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleCell(planId: string, consultantId: string, date: Date) {
    if (isWeekend(date)) return;
    const dk = dateKey(date);
    const existing = cellMap.get(`${consultantId}::${dk}`);

    if (existing && existing.planId === planId) {
      const res = await fetch(`/api/consultant-assignments/${existing.assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? { ...p, assignments: p.assignments.filter((a) => a.id !== existing.assignmentId) }
            : p
        )
      );
      return;
    }

    if (existing) {
      const otherPlan = plans.find((p) => p.id === existing.planId);
      alert(`이미 ${otherPlan?.title ?? "다른 사업"}에 배정되어 있습니다. 먼저 해제 후 시도하세요.`);
      return;
    }

    const res = await fetch("/api/consultant-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, consultantId, date: dk }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "배정 실패");
      return;
    }
    const created = await res.json();
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              assignments: [
                ...p.assignments,
                { id: created.id, date: created.date, consultantId: created.consultantId },
              ],
            }
          : p
      )
    );
  }

  const totalRequired = plans.reduce((a, p) => a + p.requiredMD, 0);
  const totalAssigned = plans.reduce((a, p) => a + p.assignments.length, 0);
  const totalBudget = plans.reduce((a, p) => a + Number(p.consultingBudget), 0);

  return (
    <div className="px-3 py-4 max-w-[2000px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">프로젝트 관리 ▸ 혁신 컨설턴트 MD</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{year}년 혁신 컨설턴트 MD</h1>
          <p className="text-sm text-slate-500 mt-1">
            컨설턴트 <strong className="text-slate-700">{consultants.length}명</strong> · 사업{" "}
            <strong className="text-slate-700">{plans.length}건</strong> · MD{" "}
            <strong className="text-emerald-600">{totalAssigned}</strong>/
            <strong className="text-slate-700">{totalRequired}</strong> · 컨설팅{" "}
            <strong className="text-slate-700">{fmtKRWShort(totalBudget)}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGradeHelp(!showGradeHelp)}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-md flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" /> 등급 기준
          </button>
          <button
            onClick={() => setShowPlanForm(true)}
            className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> 사업 추가
          </button>
        </div>
      </div>

      {/* 등급 기준 안내 */}
      {showGradeHelp && <GradeCriteriaPanel onClose={() => setShowGradeHelp(false)} />}

      {/* 기간/가용 MD 컨트롤 */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm flex flex-wrap items-center gap-3 text-[12px]">
        <span className="text-slate-500">표시 기간:</span>
        <input
          type="date"
          value={rangeStart}
          onChange={(e) => setRangeStart(e.target.value)}
          className="h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={rangeEnd}
          onChange={(e) => setRangeEnd(e.target.value)}
          className="h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
        />
        <span className="text-slate-400 mx-2">·</span>
        <span className="text-slate-500">가용 MD 기간:</span>
        <input
          type="date"
          value={availStart}
          onChange={(e) => setAvailStart(e.target.value)}
          className="h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
        />
        <span className="text-slate-400">~</span>
        <input
          type="date"
          value={availEnd}
          onChange={(e) => setAvailEnd(e.target.value)}
          className="h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
        />
        <span className="text-slate-700">
          = <strong className="text-brand-700">{availableMD}일</strong> (평일)
        </span>
      </div>

      {/* 컨설턴트 요약 */}
      <ConsultantSummary
        consultants={consultants}
        stats={consultantStats}
        availableMD={availableMD}
      />

      {/* 신규 사업 폼 */}
      {showPlanForm && (
        <PlanForm
          year={year}
          users={users}
          projects={projects}
          onCancel={() => setShowPlanForm(false)}
          onSubmit={createPlan}
        />
      )}

      {/* 단일 통합 그리드 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="text-[10.5px] text-slate-500 px-3 py-1.5 bg-slate-50/60 border-b border-slate-200">
          셀 클릭 = 배정 토글 (사업별 행에서) · 같은 컨설턴트의 같은 날 중복 자동 차단
        </div>
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <UnifiedGrid
            consultants={consultants}
            plansByConsultant={plansByConsultant}
            unassignedPlans={unassignedPlans}
            allDates={allDates}
            monthGroups={monthGroups}
            cellMap={cellMap}
            stats={consultantStats}
            onToggleCell={toggleCell}
            onDeletePlan={deletePlan}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────── 컨설턴트별 요약 패널 ─────────── */

function ConsultantSummary({
  consultants,
  stats,
  availableMD,
}: {
  consultants: User[];
  stats: Map<string, { md: number; cost: number }>;
  availableMD: number;
}) {
  if (consultants.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        등록된 컨설턴트가 없습니다.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-slate-500 text-[10.5px] border-b border-slate-200">
            <th className="text-left px-2 py-1.5">컨설턴트</th>
            <th className="text-left px-2 py-1.5 w-14">등급</th>
            <th className="text-right px-2 py-1.5 w-24">일단가</th>
            <th className="text-right px-2 py-1.5 w-24">배정 MD</th>
            <th className="text-right px-2 py-1.5 w-20">가용 MD</th>
            <th className="text-right px-2 py-1.5 w-28">배정 비용</th>
            <th className="text-right px-2 py-1.5 w-32">신청 가능 비용</th>
            <th className="px-2 py-1.5 w-28">진행도</th>
          </tr>
        </thead>
        <tbody>
          {consultants.map((c) => {
            const stat = stats.get(c.id) ?? { md: 0, cost: 0 };
            const remaining = Math.max(0, availableMD - stat.md);
            const rate = Number(c.consultantRate ?? 0);
            const remainingBudget = remaining * rate;
            const pct = availableMD > 0 ? Math.min(100, (stat.md / availableMD) * 100) : 0;
            return (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                <td className="px-2 py-1.5 font-medium text-slate-800">{c.name}</td>
                <td className="px-2 py-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-mono font-medium">
                    {c.consultantGrade}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtKRW(rate)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <strong className="text-emerald-600">{stat.md}</strong>
                  <span className="text-slate-400"> / {availableMD}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{remaining}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmtKRW(stat.cost)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-brand-700 font-semibold">
                  {fmtKRW(remainingBudget)}
                </td>
                <td className="px-2 py-1.5">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={clsx("h-full transition-all", pct >= 100 ? "bg-rose-500" : "bg-brand-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── 단일 통합 그리드 ─────────── */

function UnifiedGrid({
  consultants,
  plansByConsultant,
  unassignedPlans,
  allDates,
  monthGroups,
  cellMap,
  stats,
  onToggleCell,
  onDeletePlan,
}: {
  consultants: User[];
  plansByConsultant: Map<string, Plan[]>;
  unassignedPlans: Plan[];
  allDates: Date[];
  monthGroups: { key: string; label: string; count: number }[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  stats: Map<string, { md: number; cost: number }>;
  onToggleCell: (planId: string, consultantId: string, date: Date) => void;
  onDeletePlan: (id: string) => void;
}) {
  return (
    <table className="text-[10.5px] border-collapse">
      <thead className="bg-slate-50 sticky top-0 z-20">
        {/* 월 헤더 */}
        <tr>
          <th
            colSpan={5}
            className="sticky left-0 bg-slate-50 z-30 px-2 py-1 border-b border-r border-slate-200"
          />
          {monthGroups.map((m) => (
            <th
              key={m.key}
              colSpan={m.count}
              className="text-center border-b border-r border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-700 py-1"
            >
              {m.label}
            </th>
          ))}
        </tr>
        {/* 일자 헤더 */}
        <tr>
          <th className="sticky left-0 bg-slate-50 z-30 w-10 text-left px-2 py-1.5 border-b border-r border-slate-200 text-[10px]">
            #
          </th>
          <th className="sticky left-10 bg-slate-50 z-30 w-32 text-left px-2 py-1.5 border-b border-r border-slate-200 text-[10px]">
            업체/사업명
          </th>
          <th className="sticky left-[168px] bg-slate-50 z-30 w-20 text-right px-2 py-1.5 border-b border-r border-slate-200 text-[10px]">
            서비스금액
          </th>
          <th className="w-10 text-center px-1 py-1.5 border-b border-r border-slate-200 text-[10px]">필요</th>
          <th className="w-10 text-center px-1 py-1.5 border-b border-r border-slate-200 text-[10px]">배정</th>
          {allDates.map((d) => {
            const we = isWeekend(d);
            const dow = "일월화수목금토"[d.getDay()];
            return (
              <th
                key={dateKey(d)}
                className={clsx(
                  "w-5 text-center px-0 py-0.5 border-b border-r border-slate-200 font-medium tabular-nums",
                  we ? "bg-slate-200/60 text-slate-400" : "text-slate-600"
                )}
              >
                <div className="text-[9px] leading-tight">{d.getDate()}</div>
                <div className={clsx("text-[7px] leading-none", we ? "text-rose-400" : "text-slate-400")}>
                  {dow}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {consultants.map((c) => {
          const plansForC = plansByConsultant.get(c.id) ?? [];
          const stat = stats.get(c.id) ?? { md: 0, cost: 0 };
          return (
            <ConsultantGroup
              key={c.id}
              consultant={c}
              plans={plansForC}
              stat={stat}
              allDates={allDates}
              cellMap={cellMap}
              onToggleCell={onToggleCell}
              onDeletePlan={onDeletePlan}
            />
          );
        })}
        {unassignedPlans.length > 0 && (
          <>
            <tr>
              <td
                colSpan={5 + allDates.length}
                className="px-2 py-1.5 border-b border-slate-200 bg-amber-50 text-[11px] text-amber-800 font-medium sticky left-0"
              >
                ⚠ 미배정 사업 (담당 컨설턴트 미지정)
              </td>
            </tr>
            {unassignedPlans.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                consultantId={null}
                allDates={allDates}
                cellMap={cellMap}
                onToggleCell={onToggleCell}
                onDeletePlan={onDeletePlan}
                indent={false}
              />
            ))}
          </>
        )}
      </tbody>
    </table>
  );
}

function ConsultantGroup({
  consultant,
  plans,
  stat,
  allDates,
  cellMap,
  onToggleCell,
  onDeletePlan,
}: {
  consultant: User;
  plans: Plan[];
  stat: { md: number; cost: number };
  allDates: Date[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  onToggleCell: (planId: string, consultantId: string, date: Date) => void;
  onDeletePlan: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalRequired = plans.reduce((a, p) => a + p.requiredMD, 0);
  return (
    <>
      <tr className="bg-brand-50/50 border-b-2 border-brand-200">
        <td className="px-2 py-1 border-r border-slate-200 sticky left-0 bg-brand-50 z-10">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-500 hover:text-slate-800"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td
          colSpan={2}
          className="px-2 py-1 border-r border-slate-200 sticky left-10 bg-brand-50 z-10"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[12px] text-slate-800">{consultant.name}</span>
            <span className="text-[9.5px] px-1 py-0.5 rounded bg-white text-brand-700 font-medium ring-1 ring-brand-200">
              {consultant.consultantGrade}
            </span>
            <span className="text-[9.5px] text-slate-500 tabular-nums">{fmtKRW(consultant.consultantRate)}/일</span>
          </div>
        </td>
        <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums text-[10.5px] font-semibold text-slate-700">
          {totalRequired}
        </td>
        <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums text-[10.5px] font-semibold text-emerald-700">
          {stat.md}
        </td>
        {allDates.map((d) => (
          <td key={dateKey(d)} className="border-r border-slate-100 bg-brand-50/30" />
        ))}
      </tr>
      {expanded &&
        plans.map((p, i) => (
          <PlanRow
            key={p.id}
            plan={p}
            consultantId={consultant.id}
            allDates={allDates}
            cellMap={cellMap}
            onToggleCell={onToggleCell}
            onDeletePlan={onDeletePlan}
            indent
            seq={i + 1}
          />
        ))}
      {expanded && plans.length > 0 && (
        <ConsultantSumRow consultant={consultant} plans={plans} allDates={allDates} />
      )}
      {expanded && plans.length === 0 && (
        <tr>
          <td colSpan={5} className="px-2 py-1 border-b border-slate-100 sticky left-0 bg-white">
            <span className="text-[10px] text-slate-400 italic ml-4">배정 사업 없음</span>
          </td>
          {allDates.map((d) => (
            <td key={dateKey(d)} className="border-r border-b border-slate-100" />
          ))}
        </tr>
      )}
    </>
  );
}

/** 컨설턴트별 합계 SUM 행 (엑셀의 합계 SUM 동일) */
function ConsultantSumRow({
  consultant,
  plans,
  allDates,
}: {
  consultant: User;
  plans: Plan[];
  allDates: Date[];
}) {
  // 일자별 합계 (그 컨설턴트의 plans 중 그 날짜에 배정된 것 = 0 또는 1)
  const dateSet = new Set<string>();
  for (const p of plans) for (const a of p.assignments) dateSet.add(a.date.slice(0, 10));

  const totalRequired = plans.reduce((a, p) => a + p.requiredMD, 0);
  const totalAssigned = plans.reduce((a, p) => a + p.assignments.length, 0);
  const totalBudget = plans.reduce((a, p) => a + Number(p.consultingBudget), 0);

  return (
    <tr className="bg-amber-50/40 border-b-2 border-amber-200">
      <td className="px-2 py-1 border-r border-slate-200 sticky left-0 bg-amber-50/40 z-10" />
      <td className="px-2 py-1 border-r border-slate-200 sticky left-10 bg-amber-50/40 z-10 text-[10.5px] font-semibold text-slate-700">
        합계 SUM
      </td>
      <td className="px-2 py-1 border-r border-slate-200 sticky left-[168px] bg-amber-50/40 z-10 text-right tabular-nums text-[10.5px] text-slate-700 font-semibold">
        {fmtKRWShort(totalBudget)}
      </td>
      <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums text-[10.5px] font-semibold text-slate-700">
        {totalRequired}
      </td>
      <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums text-[10.5px] font-semibold text-emerald-700">
        {totalAssigned}
      </td>
      {allDates.map((d) => {
        const dk = dateKey(d);
        const we = isWeekend(d);
        const has = dateSet.has(dk);
        return (
          <td
            key={dk}
            className={clsx(
              "w-5 h-5 border-r border-slate-100 text-center align-middle p-0",
              we ? "bg-slate-100/40" : "bg-amber-50/30"
            )}
          >
            {has && (
              <span className="text-[9px] font-bold text-amber-700 tabular-nums">1</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function PlanRow({
  plan,
  consultantId,
  allDates,
  cellMap,
  onToggleCell,
  onDeletePlan,
  indent,
  seq,
}: {
  plan: Plan;
  consultantId: string | null;
  allDates: Date[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  onToggleCell: (planId: string, consultantId: string, date: Date) => void;
  onDeletePlan: (id: string) => void;
  indent: boolean;
  seq?: number;
}) {
  const remaining = Math.max(0, plan.requiredMD - plan.assignments.length);
  return (
    <tr className="group/row border-b border-slate-100 hover:bg-slate-50/30">
      <td className="px-2 py-0.5 border-r border-slate-200 sticky left-0 bg-white group-hover/row:bg-slate-50/30 z-10 font-mono text-[10px] text-slate-400 tabular-nums text-center">
        {seq ?? "—"}
      </td>
      <td
        className={clsx(
          "px-2 py-0.5 border-r border-slate-200 sticky left-10 bg-white group-hover/row:bg-slate-50/30 z-10",
          indent && "pl-5"
        )}
      >
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-800 truncate" title={plan.title}>{plan.title}</span>
          <button
            onClick={() => onDeletePlan(plan.id)}
            className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-rose-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
      <td className="px-2 py-0.5 border-r border-slate-200 sticky left-[168px] bg-white group-hover/row:bg-slate-50/30 z-10 text-right tabular-nums text-[10px] text-slate-700">
        {fmtKRWShort(plan.consultingBudget)}
      </td>
      <td className="px-1 py-0.5 border-r border-slate-200 text-center tabular-nums text-[10.5px]">
        {plan.requiredMD}
      </td>
      <td className="px-1 py-0.5 border-r border-slate-200 text-center tabular-nums">
        <span className={clsx("text-[10.5px] font-medium", remaining === 0 && plan.requiredMD > 0 ? "text-emerald-600" : "text-slate-700")}>
          {plan.assignments.length}
        </span>
        {remaining === 0 && plan.requiredMD > 0 && (
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 inline ml-0.5" />
        )}
      </td>
      {allDates.map((d) => {
        const we = isWeekend(d);
        const dk = dateKey(d);
        const isAssigned = consultantId
          ? cellMap.get(`${consultantId}::${dk}`)?.planId === plan.id
          : false;
        const otherAssigned = consultantId
          ? !!cellMap.get(`${consultantId}::${dk}`) && !isAssigned
          : false;
        return (
          <td
            key={dk}
            className={clsx(
              "w-5 h-5 border-r border-slate-100 text-center align-middle p-0",
              we ? "bg-slate-100/40" : "bg-white",
              !we && consultantId && "hover:bg-brand-50 cursor-pointer",
              !consultantId && "cursor-not-allowed bg-slate-50"
            )}
            onClick={() => !we && consultantId && onToggleCell(plan.id, consultantId, d)}
            title={
              !consultantId
                ? "컨설턴트 미지정"
                : we
                  ? "주말"
                  : isAssigned
                    ? `${plan.title} (${dk}) - 클릭하여 해제`
                    : otherAssigned
                      ? "다른 사업에 배정됨"
                      : "클릭하여 배정"
            }
          >
            {isAssigned && (
              <div className="mx-auto w-3.5 h-3.5 bg-brand-500 text-white text-[9px] font-bold rounded-sm flex items-center justify-center leading-none">
                1
              </div>
            )}
            {otherAssigned && (
              <div className="mx-auto w-1.5 h-1.5 bg-slate-300 rounded-full" />
            )}
          </td>
        );
      })}
    </tr>
  );
}

/* ─────────── 등급 기준 안내 ─────────── */

function GradeCriteriaPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          <Info className="w-4 h-4 text-brand-500" /> 컨설턴트 단가 기준
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11.5px]">
        <div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-[10px]">
                <th className="px-2 py-1 border border-slate-200 text-center w-14">등급</th>
                <th className="px-2 py-1 border border-slate-200 text-left">경력 기준 (학사 기준)</th>
                <th className="px-2 py-1 border border-slate-200 text-right w-24">계(원)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["특급", "24년 이상", "985,000"],
                ["1급", "19년 이상", "834,000"],
                ["2급", "12년 이상", "757,000"],
                ["3급", "9년 이상", "644,000"],
                ["4급", "6년 이상", "518,000"],
                ["5급", "3년 이상", "388,000"],
              ].map(([g, c, w]) => (
                <tr key={g}>
                  <td className="px-2 py-1 border border-slate-200 text-center font-mono">{g}</td>
                  <td className="px-2 py-1 border border-slate-200 text-slate-700">{c}</td>
                  <td className="px-2 py-1 border border-slate-200 text-right tabular-nums">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-semibold text-slate-700 mb-1.5">경력 추가 인정 기준</div>
          <ul className="space-y-1 text-slate-600">
            <li>• 박사학위 소지자: 경력 <strong>6년</strong> 인정</li>
            <li>• 석사학위 소지자: 경력 <strong>2년</strong> 인정</li>
            <li>• 기술사 자격증 보유자: 경력 <strong>6년</strong> 인정</li>
            <li className="leading-snug">
              • 변호사, 회계사, 변리사, 세무사, 관세사, 노무사, 법무사, 기능장, 경영기술지도사, 등록증 보유자: 경력 <strong>3년</strong> 인정
            </li>
          </ul>
          <div className="mt-3 text-[10px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
            * 해당분야 = 각 프로그램별 지원내용과 관련된 분야<br />
            * 고졸 + 실무경력 4년 또는 전문학사 + 실무경력 2년의 경력 증빙 가능 시 학사 기준 동일 적용<br />
            * 학력과 자격 중복 적용 (단, 복수 학력 또는 복수 자격은 상위 기준만)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 사업 추가 폼 ─────────── */

function PlanForm({
  year,
  users,
  projects,
  onCancel,
  onSubmit,
}: {
  year: number;
  users: User[];
  projects: Project[];
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    projectId: string | null;
    managerId: string | null;
    consultingBudget: number;
    dailyRate: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [budgetStr, setBudgetStr] = useState("10000000");
  const [saving, setSaving] = useState(false);

  const manager = users.find((u) => u.id === managerId);
  const rate = manager?.consultantGrade ? Number(manager.consultantRate) : 1000000;
  const budget = Number(budgetStr || 0);
  const requiredMD = rate > 0 ? Math.floor(budget / rate) : 0;
  const vatExcluded = Math.floor(budget / 1.1);
  const consultCost = requiredMD * rate;

  async function submit() {
    if (!title.trim()) {
      alert("사업명을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        projectId,
        managerId,
        consultingBudget: budget,
        dailyRate: rate,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-brand-200 rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">신규 사업 추가 — {year}년</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-slate-400">사업명/업체명</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 휘닉스에이엠"
            autoFocus
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">연결 프로젝트 (선택)</label>
          <select
            value={projectId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setProjectId(v);
              if (v) {
                const proj = projects.find((p) => p.id === v);
                if (proj && !title) setTitle(proj.title);
                if (proj?.managerId && !managerId) setManagerId(proj.managerId);
              }
            }}
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 bg-white"
          >
            <option value="">— 미연결 —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayCode ? `[${p.displayCode}] ` : ""}
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">담당 컨설턴트</label>
          <select
            value={managerId ?? ""}
            onChange={(e) => setManagerId(e.target.value || null)}
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 bg-white"
          >
            <option value="">— 미지정 —</option>
            {users
              .filter((u) => u.consultantGrade)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.consultantGrade}, ₩{Number(u.consultantRate).toLocaleString()})
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">서비스 금액 (VAT 포함, 원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={budgetStr}
            onChange={(e) => setBudgetStr(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full h-8 px-2 text-[12px] text-right tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
          <div className="text-[10px] text-slate-400 mt-0.5 text-right">{fmtKRW(budget)}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
          <div className="text-[10px] text-slate-500">VAT 제외 (÷1.1)</div>
          <div className="text-base font-semibold tabular-nums text-slate-700">{fmtKRWShort(vatExcluded)}</div>
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded px-3 py-2">
          <div className="text-[10px] text-brand-700">필요 MD (자동)</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-brand-700">{requiredMD}</span>
            <span className="text-[10px] text-brand-500">MD</span>
            <span className="text-[10px] text-brand-600 tabular-nums ml-auto">{fmtKRWShort(consultCost)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-[12px] font-medium rounded"
        >
          취소
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="h-8 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[12px] font-medium rounded flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} 추가
        </button>
      </div>
    </div>
  );
}
