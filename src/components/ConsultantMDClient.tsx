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
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
  consultantRate: string | null; // serialized BigInt
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
  date: string; // ISO
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
  notes: string | null;
  sortOrder: number;
  manager: { id: string; name: string } | null;
  project: { id: string; title: string; displayCode: string | null } | null;
  assignments: Assignment[];
};

const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10]; // 3월~10월

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

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function dateKey(d: Date): string {
  // Local Y-M-D → ISO date without timezone shifting
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDate(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day, 12, 0, 0);
}

/** 평일만 카운트 */
function countWeekdaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d)) count++;
  }
  return count;
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
  const [activeMonth, setActiveMonth] = useState<number>(() => {
    const m = new Date().getMonth() + 1;
    if (MONTHS.includes(m)) return m;
    return MONTHS[0];
  });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // 가용 MD 기간 (사용자 설정 가능, 기본: 3.4 ~ 7.31)
  const [availStart, setAvailStart] = useState(`${year}-03-04`);
  const [availEnd, setAvailEnd] = useState(`${year}-07-31`);
  const availableMD = useMemo(() => countWeekdaysBetween(availStart, availEnd), [availStart, availEnd]);

  // 컨설턴트 (등급 있는 직원만)
  const consultants = useMemo(
    () =>
      users
        .filter((u) => u.consultantGrade)
        .sort((a, b) => {
          const ga = a.consultantGrade ?? "z";
          const gb = b.consultantGrade ?? "z";
          if (ga !== gb) return ga.localeCompare(gb);
          return a.name.localeCompare(b.name);
        }),
    [users]
  );

  // 컨설턴트별 사업 그룹
  const plansByConsultant = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const c of consultants) m.set(c.id, []);
    // 사업에 어떤 컨설턴트가 한번이라도 배정되어 있다면 그 컨설턴트 그룹에 포함
    for (const p of plans) {
      const consultantIds = new Set(p.assignments.map((a) => a.consultantId));
      for (const cid of consultantIds) {
        if (m.has(cid)) m.get(cid)!.push(p);
      }
      // 배정이 없는 사업은 담당자 컨설턴트 그룹에 임시 포함 (없으면 unassigned)
      if (consultantIds.size === 0 && p.managerId && m.has(p.managerId)) {
        m.get(p.managerId)!.push(p);
      }
    }
    return m;
  }, [plans, consultants]);

  // unassigned plans (담당자가 컨설턴트 아닌 경우)
  const unassignedPlans = useMemo(() => {
    const inGroup = new Set<string>();
    plansByConsultant.forEach((arr) => arr.forEach((p) => inGroup.add(p.id)));
    return plans.filter((p) => !inGroup.has(p.id));
  }, [plans, plansByConsultant]);

  // 컨설턴트별 MD/비용 합계
  const consultantStats = useMemo(() => {
    const m = new Map<string, { assignedMD: number; cost: number }>();
    for (const c of consultants) m.set(c.id, { assignedMD: 0, cost: 0 });
    for (const p of plans) {
      for (const a of p.assignments) {
        const stat = m.get(a.consultantId);
        if (!stat) continue;
        const rate = Number(consultants.find((c) => c.id === a.consultantId)?.consultantRate ?? 0);
        stat.assignedMD++;
        stat.cost += rate;
      }
    }
    return m;
  }, [plans, consultants]);

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

  // ─── 셀 토글: plan 행에서 직접 클릭 → 그 plan에 해당 컨설턴트·일자 배정 추가/제거 ───
  async function toggleCell(planId: string, consultantId: string, day: number) {
    const date = buildDate(year, activeMonth, day);
    if (isWeekend(date)) return;
    const dk = dateKey(date);

    // 이미 그 셀에 다른 plan이 들어있으면 경고
    const existing = cellMap.get(`${consultantId}::${dk}`);

    if (existing && existing.planId === planId) {
      // 같은 plan 셀 → 해제
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

    // 신규 배정
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

  // 합계
  const totalRequired = plans.reduce((a, p) => a + p.requiredMD, 0);
  const totalAssigned = plans.reduce((a, p) => a + p.assignments.length, 0);
  const totalBudget = plans.reduce((a, p) => a + Number(p.consultingBudget), 0);

  return (
    <div className="px-3 py-4 max-w-[1800px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">프로젝트 관리 ▸ 컨설턴트 MD</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{year}년 컨설턴트 MD 플래너</h1>
          <p className="text-sm text-slate-500 mt-1">
            컨설턴트 <strong className="text-slate-700">{consultants.length}명</strong> · 사업{" "}
            <strong className="text-slate-700">{plans.length}건</strong> · MD{" "}
            <strong className="text-emerald-600">{totalAssigned}</strong>/
            <strong className="text-slate-700">{totalRequired}</strong> · 컨설팅 합계{" "}
            <strong className="text-slate-700">{fmtKRWShort(totalBudget)}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-md flex items-center gap-1.5"
          >
            가용 MD 기간 설정
          </button>
          <button
            onClick={() => setShowPlanForm(true)}
            className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> 사업 추가
          </button>
        </div>
      </div>

      {/* 가용 MD 기간 설정 */}
      {showSetup && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-600 font-medium">가용 MD 기간:</span>
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
            <span className="text-[12px] text-slate-700">
              = <strong className="text-brand-700">{availableMD}일</strong> (평일 기준)
            </span>
            <button
              onClick={() => setShowSetup(false)}
              className="ml-auto text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 컨설턴트별 요약 패널 (Sheet1 같은) */}
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

      {/* 월 탭 */}
      <div className="flex items-center gap-1 mb-2 border-b border-slate-200">
        {MONTHS.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMonth(m)}
            className={clsx(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition",
              activeMonth === m
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {m}월
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          셀 클릭 = 배정 토글 · 같은 컨설턴트의 같은 날짜 중복 자동 차단
        </span>
      </div>

      {/* 계층형 그리드 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <HierarchicalGrid
            year={year}
            month={activeMonth}
            consultants={consultants}
            plansByConsultant={plansByConsultant}
            unassignedPlans={unassignedPlans}
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
  stats: Map<string, { assignedMD: number; cost: number }>;
  availableMD: number;
}) {
  if (consultants.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3 text-sm text-amber-800 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        등록된 컨설턴트가 없습니다. 직원관리에서 컨설턴트 등급/일단가를 설정하세요.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm overflow-x-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-slate-500 text-[10.5px] border-b border-slate-200">
            <th className="text-left px-2 py-1.5 w-24">컨설턴트</th>
            <th className="text-left px-2 py-1.5 w-16">등급</th>
            <th className="text-right px-2 py-1.5 w-24">일단가</th>
            <th className="text-right px-2 py-1.5 w-20">배정 MD</th>
            <th className="text-right px-2 py-1.5 w-20">가용 MD</th>
            <th className="text-right px-2 py-1.5 w-28">배정 비용</th>
            <th className="text-right px-2 py-1.5 w-32">신청 가능 비용</th>
            <th className="px-2 py-1.5">진행도</th>
          </tr>
        </thead>
        <tbody>
          {consultants.map((c) => {
            const stat = stats.get(c.id) ?? { assignedMD: 0, cost: 0 };
            const remaining = Math.max(0, availableMD - stat.assignedMD);
            const rate = Number(c.consultantRate ?? 0);
            const remainingBudget = remaining * rate;
            const pct = availableMD > 0 ? Math.min(100, (stat.assignedMD / availableMD) * 100) : 0;
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
                  <strong className="text-emerald-600">{stat.assignedMD}</strong>
                  <span className="text-slate-400"> / {availableMD}</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{remaining}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmtKRW(stat.cost)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-brand-700 font-semibold">
                  {fmtKRW(remainingBudget)}
                </td>
                <td className="px-2 py-1.5 w-32">
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

/* ─────────── 계층형 그리드 ─────────── */

function HierarchicalGrid({
  year,
  month,
  consultants,
  plansByConsultant,
  unassignedPlans,
  cellMap,
  stats,
  onToggleCell,
  onDeletePlan,
}: {
  year: number;
  month: number;
  consultants: User[];
  plansByConsultant: Map<string, Plan[]>;
  unassignedPlans: Plan[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  stats: Map<string, { assignedMD: number; cost: number }>;
  onToggleCell: (planId: string, consultantId: string, day: number) => void;
  onDeletePlan: (id: string) => void;
}) {
  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  return (
    <table className="text-[11px] border-collapse w-full">
      <thead className="bg-slate-50 sticky top-0 z-20">
        <tr>
          <th className="w-16 text-left px-2 py-1.5 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-30 text-[10px]">
            #
          </th>
          <th className="w-36 text-left px-2 py-1.5 border-b border-r border-slate-200 sticky left-16 bg-slate-50 z-30">
            업체/사업명
          </th>
          <th className="w-20 text-right px-2 py-1.5 border-b border-r border-slate-200 sticky left-[208px] bg-slate-50 z-30">
            서비스금액
          </th>
          <th className="w-12 text-center px-1 py-1.5 border-b border-r border-slate-200">필요</th>
          <th className="w-12 text-center px-1 py-1.5 border-b border-r border-slate-200">배정</th>
          {days.map((d) => {
            const date = buildDate(year, month, d);
            const we = isWeekend(date);
            const dow = "일월화수목금토"[date.getDay()];
            return (
              <th
                key={d}
                className={clsx(
                  "w-7 text-center px-0 py-1 border-b border-r border-slate-200 font-medium tabular-nums",
                  we ? "bg-slate-200/60 text-slate-400" : "text-slate-600"
                )}
              >
                <div className="text-[10px]">{d}</div>
                <div className={clsx("text-[8px]", we ? "text-rose-400" : "text-slate-400")}>{dow}</div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {consultants.map((c) => {
          const plans = plansByConsultant.get(c.id) ?? [];
          const stat = stats.get(c.id) ?? { assignedMD: 0, cost: 0 };
          return (
            <ConsultantGroup
              key={c.id}
              year={year}
              month={month}
              consultant={c}
              plans={plans}
              stat={stat}
              days={days}
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
                colSpan={5 + dim}
                className="px-2 py-1.5 border-b border-slate-200 bg-amber-50 text-[11px] text-amber-800 font-medium sticky left-0"
              >
                ⚠ 미배정 사업 (담당자가 컨설턴트가 아님)
              </td>
            </tr>
            {unassignedPlans.map((p) => (
              <PlanRow
                key={p.id}
                year={year}
                month={month}
                plan={p}
                consultantId={null}
                days={days}
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
  year,
  month,
  consultant,
  plans,
  stat,
  days,
  cellMap,
  onToggleCell,
  onDeletePlan,
}: {
  year: number;
  month: number;
  consultant: User;
  plans: Plan[];
  stat: { assignedMD: number; cost: number };
  days: number[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  onToggleCell: (planId: string, consultantId: string, day: number) => void;
  onDeletePlan: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <>
      {/* 컨설턴트 헤더 행 */}
      <tr className="bg-brand-50/50 border-b-2 border-brand-200">
        <td className="px-2 py-1.5 border-r border-slate-200 sticky left-0 bg-brand-50 z-10">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-500 hover:text-slate-800"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td
          colSpan={2}
          className="px-2 py-1.5 border-r border-slate-200 sticky left-16 bg-brand-50 z-10"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[12.5px] text-slate-800">{consultant.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-brand-700 font-medium ring-1 ring-brand-200">
              {consultant.consultantGrade}
            </span>
            <span className="text-[10px] text-slate-500">{fmtKRW(consultant.consultantRate)}/일</span>
          </div>
        </td>
        <td className="px-1 py-1.5 border-r border-slate-200 text-center tabular-nums text-[11px] font-semibold text-slate-700">
          {plans.reduce((a, p) => a + p.requiredMD, 0)}
        </td>
        <td className="px-1 py-1.5 border-r border-slate-200 text-center tabular-nums text-[11px] font-semibold text-emerald-700">
          {stat.assignedMD}
        </td>
        {days.map((d) => (
          <td key={d} className="border-r border-slate-100 bg-brand-50/30" />
        ))}
      </tr>
      {/* 사업 행들 */}
      {expanded &&
        plans.map((p, i) => (
          <PlanRow
            key={p.id}
            year={year}
            month={month}
            plan={p}
            consultantId={consultant.id}
            days={days}
            cellMap={cellMap}
            onToggleCell={onToggleCell}
            onDeletePlan={onDeletePlan}
            indent
            seq={i + 1}
          />
        ))}
      {expanded && plans.length === 0 && (
        <tr>
          <td colSpan={5} className="px-2 py-1 border-b border-slate-100 sticky left-0 bg-white">
            <span className="text-[10.5px] text-slate-400 italic ml-4">배정 사업 없음</span>
          </td>
          {days.map((d) => (
            <td key={d} className="border-r border-b border-slate-100" />
          ))}
        </tr>
      )}
    </>
  );
}

function PlanRow({
  year,
  month,
  plan,
  consultantId,
  days,
  cellMap,
  onToggleCell,
  onDeletePlan,
  indent,
  seq,
}: {
  year: number;
  month: number;
  plan: Plan;
  consultantId: string | null;
  days: number[];
  cellMap: Map<string, { planId: string; assignmentId: string }>;
  onToggleCell: (planId: string, consultantId: string, day: number) => void;
  onDeletePlan: (id: string) => void;
  indent: boolean;
  seq?: number;
}) {
  const remaining = Math.max(0, plan.requiredMD - plan.assignments.length);
  return (
    <tr className="group/row border-b border-slate-100 hover:bg-slate-50/40">
      <td className="px-2 py-1 border-r border-slate-200 sticky left-0 bg-white group-hover/row:bg-slate-50/40 z-10 font-mono text-[10px] text-slate-400 tabular-nums text-center">
        {seq ?? "—"}
      </td>
      <td
        className={clsx(
          "px-2 py-1 border-r border-slate-200 sticky left-16 bg-white group-hover/row:bg-slate-50/40 z-10",
          indent && "pl-5"
        )}
      >
        <div className="flex items-center gap-1">
          <span className="text-[12px] text-slate-800 truncate">{plan.title}</span>
          <button
            onClick={() => onDeletePlan(plan.id)}
            className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-rose-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        {plan.project && (
          <div className="text-[9px] text-slate-400 truncate">
            {plan.project.displayCode ?? ""} {plan.project.title}
          </div>
        )}
      </td>
      <td className="px-2 py-1 border-r border-slate-200 sticky left-[208px] bg-white group-hover/row:bg-slate-50/40 z-10 text-right tabular-nums text-[11px] text-slate-700">
        {fmtKRWShort(plan.consultingBudget)}
      </td>
      <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums text-[11px]">
        {plan.requiredMD}
      </td>
      <td className="px-1 py-1 border-r border-slate-200 text-center tabular-nums">
        <span className={clsx("text-[11px] font-medium", remaining === 0 ? "text-emerald-600" : "text-slate-700")}>
          {plan.assignments.length}
        </span>
        {remaining > 0 && <span className="text-[9px] text-rose-500 ml-0.5">-{remaining}</span>}
        {remaining === 0 && plan.requiredMD > 0 && (
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 inline ml-0.5" />
        )}
      </td>
      {days.map((d) => {
        const date = buildDate(year, month, d);
        const we = isWeekend(date);
        const dk = dateKey(date);
        const isAssigned = consultantId
          ? cellMap.get(`${consultantId}::${dk}`)?.planId === plan.id
          : false;
        const otherAssigned = consultantId
          ? !!cellMap.get(`${consultantId}::${dk}`) && !isAssigned
          : false;
        return (
          <td
            key={d}
            className={clsx(
              "w-7 h-7 border-r border-slate-100 text-center align-middle p-0",
              we ? "bg-slate-100/50" : "bg-white",
              !we && consultantId && "hover:bg-brand-50 cursor-pointer",
              !consultantId && "cursor-not-allowed bg-slate-50"
            )}
            onClick={() => !we && consultantId && onToggleCell(plan.id, consultantId, d)}
            title={
              !consultantId
                ? "컨설턴트 미지정 (사업 담당자를 컨설턴트로 설정 필요)"
                : we
                  ? "주말"
                  : isAssigned
                    ? "클릭하여 해제"
                    : otherAssigned
                      ? "다른 사업에 배정됨"
                      : "클릭하여 배정"
            }
          >
            {isAssigned && (
              <div className="mx-auto w-5 h-5 bg-brand-500 text-white text-[10px] font-bold rounded flex items-center justify-center">
                1
              </div>
            )}
            {otherAssigned && (
              <div className="mx-auto w-5 h-5 bg-slate-200 text-slate-400 text-[9px] rounded flex items-center justify-center">
                ·
              </div>
            )}
          </td>
        );
      })}
    </tr>
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

  // 담당 컨설턴트의 일단가 가져오기 (managerId가 컨설턴트면 그 단가, 아니면 100만원 default)
  const manager = users.find((u) => u.id === managerId);
  const rate = manager?.consultantGrade ? Number(manager.consultantRate) : 1000000;
  const budget = Number(budgetStr || 0);
  const requiredMD = rate > 0 ? Math.floor(budget / rate) : 0;

  // VAT 제외 (10% 가정)
  const vatExcluded = Math.floor(budget / 1.1);
  // 소요 비용 = MD * 일단가
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
          <div className="text-[10px] text-slate-500">VAT 제외 (1/1.1)</div>
          <div className="text-base font-semibold tabular-nums text-slate-700">{fmtKRWShort(vatExcluded)}</div>
        </div>
        <div className="bg-brand-50 border border-brand-200 rounded px-3 py-2">
          <div className="text-[10px] text-brand-700">필요 MD (자동, 담당자 일단가 기준)</div>
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
