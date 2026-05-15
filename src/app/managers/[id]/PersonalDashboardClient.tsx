"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarDays,
  Target,
  CheckCircle2,
  Clock3,
  Circle,
  Pencil,
} from "lucide-react";
import clsx from "clsx";

type WeeklyTask = {
  id: string;
  userId: string;
  date: string;
  category: string | null;
  priority: string | null;
  status: string;
  title: string;
  progress: number;
  notes: string | null;
  completed: boolean;
  sortOrder: number;
};

type Project = {
  id: string;
  title: string;
  displayCode: string | null;
  bizCategory: string;
  status: string;
  midReportDate: string | null;
  midReportYn: boolean;
  finalReportDate: string | null;
  finalReportYn: boolean;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PRIORITY_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  high: { label: "높음", dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700" },
  medium: { label: "중간", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  low: { label: "낮음", dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600" },
};

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  not_started: { label: "시작 전", dot: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-600" },
  in_progress: { label: "진행 중", dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  review: { label: "검토중", dot: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700" },
  done: { label: "완료", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
};

function fmtDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function fmtShort(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a: Date | string, b: Date | string): boolean {
  const x = typeof a === "string" ? new Date(a) : a;
  const y = typeof b === "string" ? new Date(b) : b;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export default function PersonalDashboardClient({
  userId,
  isOwner,
  isAdmin,
  canSeeWeeklyPlanner,
  weekStartISO,
  initialTasks,
  projects,
}: {
  userId: string;
  isOwner: boolean;
  isAdmin: boolean;
  canSeeWeeklyPlanner: boolean;
  weekStartISO: string;
  initialTasks: WeeklyTask[];
  projects: Project[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<WeeklyTask[]>(initialTasks);
  const [, startTransition] = useTransition();

  const weekStart = new Date(weekStartISO);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // 통계
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed || t.status === "done").length;
    const inProg = tasks.filter((t) => !t.completed && t.status === "in_progress").length;
    const notStarted = tasks.filter((t) => !t.completed && t.status === "not_started").length;
    const review = tasks.filter((t) => !t.completed && t.status === "review").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProg, notStarted, review, pct };
  }, [tasks]);

  function navWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    router.push(`/managers/${userId}?week=${fmtDate(d)}`);
  }
  function gotoToday() {
    router.push(`/managers/${userId}?week=${fmtDate(new Date())}`);
  }

  async function addTask(dateISO: string) {
    if (!canSeeWeeklyPlanner) return;
    const res = await fetch(`/api/weekly-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date: dateISO, title: "", status: "not_started" }),
    });
    if (!res.ok) return;
    const created: WeeklyTask = await res.json();
    setTasks((prev) => [...prev, created]);
  }

  function patchTask(id: string, patch: Partial<WeeklyTask>) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
    startTransition(async () => {
      const res = await fetch(`/api/weekly-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
      }
    });
  }

  function delTask(id: string) {
    if (!confirm("이 업무를 삭제할까요?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await fetch(`/api/weekly-tasks/${id}`, { method: "DELETE" });
    });
  }

  // 정렬: 날짜 → sortOrder
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (d !== 0) return d;
      return a.sortOrder - b.sortOrder;
    }),
    [tasks]
  );

  // 오늘 표시
  const today = new Date();

  return (
    <div className="space-y-6">
      {/* 담당 프로젝트 요약 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-brand-500" /> 담당 프로젝트 ({projects.length}건)
          </h2>
        </div>
        {projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
            올해 담당 프로젝트가 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {projects.slice(0, 12).map((p) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-brand-300 transition">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {p.displayCode && (
                    <span className="font-mono text-[10px] text-slate-400">{p.displayCode}</span>
                  )}
                  <span className="font-medium text-slate-800 truncate">{p.title}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500">
                  <span>{p.bizCategory}</span>
                  <span>·</span>
                  <span>{p.status}</span>
                </div>
              </div>
            ))}
            {projects.length > 12 && (
              <div className="text-[11px] text-slate-400 self-center px-3">… 외 {projects.length - 12}건</div>
            )}
          </div>
        )}
      </section>

      {/* 위클리 플래너 (본인/admin 만) */}
      {!canSeeWeeklyPlanner ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
          🔒 주간 플래너는 본인만 열람할 수 있습니다.
        </div>
      ) : (
        <>
          {/* 상단 컨트롤 + 통계 */}
          <section className="bg-white border border-slate-200 rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-brand-500" />
                <h2 className="text-base font-semibold tracking-tight">Weekly Planner</h2>
                {!isOwner && isAdmin && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-1.5 py-0.5 rounded">
                    관리자 보기
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => navWeek(-1)} className="h-8 w-8 inline-flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="text-[12px] font-semibold tabular-nums px-2 min-w-[140px] text-center">
                  {fmtShort(days[0])} – {fmtShort(days[6])}
                </div>
                <button onClick={() => navWeek(1)} className="h-8 w-8 inline-flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={gotoToday} className="h-8 px-2.5 text-[11px] bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded ml-1">
                  오늘
                </button>
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <StatCard label="전체" value={stats.total} color="slate" />
              <StatCard label="시작 전" value={stats.notStarted} color="slate" />
              <StatCard label="진행 중" value={stats.inProg} color="blue" />
              <StatCard label="완료" value={stats.done} color="emerald" />
              <StatCard label="완료율" value={`${stats.pct}%`} color="amber" />
            </div>

            {/* 주간 달력 그리드 */}
            <div className="grid grid-cols-7 gap-1 border-t border-slate-200 pt-3">
              {days.map((d, i) => {
                const dayTasks = sortedTasks.filter((t) => sameDay(t.date, d));
                const isToday = sameDay(d, today);
                const isWeekend = i === 0 || i === 6;
                return (
                  <div
                    key={i}
                    className={clsx(
                      "rounded-lg p-1.5 min-h-[120px] border",
                      isToday ? "bg-amber-50 border-amber-300" : "bg-slate-50/40 border-slate-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={clsx("text-[10px] font-semibold", isWeekend && !isToday && "text-rose-500")}>
                        {WEEKDAYS[i]}{" "}
                        <span className="text-[10.5px] text-slate-700 tabular-nums">
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                      </div>
                      <button
                        onClick={() => addTask(fmtDate(d))}
                        className="w-4 h-4 rounded bg-white border border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-300 inline-flex items-center justify-center"
                        title="이 날짜에 새 업무"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <ul className="space-y-0.5">
                      {dayTasks.map((t) => {
                        const isDone = t.completed || t.status === "done";
                        const sm = STATUS_META[t.status] ?? STATUS_META.not_started;
                        return (
                          <li
                            key={t.id}
                            className={clsx(
                              "text-[10.5px] leading-tight px-1 py-0.5 rounded flex items-center gap-1",
                              isDone ? "text-slate-400 line-through" : "text-slate-700"
                            )}
                            title={t.title}
                          >
                            <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", sm.dot)} />
                            <span className="truncate">{t.title || "(빈 업무)"}</span>
                          </li>
                        );
                      })}
                      {dayTasks.length === 0 && (
                        <li className="text-[10px] text-slate-300 px-1 py-1">—</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 업무 리스트 (편집 가능) */}
          <section className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-slate-500" /> 이번 주 업무 리스트
              </h2>
              <button
                onClick={() => addTask(fmtDate(today))}
                className="h-7 px-2.5 text-[11px] bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> 새 업무 (오늘)
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-[11.5px]">
                <thead className="bg-slate-50 text-[10.5px] text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-center w-16 px-2 py-2">완료</th>
                    <th className="text-center w-28 px-2 py-2">날짜</th>
                    <th className="text-center w-28 px-2 py-2">카테고리</th>
                    <th className="text-center w-20 px-2 py-2">우선순위</th>
                    <th className="text-center w-24 px-2 py-2">상태</th>
                    <th className="text-left px-3 py-2">업무</th>
                    <th className="text-center w-20 px-2 py-2">진행률</th>
                    <th className="text-left w-40 px-3 py-2">비고</th>
                    <th className="text-center w-10 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                        이번 주 등록된 업무가 없습니다. 달력의 + 버튼 또는 우측 상단 [새 업무] 로 추가하세요.
                      </td>
                    </tr>
                  ) : (
                    sortedTasks.map((t) => (
                      <TaskRow key={t.id} task={t} onPatch={(p) => patchTask(t.id, p)} onDelete={() => delTask(t.id)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ─────────────────────── Subcomponents ─────────────────────── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "slate" | "blue" | "emerald" | "amber" | "rose";
}) {
  const c = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  }[color];
  return (
    <div className={clsx("border rounded-lg px-3 py-2", c)}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function TaskRow({
  task,
  onPatch,
  onDelete,
}: {
  task: WeeklyTask;
  onPatch: (patch: Partial<WeeklyTask>) => void;
  onDelete: () => void;
}) {
  const isDone = task.completed || task.status === "done";
  const sm = STATUS_META[task.status] ?? STATUS_META.not_started;
  const pm = task.priority ? PRIORITY_META[task.priority] : null;
  return (
    <tr className={clsx("border-b border-slate-100 hover:bg-slate-50/40", isDone && "bg-slate-50/40")}>
      <td className="text-center px-2 py-1.5">
        <button
          onClick={() => onPatch({ completed: !task.completed, status: !task.completed ? "done" : "in_progress" })}
          className={clsx(
            "w-5 h-5 rounded inline-flex items-center justify-center transition",
            isDone ? "bg-emerald-500 text-white" : "bg-white border border-slate-300 text-slate-400 hover:border-emerald-400"
          )}
          title="완료 토글"
        >
          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
        </button>
      </td>
      <td className="text-center px-2 py-1.5 tabular-nums text-[11px] text-slate-600 font-mono">
        <input
          type="date"
          value={fmtDate(task.date)}
          onChange={(e) => onPatch({ date: e.target.value })}
          className="w-full text-center text-[11px] bg-transparent focus:bg-white focus:ring-1 focus:ring-brand-200 outline-none rounded px-0.5"
        />
      </td>
      <td className="text-center px-2 py-1.5">
        <InlineText
          value={task.category ?? ""}
          onSave={(v) => onPatch({ category: v || null })}
          placeholder="—"
          className="text-[11px] text-slate-600 text-center"
        />
      </td>
      <td className="text-center px-2 py-1.5">
        <SelectBadge
          value={task.priority ?? ""}
          options={[
            { value: "", label: "—" },
            { value: "high", label: "높음" },
            { value: "medium", label: "중간" },
            { value: "low", label: "낮음" },
          ]}
          onChange={(v) => onPatch({ priority: v || null })}
          color={pm ? `${pm.bg} ${pm.text}` : "bg-slate-50 text-slate-500"}
        />
      </td>
      <td className="text-center px-2 py-1.5">
        <SelectBadge
          value={task.status}
          options={[
            { value: "not_started", label: "시작 전" },
            { value: "in_progress", label: "진행 중" },
            { value: "review", label: "검토중" },
            { value: "done", label: "완료" },
          ]}
          onChange={(v) => onPatch({ status: v, completed: v === "done" })}
          color={`${sm.bg} ${sm.text}`}
        />
      </td>
      <td className="px-3 py-1.5">
        <InlineText
          value={task.title}
          onSave={(v) => onPatch({ title: v })}
          placeholder="업무명 입력..."
          className={clsx("text-[11.5px]", isDone ? "text-slate-400 line-through" : "text-slate-800")}
        />
      </td>
      <td className="text-center px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={task.progress}
            onChange={(e) => onPatch({ progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className="w-10 text-right text-[11px] tabular-nums bg-transparent focus:bg-white focus:ring-1 focus:ring-brand-200 outline-none rounded"
          />
          <span className="text-[10px] text-slate-400">%</span>
        </div>
        {task.progress > 0 && (
          <div className="h-1 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={clsx("h-full", task.progress >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${task.progress}%` }} />
          </div>
        )}
      </td>
      <td className="px-3 py-1.5">
        <InlineText
          value={task.notes ?? ""}
          onSave={(v) => onPatch({ notes: v || null })}
          placeholder="—"
          className="text-[11px] text-slate-500"
        />
      </td>
      <td className="text-center px-1 py-1.5">
        <button
          onClick={onDelete}
          className="w-5 h-5 rounded inline-flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50"
          title="삭제"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (v !== value) onSave(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          }
        }}
        className={clsx("w-full bg-white ring-1 ring-brand-200 outline-none rounded px-1 py-0.5", className)}
      />
    );
  }
  return (
    <div
      onClick={() => setEditing(true)}
      className={clsx("cursor-text px-1 py-0.5 rounded hover:bg-slate-50 truncate", className)}
    >
      {value || <span className="text-slate-300">{placeholder ?? "—"}</span>}
    </div>
  );
}

function SelectBadge({
  value,
  options,
  onChange,
  color,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        "text-[10.5px] px-1.5 py-0.5 rounded border border-transparent cursor-pointer outline-none focus:ring-1 focus:ring-brand-200 appearance-none",
        color
      )}
      style={{ minWidth: 0 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
