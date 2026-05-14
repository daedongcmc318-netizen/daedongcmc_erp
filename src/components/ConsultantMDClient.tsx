"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Users as UsersIcon,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";

type User = {
  id: string;
  name: string;
  dept: string;
  position: string;
  isInternal: boolean;
  pmCode: string | null;
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
const PLAN_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-emerald-100 text-emerald-800 border-emerald-300",
  "bg-violet-100 text-violet-800 border-violet-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-cyan-100 text-cyan-800 border-cyan-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-pink-100 text-pink-800 border-pink-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-teal-100 text-teal-800 border-teal-300",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  "bg-lime-100 text-lime-800 border-lime-300",
];

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
  return d.toISOString().slice(0, 10);
}

function buildDate(year: number, month1: number, day: number): Date {
  // Local time → UTC ISO에서 date만 사용. 시간차 회피 위해 noon으로
  return new Date(year, month1 - 1, day, 12, 0, 0);
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
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);

  // 컨설턴트 풀 — 내부직원 우선, 그 외 직원도 선택 가능 (안내 메시지로 구분)
  const consultantPool = useMemo(() => users.filter((u) => u.isInternal), [users]);
  // 추가 컨설턴트 (이번 세션에서 사용된 비-내부 직원)
  const [extraConsultantIds, setExtraConsultantIds] = useState<Set<string>>(new Set());
  const consultants = useMemo(() => {
    const set = new Set<string>(consultantPool.map((u) => u.id));
    const extra = Array.from(extraConsultantIds)
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u && !set.has(u.id));
    return [...consultantPool, ...extra];
  }, [consultantPool, extraConsultantIds, users]);

  // plan별 색상 매핑
  const planColorMap = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p, i) => m.set(p.id, PLAN_COLORS[i % PLAN_COLORS.length]));
    return m;
  }, [plans]);

  // 배정 인덱스: consultantId + dateKey → assignment with planId
  const assignmentsByCell = useMemo(() => {
    const m = new Map<string, { planId: string; assignmentId: string }>();
    for (const p of plans) {
      for (const a of p.assignments) {
        const key = `${a.consultantId}::${a.date.slice(0, 10)}`;
        m.set(key, { planId: p.id, assignmentId: a.id });
      }
    }
    return m;
  }, [plans]);

  // plan별 배정 카운트
  const planAssignedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plans) m.set(p.id, p.assignments.length);
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
    setActivePlanId(created.id);
    setShowPlanForm(false);
  }

  async function updatePlan(id: string, patch: Record<string, any>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const res = await fetch(`/api/consultant-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, recalcMD: true }),
    });
    if (!res.ok) {
      alert("수정 실패");
      router.refresh();
      return;
    }
    const updated = await res.json();
    setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  async function deletePlan(id: string) {
    if (!confirm("이 사업과 모든 배정을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/consultant-plans/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (activePlanId === id) setActivePlanId(null);
  }

  // ─── 셀 클릭 = 배정 추가/제거 ───
  async function handleCellClick(consultantId: string, day: number) {
    const date = buildDate(year, activeMonth, day);
    if (isWeekend(date)) return;

    const key = `${consultantId}::${dateKey(date)}`;
    const existing = assignmentsByCell.get(key);

    if (existing) {
      // 같은 셀 클릭 → 해제
      const res = await fetch(`/api/consultant-assignments/${existing.assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("해제 실패");
        return;
      }
      // 옵티미스틱 업데이트
      setPlans((prev) =>
        prev.map((p) =>
          p.id === existing.planId
            ? { ...p, assignments: p.assignments.filter((a) => a.id !== existing.assignmentId) }
            : p
        )
      );
      return;
    }

    // 새 배정 — activePlanId 필요
    if (!activePlanId) {
      alert("배정할 사업을 먼저 선택하세요 (상단 카드 클릭)");
      return;
    }

    const res = await fetch("/api/consultant-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: activePlanId,
        consultantId,
        date: dateKey(date),
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "배정 실패");
      return;
    }
    const created = await res.json();
    setPlans((prev) =>
      prev.map((p) =>
        p.id === activePlanId
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

  function addExtraConsultant(userId: string) {
    setExtraConsultantIds((prev) => new Set(prev).add(userId));
  }

  function removeExtraConsultant(userId: string) {
    setExtraConsultantIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }

  // 사업영역 통계
  const totalBudget = plans.reduce((acc, p) => acc + Number(p.consultingBudget), 0);
  const totalRequiredMD = plans.reduce((acc, p) => acc + p.requiredMD, 0);
  const totalAssignedMD = plans.reduce((acc, p) => acc + p.assignments.length, 0);

  return (
    <div className="px-3 py-4 max-w-[1700px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">프로젝트 관리 ▸ 컨설턴트 MD</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{year}년 컨설턴트 MD 플래너</h1>
          <p className="text-sm text-slate-500 mt-1">
            사업 <strong className="text-slate-700">{plans.length}건</strong> · 컨설팅 합계{" "}
            <strong className="text-slate-700">{fmtKRW(totalBudget)}</strong> · MD{" "}
            <strong className="text-emerald-600">{totalAssignedMD}</strong>/
            <strong className="text-slate-700">{totalRequiredMD}</strong> 배정
          </p>
        </div>
        <button
          onClick={() => setShowPlanForm(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 사업 추가
        </button>
      </div>

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

      {/* 사업 카드 — activePlanId 선택 */}
      <div className="mb-4">
        <div className="text-[11px] text-slate-500 mb-2 font-medium">
          📋 사업 목록 — 카드 클릭 후 그리드 셀을 클릭하면 배정됩니다
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {plans.length === 0 ? (
            <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-400">
              사업이 없습니다. <button onClick={() => setShowPlanForm(true)} className="text-brand-600 hover:underline">신규 사업 추가</button>
            </div>
          ) : (
            plans.map((p) => {
              const assigned = planAssignedCount.get(p.id) ?? 0;
              const remaining = Math.max(0, p.requiredMD - assigned);
              const pct = p.requiredMD > 0 ? Math.min(100, (assigned / p.requiredMD) * 100) : 0;
              const isActive = activePlanId === p.id;
              const color = planColorMap.get(p.id) ?? PLAN_COLORS[0];
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlanId(isActive ? null : p.id)}
                  className={clsx(
                    "text-left rounded-xl border-2 p-3 transition shadow-sm group/plan",
                    isActive ? `${color} shadow-md ring-2 ring-offset-1 ring-brand-300` : "bg-white border-slate-200 hover:border-brand-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold truncate">{p.title}</div>
                      {p.project && (
                        <div className="text-[9.5px] text-slate-500 truncate">
                          {p.project.displayCode && (
                            <span className="font-mono mr-1">{p.project.displayCode}</span>
                          )}
                          {p.project.title}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlan(p.id);
                      }}
                      className="opacity-0 group-hover/plan:opacity-100 text-slate-300 hover:text-rose-500 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mb-1.5">
                    <span>{fmtKRWShort(p.consultingBudget)}</span>
                    <span>·</span>
                    <span>{Number(p.dailyRate) / 10000}만/일</span>
                    {p.manager && (
                      <>
                        <span>·</span>
                        <span className="truncate">담당 {p.manager.name}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-mono tabular-nums">
                      <strong className={remaining === 0 ? "text-emerald-600" : "text-slate-700"}>
                        {assigned}
                      </strong>
                      <span className="text-slate-400"> / {p.requiredMD}MD</span>
                    </span>
                    {remaining === 0 ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] text-rose-600 font-medium">잔여 {remaining}</span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={clsx("h-full transition-all", remaining === 0 ? "bg-emerald-500" : "bg-brand-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 월 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
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
          {activePlanId ? (
            <span className="text-brand-600 font-medium">
              ▸ '{plans.find((p) => p.id === activePlanId)?.title}' 사업 배정 중 (셀 클릭)
            </span>
          ) : (
            "사업 카드 선택 후 셀 클릭"
          )}
        </span>
      </div>

      {/* 캘린더 그리드 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-450px)]">
          <CalendarGrid
            year={year}
            month={activeMonth}
            consultants={consultants}
            assignmentsByCell={assignmentsByCell}
            plansById={new Map(plans.map((p) => [p.id, p]))}
            planColorMap={planColorMap}
            onCellClick={handleCellClick}
            onRemoveExtraConsultant={removeExtraConsultant}
            consultantPoolIds={new Set(consultantPool.map((u) => u.id))}
          />
        </div>
        {/* 추가 컨설턴트 (행 추가) */}
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center gap-2">
          <span className="text-[11px] text-slate-500">행 추가:</span>
          <ConsultantPicker
            users={users}
            excludeIds={new Set(consultants.map((c) => c.id))}
            onPick={addExtraConsultant}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────── 캘린더 그리드 ─────────── */

function CalendarGrid({
  year,
  month,
  consultants,
  assignmentsByCell,
  plansById,
  planColorMap,
  onCellClick,
  onRemoveExtraConsultant,
  consultantPoolIds,
}: {
  year: number;
  month: number;
  consultants: User[];
  assignmentsByCell: Map<string, { planId: string; assignmentId: string }>;
  plansById: Map<string, Plan>;
  planColorMap: Map<string, string>;
  onCellClick: (consultantId: string, day: number) => void;
  onRemoveExtraConsultant: (userId: string) => void;
  consultantPoolIds: Set<string>;
}) {
  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  return (
    <table className="text-[11px] border-collapse w-full table-fixed">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr>
          <th className="w-44 text-left px-2 py-1.5 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-20">
            컨설턴트
          </th>
          {days.map((d) => {
            const date = buildDate(year, month, d);
            const we = isWeekend(date);
            const dow = "일월화수목금토"[date.getDay()];
            return (
              <th
                key={d}
                className={clsx(
                  "w-9 text-center px-0 py-1 border-b border-r border-slate-200 font-medium tabular-nums",
                  we ? "bg-slate-200/60 text-slate-400" : "text-slate-600"
                )}
              >
                <div>{d}</div>
                <div className={clsx("text-[8px] mt-0.5", we ? "text-rose-400" : "text-slate-400")}>{dow}</div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {consultants.length === 0 ? (
          <tr>
            <td colSpan={dim + 1} className="text-center py-12 text-sm text-slate-400">
              내부직원이 없습니다. 직원관리에서 내부직원으로 표시하거나, 아래 행 추가로 외부 직원을 포함하세요.
            </td>
          </tr>
        ) : (
          consultants.map((c) => {
            const isInternal = consultantPoolIds.has(c.id);
            return (
              <tr key={c.id} className="group/row">
                <td className="px-2 py-1.5 border-b border-r border-slate-200 sticky left-0 bg-white group-hover/row:bg-slate-50/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {c.name.slice(0, 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-800 truncate">
                        {c.name}
                        {!isInternal && (
                          <span className="ml-1 text-[9px] text-amber-600">외부</span>
                        )}
                      </div>
                      <div className="text-[9.5px] text-slate-400 truncate">{c.position}</div>
                    </div>
                    {!isInternal && (
                      <button
                        onClick={() => onRemoveExtraConsultant(c.id)}
                        className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-rose-500 shrink-0"
                        title="이 행 숨기기"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                {days.map((d) => {
                  const date = buildDate(year, month, d);
                  const we = isWeekend(date);
                  const key = `${c.id}::${dateKey(date)}`;
                  const assignment = assignmentsByCell.get(key);
                  const plan = assignment ? plansById.get(assignment.planId) : null;
                  const color = plan ? planColorMap.get(plan.id) : null;
                  return (
                    <td
                      key={d}
                      className={clsx(
                        "w-9 h-9 px-0 py-0 border-b border-r border-slate-100 text-center align-middle",
                        we ? "bg-slate-100/50" : "bg-white hover:bg-brand-50 cursor-pointer"
                      )}
                      onClick={() => !we && onCellClick(c.id, d)}
                      title={plan ? `${plan.title}` : we ? "주말" : "클릭하여 배정"}
                    >
                      {plan && (
                        <div
                          className={clsx(
                            "mx-auto w-7 h-7 rounded text-[9px] font-semibold flex items-center justify-center border",
                            color
                          )}
                          title={plan.title}
                        >
                          {plan.title.slice(0, 2)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

/* ─────────── 사업(Plan) 신규 폼 ─────────── */

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
  const [budgetStr, setBudgetStr] = useState("10000000"); // 1천만
  const [rateStr, setRateStr] = useState("1000000"); // 일 100만
  const [saving, setSaving] = useState(false);

  const budget = Number(budgetStr || 0);
  const rate = Number(rateStr || 0);
  const requiredMD = rate > 0 ? Math.floor(budget / rate) : 0;

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
        <div className="md:col-span-1">
          <label className="text-[10px] text-slate-400">사업명</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: A업체 혁신컨설팅"
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
          <label className="text-[10px] text-slate-400">담당자 (내부직원)</label>
          <select
            value={managerId ?? ""}
            onChange={(e) => setManagerId(e.target.value || null)}
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 bg-white"
          >
            <option value="">— 미지정 —</option>
            {users
              .filter((u) => u.isInternal)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.position})
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">컨설팅 금액 (원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={budgetStr}
            onChange={(e) => setBudgetStr(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full h-8 px-2 text-[12px] text-right tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
          <div className="text-[10px] text-slate-400 mt-0.5 text-right">{fmtKRW(budget)}</div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">일 단가 (원)</label>
          <input
            type="text"
            inputMode="numeric"
            value={rateStr}
            onChange={(e) => setRateStr(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full h-8 px-2 text-[12px] text-right tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
          <div className="text-[10px] text-slate-400 mt-0.5 text-right">{fmtKRW(rate)}</div>
        </div>
        <div className="flex items-end">
          <div className="bg-brand-50 border border-brand-200 rounded px-3 py-2 w-full">
            <div className="text-[10px] text-brand-700">필요 MD (자동)</div>
            <div className="text-xl font-bold tabular-nums text-brand-700">
              {requiredMD}
              <span className="text-xs text-brand-500 ml-1">MD</span>
            </div>
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

/* ─────────── 컨설턴트 행 추가 picker ─────────── */

function ConsultantPicker({
  users,
  excludeIds,
  onPick,
}: {
  users: User[];
  excludeIds: Set<string>;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = users
    .filter((u) => !excludeIds.has(u.id))
    .filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.position.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-7 px-2 text-[11px] border border-slate-200 hover:border-brand-300 text-slate-600 hover:text-brand-700 rounded flex items-center gap-1 bg-white"
      >
        <Plus className="w-3 h-3" /> 직원 추가
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg p-2 max-h-72 overflow-auto">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름/직위 검색..."
                className="w-full h-7 pl-7 pr-2 text-[11px] border border-slate-200 rounded outline-none focus:border-brand-300"
              />
            </div>
            {filtered.length === 0 ? (
              <div className="text-[11px] text-slate-400 px-2 py-2">결과 없음</div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onPick(u.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-brand-50 rounded text-[11px] flex items-center justify-between"
                >
                  <span>
                    <strong className="text-slate-800">{u.name}</strong>
                    <span className="text-slate-400 ml-1.5">{u.position}</span>
                  </span>
                  {u.isInternal && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">
                      내부
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
