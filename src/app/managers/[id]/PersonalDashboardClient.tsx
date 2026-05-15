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
  Circle,
  Check,
  Pencil,
  ArrowRightCircle,
  X,
} from "lucide-react";
import clsx from "clsx";

type WeeklyTask = {
  id: string;
  userId: string;
  date: string;
  dueDate: string | null;
  category: string | null; // value (e.g. "innovation")
  priority: string | null;
  status: string;
  title: string;
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

type Category = { id: string; value: string; label: string; color: string | null };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PLANNER_DAYS = 5; // 월~금만 표시

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
  initialCategories,
}: {
  userId: string;
  isOwner: boolean;
  isAdmin: boolean;
  canSeeWeeklyPlanner: boolean;
  weekStartISO: string;
  initialTasks: WeeklyTask[];
  projects: Project[];
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<WeeklyTask[]>(initialTasks);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [, startTransition] = useTransition();
  const [showCatManager, setShowCatManager] = useState(false);

  const catByValue = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.value, c);
    return m;
  }, [categories]);

  // weekStart 는 월요일 (서버에서 보내준 값). 5일 (월~금) 만 표시
  const weekStart = new Date(weekStartISO);
  const days = Array.from({ length: PLANNER_DAYS }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // 통계 — 빈 placeholder (title 없음) 는 카운트 제외
  const stats = useMemo(() => {
    const realTasks = tasks.filter((t) => t.title.trim());
    const total = realTasks.length;
    const done = realTasks.filter((t) => t.completed || t.status === "done").length;
    const inProg = realTasks.filter((t) => !t.completed && t.status === "in_progress").length;
    const notStarted = realTasks.filter((t) => !t.completed && t.status === "not_started").length;
    const review = realTasks.filter((t) => !t.completed && t.status === "review").length;
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
    // 마감일자 기본값 = 오늘. 필요 시 row 에서 직접 수정.
    const todayISO = fmtDate(new Date());
    const res = await fetch(`/api/weekly-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        date: dateISO,
        dueDate: todayISO,
        title: "",
        status: "not_started",
      }),
    });
    if (!res.ok) return;
    const created: WeeklyTask = await res.json();
    setTasks((prev) => [...prev, created]);
  }

  function patchTask(id: string, patch: Partial<WeeklyTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
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

  /** 특정 날짜의 미완료 업무를 다음 영업일로 이관 */
  async function rolloverDay(dateISO: string) {
    if (!canSeeWeeklyPlanner) return;
    const dayTasks = tasks.filter(
      (t) => sameDay(t.date, dateISO) && !t.completed && t.status !== "done"
    );
    if (dayTasks.length === 0) {
      alert("이 날짜에 이관할 미완료 업무가 없습니다.");
      return;
    }
    if (!confirm(`${dayTasks.length}건을 다음 영업일로 이관할까요?`)) return;
    const res = await fetch(`/api/weekly-tasks/rollover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fromDate: dateISO }),
    });
    if (!res.ok) {
      alert("이관 실패");
      return;
    }
    router.refresh();
  }

  /** 오늘(또는 가장 가까운 과거 평일)의 미완료 업무 이관 — 헤더 버튼 */
  async function rolloverToday() {
    await rolloverDay(fmtDate(new Date()));
  }

  // 카테고리 추가/삭제
  async function addCategory(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.label === trimmed)) {
      alert("이미 같은 카테고리가 있습니다.");
      return;
    }
    const res = await fetch(`/api/dropdown-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "task_category", label: trimmed }),
    });
    if (!res.ok) {
      alert("카테고리 추가 실패");
      return;
    }
    const created: Category = await res.json();
    setCategories((prev) => [...prev, created]);
  }

  async function delCategory(id: string) {
    if (!confirm("이 카테고리를 삭제할까요? (기존 업무의 분류는 빈 값이 됩니다)")) return;
    const res = await fetch(`/api/dropdown-options/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const d = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (d !== 0) return d;
        return a.sortOrder - b.sortOrder;
      }),
    [tasks]
  );

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

      {!canSeeWeeklyPlanner ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
          🔒 주간 플래너는 본인만 열람할 수 있습니다.
        </div>
      ) : (
        <>
          {/* 상단 컨트롤 + 통계 + 캘린더 */}
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
                <button
                  onClick={rolloverToday}
                  className="h-8 px-2.5 text-[11px] bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded inline-flex items-center gap-1"
                  title="오늘의 미완료 업무를 다음 영업일로 이관"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5" /> 오늘 미완료 이관
                </button>
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

            {/* 주간 달력 그리드 (월~금 5일) */}
            <div className="grid grid-cols-5 gap-1 border-t border-slate-200 pt-3">
              {days.map((d, i) => {
                // 빈 placeholder (title 없는 행) 은 캘린더에 표시하지 않음
                const dayTasks = sortedTasks.filter((t) => sameDay(t.date, d) && t.title.trim());
                const undone = dayTasks.filter((t) => !t.completed && t.status !== "done");
                const isToday = sameDay(d, today);
                const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <div
                    key={i}
                    className={clsx(
                      "rounded-lg p-1.5 min-h-[120px] border",
                      isToday ? "bg-amber-50 border-amber-300" : "bg-slate-50/40 border-slate-100"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-semibold">
                        {WEEKDAYS[d.getDay()]}{" "}
                        <span className="text-[10.5px] text-slate-700 tabular-nums">
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {undone.length > 0 && (isPast || isToday) && (
                          <button
                            onClick={() => rolloverDay(fmtDate(d))}
                            className="w-4 h-4 rounded bg-white border border-amber-200 text-amber-600 hover:bg-amber-100 inline-flex items-center justify-center"
                            title={`이 날짜 미완료 ${undone.length}건 → 다음 영업일`}
                          >
                            <ArrowRightCircle className="w-2.5 h-2.5" />
                          </button>
                        )}
                        <button
                          onClick={() => addTask(fmtDate(d))}
                          className="w-4 h-4 rounded bg-white border border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-300 inline-flex items-center justify-center"
                          title="이 날짜에 새 업무"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {dayTasks.map((t) => {
                        const isDone = t.completed || t.status === "done";
                        const cat = t.category ? catByValue.get(t.category) : null;
                        const sm = STATUS_META[t.status] ?? STATUS_META.not_started;
                        return (
                          <li
                            key={t.id}
                            className={clsx(
                              "text-[10.5px] leading-tight px-1 py-0.5 rounded flex items-center gap-1",
                              isDone ? "text-slate-400" : "text-slate-700"
                            )}
                            title={t.title}
                          >
                            {cat ? (
                              <span className={clsx("text-[8.5px] px-1 py-px rounded ring-1 truncate shrink-0", cat.color)}>
                                {cat.label}
                              </span>
                            ) : (
                              <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", sm.dot)} />
                            )}
                            <span className="truncate">{t.title || "(빈 업무)"}</span>
                            {isDone && (
                              <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0 ml-auto" />
                            )}
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

          {/* 오늘 업무 리스트 (당일만 표시) */}
          {(() => {
            const todayTasksAll = sortedTasks.filter((t) => sameDay(t.date, today));
            // 빈 placeholder 행은 stats/카운트에서 제외, 표시는 항상 마지막에 한 줄
            const todayTasks = todayTasksAll.filter((t) => t.title.trim());
            const todayUndone = todayTasks.filter((t) => !t.completed && t.status !== "done");
            return (
              <section className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-slate-500" /> 오늘 업무 리스트
                    </h2>
                    <span className="text-[10.5px] text-slate-400 tabular-nums">
                      {fmtDate(today)} ({WEEKDAYS[today.getDay()]}) · {todayTasks.length}건
                      {todayUndone.length > 0 && (
                        <span className="ml-1 text-amber-700">미완료 {todayUndone.length}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowCatManager((v) => !v)}
                      className="h-7 px-2.5 text-[11px] bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded inline-flex items-center gap-1"
                    >
                      카테고리 관리 ({categories.length})
                    </button>
                    <button
                      onClick={() => rolloverDay(fmtDate(today))}
                      disabled={todayUndone.length === 0}
                      className="h-7 px-2.5 text-[11px] bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-200 rounded inline-flex items-center gap-1"
                      title="오늘의 미완료 업무를 다음 영업일로 이관 (금→월, 공휴일 자동 건너뜀)"
                    >
                      <ArrowRightCircle className="w-3 h-3" />
                      미완료 다음날로 이관{todayUndone.length > 0 ? ` (${todayUndone.length})` : ""}
                    </button>
                    <button
                      onClick={() => addTask(fmtDate(today))}
                      className="h-7 px-2.5 text-[11px] bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 새 업무
                    </button>
                  </div>
                </div>

                {showCatManager && (
                  <CategoryManager
                    categories={categories}
                    onAdd={addCategory}
                    onDelete={delCategory}
                  />
                )}

                <div className="overflow-auto">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-slate-50 text-[10.5px] text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="text-center w-14 px-2 py-2">완료</th>
                        <th className="text-center w-28 px-2 py-2">날짜</th>
                        <th className="text-center w-24 px-2 py-2">카테고리</th>
                        <th className="text-center w-20 px-2 py-2">우선순위</th>
                        <th className="text-center w-24 px-2 py-2">상태</th>
                        <th className="text-left px-3 py-2">업무</th>
                        <th className="text-center w-28 px-2 py-2">마감일자</th>
                        <th className="text-left w-40 px-3 py-2">비고</th>
                        <th className="text-center w-10 px-1 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          categories={categories}
                          onPatch={(p) => patchTask(t.id, p)}
                          onDelete={() => delTask(t.id)}
                        />
                      ))}
                      {/* 가상 입력 행 — 항상 맨 마지막에 표시. 입력 시 실제 task 로 변환 */}
                      <QuickAddRow
                        categories={categories}
                        dateISO={fmtDate(today)}
                        onCreate={async (data) => {
                          const res = await fetch(`/api/weekly-tasks`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              userId,
                              date: data.date ?? fmtDate(today),
                              dueDate: data.dueDate ?? fmtDate(today),
                              title: data.title,
                              category: data.category ?? null,
                              status: "not_started",
                            }),
                          });
                          if (res.ok) {
                            const created: WeeklyTask = await res.json();
                            setTasks((prev) => [...prev, created]);
                          }
                        }}
                      />
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}
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

function CategoryManager({
  categories,
  onAdd,
  onDelete,
}: {
  categories: Category[];
  onAdd: (label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  return (
    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAdd(newLabel);
              setNewLabel("");
            }
          }}
          placeholder="새 카테고리 이름..."
          className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 w-48"
        />
        <button
          onClick={() => {
            onAdd(newLabel);
            setNewLabel("");
          }}
          className="h-7 px-2.5 text-[11px] bg-brand-600 text-white hover:bg-brand-700 rounded"
        >
          추가
        </button>
        <span className="ml-auto text-[10px] text-slate-400">
          색상은 자동 할당됩니다. 삭제 시 해당 카테고리가 설정된 업무는 빈 값으로 표시됩니다.
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <span
            key={c.id}
            className={clsx(
              "inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded ring-1",
              c.color ?? "bg-slate-100 text-slate-600 ring-slate-200"
            )}
          >
            {c.label}
            <button
              onClick={() => onDelete(c.id)}
              className="hover:bg-white/40 rounded p-px"
              title="삭제"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="text-[10.5px] text-slate-400">등록된 카테고리 없음</span>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  categories,
  onPatch,
  onDelete,
}: {
  task: WeeklyTask;
  categories: Category[];
  onPatch: (patch: Partial<WeeklyTask>) => void;
  onDelete: () => void;
}) {
  const isDone = task.completed || task.status === "done";
  const sm = STATUS_META[task.status] ?? STATUS_META.not_started;
  const pm = task.priority ? PRIORITY_META[task.priority] : null;
  const cat = task.category ? categories.find((c) => c.value === task.category) : null;

  // 마감일자가 오늘보다 과거면 빨강
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isOverdue = task.dueDate && !isDone && fmtDate(task.dueDate) < todayKey;
  const isDueToday = task.dueDate && !isDone && fmtDate(task.dueDate) === todayKey;

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
        <select
          value={task.category ?? ""}
          onChange={(e) => onPatch({ category: e.target.value || null })}
          className={clsx(
            "text-[10.5px] px-1.5 py-0.5 rounded border border-transparent cursor-pointer outline-none focus:ring-1 focus:ring-brand-200 appearance-none w-full ring-1",
            cat ? cat.color ?? "bg-slate-50 text-slate-500 ring-slate-200" : "bg-slate-50 text-slate-400 ring-slate-200"
          )}
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
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
          className={clsx("text-[11.5px]", isDone ? "text-slate-400" : "text-slate-800")}
        />
      </td>
      <td
        className={clsx(
          "text-center px-2 py-1.5",
          isOverdue && "bg-rose-50",
          isDueToday && "bg-amber-50"
        )}
      >
        <ShortDateInput
          value={task.dueDate ? fmtDate(task.dueDate) : ""}
          onSave={(iso) => onPatch({ dueDate: iso })}
          className={clsx(
            isOverdue && "text-rose-700 font-semibold",
            isDueToday && "text-amber-700 font-semibold"
          )}
        />
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

/**
 * 가상 입력 행 — DB에 저장되지 않은 빈 placeholder.
 *   - 사용자가 업무명을 입력하고 blur/Enter 시 실제 WeeklyTask 로 생성
 *   - 입력 안하면 DB에 흔적이 남지 않으므로 "다음날 자동 삭제" 효과
 *   - 생성 후엔 자체 상태 초기화 → 새 빈 행이 다시 보임
 */
function QuickAddRow({
  categories,
  dateISO,
  onCreate,
}: {
  categories: Category[];
  dateISO: string;
  onCreate: (data: {
    title: string;
    category?: string | null;
    date?: string;
    dueDate?: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function commit() {
    const t = title.trim();
    if (!t) return; // 빈 값은 무시
    if (busy) return;
    setBusy(true);
    try {
      await onCreate({ title: t, category: category || null });
      setTitle("");
      setCategory("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-brand-50/20 hover:bg-brand-50/40 transition">
      <td className="text-center px-2 py-1.5 text-slate-300">
        <Plus className="w-3 h-3 inline" />
      </td>
      <td className="text-center px-2 py-1.5 text-[10px] text-slate-400 tabular-nums">
        {dateISO.slice(5).replace("-", "/")}
      </td>
      <td className="text-center px-2 py-1.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-[10.5px] px-1.5 py-0.5 rounded border border-transparent cursor-pointer outline-none focus:ring-1 focus:ring-brand-200 appearance-none w-full bg-white ring-1 ring-slate-200 text-slate-500"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="text-center px-2 py-1.5 text-slate-300">—</td>
      <td className="text-center px-2 py-1.5 text-slate-300">—</td>
      <td className="px-3 py-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="+ 새 업무명 입력 후 Enter (입력 안하면 저장 안됨)"
          disabled={busy}
          className="w-full bg-transparent focus:bg-white focus:ring-1 focus:ring-brand-200 outline-none rounded px-1 py-0.5 text-[11.5px] text-slate-800 placeholder:text-slate-400"
        />
      </td>
      <td className="text-center px-2 py-1.5 text-slate-300 text-[10px]">자동</td>
      <td className="px-3 py-1.5 text-slate-300">—</td>
      <td className="text-center px-1 py-1.5 text-slate-300">—</td>
    </tr>
  );
}

/**
 * 짧은 날짜 입력 컴포넌트.
 *   - 표시: "2026.05.15" (저장된 값) 또는 빈 칸 (없을 때)
 *   - 입력 허용 포맷:
 *       260515 / 26-05-15 / 26.05.15 → 2026-05-15
 *       20260515 / 2026-05-15 / 2026.05.15 → 2026-05-15
 *   - blur 또는 Enter 시 파싱 → ISO(YYYY-MM-DD) 로 저장
 *   - 빈 문자열 저장 시 null
 *   - 잘못된 입력은 원래 값으로 되돌림
 */
function ShortDateInput({
  value,
  onSave,
  className,
}: {
  value: string; // "YYYY-MM-DD" 또는 ""
  onSave: (iso: string | null) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  function display(v: string): string {
    if (!v) return "";
    // v 는 YYYY-MM-DD
    return v.replaceAll("-", ".");
  }

  function parse(raw: string): string | null | undefined {
    const t = raw.trim();
    if (!t) return null; // 빈 입력 → null 저장
    const digits = t.replace(/\D/g, "");
    let y: number, m: number, d: number;
    if (digits.length === 6) {
      // YYMMDD
      y = 2000 + Number(digits.slice(0, 2));
      m = Number(digits.slice(2, 4));
      d = Number(digits.slice(4, 6));
    } else if (digits.length === 8) {
      // YYYYMMDD
      y = Number(digits.slice(0, 4));
      m = Number(digits.slice(4, 6));
      d = Number(digits.slice(6, 8));
    } else {
      return undefined; // 파싱 실패
    }
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2099) return undefined;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function commit() {
    setEditing(false);
    if (draft.trim() === display(value)) return; // 변경 없음
    const result = parse(draft);
    if (result === undefined) {
      // 잘못된 입력 → 원래 값으로 복원
      setDraft(display(value));
      return;
    }
    onSave(result); // null 또는 ISO
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? draft : display(value)}
      onFocus={() => {
        setDraft(display(value));
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          setDraft(display(value));
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="260515"
      className={clsx(
        "w-full text-center text-[11px] bg-transparent focus:bg-white focus:ring-1 focus:ring-brand-200 outline-none rounded px-0.5 tabular-nums font-mono",
        className
      )}
    />
  );
}
