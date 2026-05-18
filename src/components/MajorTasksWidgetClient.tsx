"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pin,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

type User = { id: string; name: string; pmCode: string | null; position: string };
type Task = {
  id: string;
  category: string | null;
  title: string;
  targetDate: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assigneeCode: string | null;
  notes: string | null;
  completed: boolean;
  sortOrder: number;
  assignee: { id: string; name: string; pmCode: string | null } | null;
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  not_started: { label: "시작 전", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  review: { label: "검토중", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  done: { label: "완료", color: "bg-slate-200 text-slate-500", dot: "bg-slate-500" },
};

const CATEGORY_COLORS: Record<string, string> = {
  용역: "bg-rose-100 text-rose-700",
  다미엑스: "bg-orange-100 text-orange-700",
  사업준비: "bg-amber-100 text-amber-700",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10).replace(/-/g, "/");
}

function daysUntil(d: string | null): { label: string; tone: "today" | "soon" | "later" | "overdue" | "none" } {
  if (!d) return { label: "—", tone: "none" };
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "오늘 마감!", tone: "today" };
  if (diff < 0) return { label: `${Math.abs(diff)}일 지남`, tone: "overdue" };
  if (diff <= 7) return { label: `${diff}일 남음`, tone: "soon" };
  return { label: `${diff}일 남음`, tone: "later" };
}

export default function MajorTasksWidgetClient({
  initialTasks,
  users,
}: {
  initialTasks: Task[];
  users: User[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  // 목표일 기준 정렬 (null 은 맨 뒤)
  function sortByTargetDate(arr: Task[]): Task[] {
    return [...arr].sort((a, b) => {
      if (!a.targetDate && !b.targetDate) return a.sortOrder - b.sortOrder;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      const d = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      if (d !== 0) return d;
      return a.sortOrder - b.sortOrder;
    });
  }
  const sortedTasks = useMemo(() => sortByTargetDate(tasks), [tasks]);

  async function createTask(payload: any) {
    const res = await fetch("/api/major-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert("추가 실패");
      return;
    }
    const created = await res.json();
    setTasks((prev) => [...prev, created]);
  }

  async function patchTask(id: string, patch: Record<string, any>) {
    // 옵티미스틱
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/major-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("수정 실패");
      router.refresh();
      return;
    }
    const updated = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    // 완료 체크하면 위젯에서 제거
    if (patch.completed === true) {
      setTimeout(() => setTasks((prev) => prev.filter((t) => t.id !== id)), 600);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("이 업무를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/major-tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="bg-amber-50/40 border border-amber-200 rounded-2xl shadow-card p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-amber-600 rotate-45" />
          <h3 className="text-sm font-semibold text-slate-800">주요 업무 진행현황</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium tabular-nums">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/major-tasks"
            className="text-[11px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-0.5"
          >
            전체보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-[11.5px]">
          <thead className="bg-slate-50">
            <tr className="text-slate-500 text-[10.5px] border-b border-slate-200">
              <th className="text-left px-2 py-1.5 w-20">분류</th>
              <th className="text-left px-2 py-1.5">업무명</th>
              <th className="text-left px-2 py-1.5 w-24">목표일</th>
              <th className="text-left px-2 py-1.5 w-24">남은 기간</th>
              <th className="text-left px-2 py-1.5 w-24">진행상황</th>
              <th className="text-left px-2 py-1.5 w-20">담당자</th>
              <th className="text-left px-2 py-1.5 w-32">기타</th>
              <th className="px-2 py-1.5 w-10 text-center">완료</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                users={users}
                onPatch={(p) => patchTask(t.id, p)}
                onDelete={() => deleteTask(t.id)}
              />
            ))}
            {/* 인라인 신규 입력 행 — 항상 표 마지막에 위치 */}
            <QuickAddTaskRow users={users} onCreate={createTask} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────── 행 (인라인 편집) ─────────── */

function TaskRow({
  task,
  users,
  onPatch,
  onDelete,
}: {
  task: Task;
  users: User[];
  onPatch: (patch: any) => void;
  onDelete: () => void;
}) {
  const due = daysUntil(task.targetDate);
  const dueClass =
    due.tone === "today"
      ? "text-rose-600 font-semibold"
      : due.tone === "overdue"
        ? "text-rose-700 font-semibold"
        : due.tone === "soon"
          ? "text-amber-700 font-medium"
          : due.tone === "later"
            ? "text-slate-600"
            : "text-slate-300";

  const statusMeta = STATUS_META[task.status] ?? STATUS_META.not_started;

  return (
    <tr className="group/row border-b border-slate-100 hover:bg-amber-50/30">
      <td className="px-2 py-1.5">
        <InlineText
          value={task.category ?? ""}
          onSave={(v) => onPatch({ category: v })}
          placeholder="—"
          render={(v) =>
            v ? (
              <span
                className={clsx(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  CATEGORY_COLORS[v] ?? "bg-slate-100 text-slate-700"
                )}
              >
                {v}
              </span>
            ) : (
              <span className="text-slate-300 text-[11px]">—</span>
            )
          }
        />
      </td>
      <td className="px-2 py-1.5">
        <InlineText
          value={task.title}
          onSave={(v) => onPatch({ title: v })}
          className="font-medium text-slate-800"
        />
      </td>
      <td className="px-2 py-1.5">
        <InlineDate value={task.targetDate} onSave={(v) => onPatch({ targetDate: v })} />
      </td>
      <td className={clsx("px-2 py-1.5 text-[11px]", dueClass)}>{due.label}</td>
      <td className="px-2 py-1.5">
        <StatusSelect value={task.status} onChange={(v) => onPatch({ status: v })} />
      </td>
      <td className="px-2 py-1.5">
        <AssigneeSelect
          users={users}
          value={task.assigneeCode ?? null}
          onChange={(code, userId) => onPatch({ assigneeCode: code, assigneeId: userId })}
        />
      </td>
      <td className="px-2 py-1.5">
        <InlineText
          value={task.notes ?? ""}
          onSave={(v) => onPatch({ notes: v })}
          placeholder="—"
          className="text-[10.5px] text-slate-600"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={() => onPatch({ completed: true, status: "done" })}
          className="inline-flex w-4 h-4 items-center justify-center rounded transition bg-slate-100 hover:bg-emerald-500 hover:text-white text-transparent"
        >
          <Check className="w-2.5 h-2.5" />
        </button>
      </td>
      <td className="px-1 py-1.5 text-center">
        <button
          onClick={onDelete}
          className="opacity-0 group-hover/row:opacity-100 text-slate-300 hover:text-rose-500"
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
  render,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  render?: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={clsx("cursor-text min-h-[18px] truncate", className)}
      >
        {render
          ? render(value)
          : value || <span className="text-slate-300 text-[11px]">{placeholder ?? "—"}</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (draft !== value) onSave(draft);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1.5 text-[11.5px] border border-amber-300 rounded outline-none ring-2 ring-amber-200 bg-white"
    />
  );
}

function InlineDate({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const display = value ? value.slice(0, 10).replace(/-/g, "/") : "";
  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer min-h-[18px] text-[11px] text-slate-600 tabular-nums"
      >
        {display || <span className="text-slate-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onSave(e.target.value || null)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") setEditing(false);
      }}
      className="h-6 px-1 text-[10px] border border-amber-300 rounded outline-none bg-white"
    />
  );
}

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_META[value] ?? STATUS_META.not_started;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "px-1.5 py-0.5 rounded text-[10.5px] font-medium inline-flex items-center gap-1",
          cur.color
        )}
      >
        <span className={clsx("w-1.5 h-1.5 rounded-full", cur.dot)} />
        {cur.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-28 bg-white border border-slate-200 rounded shadow-lg py-1">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <button
                key={k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-slate-50 text-[11px] flex items-center gap-1.5"
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full", m.dot)} />
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssigneeSelect({
  users,
  value,
  onChange,
}: {
  users: User[];
  value: string | null;
  onChange: (code: string | null, userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => setMounted(true), []);

  // 버튼 위치 추적 → 드롭다운을 화면 최상위(portal) 로 띄움
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 240) });
  }, [open]);

  const filtered = q
    ? users.filter((u) => u.name.includes(q) || (u.pmCode ?? "").toLowerCase().includes(q.toLowerCase()))
    : users.slice(0, 30);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className={clsx(
          "px-1.5 py-0.5 rounded text-[10.5px] font-medium font-mono",
          value ? "bg-blue-100 text-blue-700" : "text-slate-300 hover:bg-slate-100"
        )}
      >
        {value ?? "—"}
      </button>
      {open && mounted && coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[1000]" onClick={() => setOpen(false)} />
            <div
              style={{ position: "fixed", top: coords.top, left: coords.left, width: 224, zIndex: 1001 }}
              className="bg-white border border-slate-200 rounded shadow-xl p-2"
            >
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름/코드 검색..."
                className="w-full h-7 px-2 text-[11px] border border-slate-200 rounded outline-none focus:border-amber-300 mb-1"
              />
              <button
                onClick={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-[10.5px] text-slate-400 hover:bg-slate-50 rounded"
              >
                비워두기
              </button>
              <button
                onClick={() => {
                  onChange(q.trim() || null, null);
                  setOpen(false);
                }}
                disabled={!q.trim()}
                className="w-full text-left px-2 py-1 text-[10.5px] text-amber-700 hover:bg-amber-50 rounded disabled:opacity-30"
              >
                직접 입력: <strong>{q.trim() || "—"}</strong>
              </button>
              <div className="max-h-48 overflow-auto mt-1 border-t border-slate-100 pt-1">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onChange(u.pmCode ?? u.name, u.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-amber-50 rounded flex items-center justify-between text-[11px]"
                  >
                    <span>{u.name}</span>
                    <span className="text-[9px] font-mono text-slate-500">{u.pmCode ?? ""}</span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/* ─────────── 인라인 신규 입력 행 ─────────── */

function QuickAddTaskRow({
  users,
  onCreate,
}: {
  users: User[];
  onCreate: (p: any) => Promise<void>;
}) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [assigneeCode, setAssigneeCode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const user = users.find((u) => u.pmCode === assigneeCode.trim());
      await onCreate({
        category: category.trim() || null,
        title: title.trim(),
        targetDate: targetDate || null,
        status: "not_started",
        assigneeCode: assigneeCode.trim() || null,
        assigneeId: user?.id ?? null,
        notes: notes.trim() || null,
      });
      // 입력 초기화 → 새 빈 행이 다시 보임
      setCategory("");
      setTitle("");
      setTargetDate("");
      setAssigneeCode("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Enter → blur. blur 시 commit() 호출됨 (title 입력 시에만 onBlur 등록)
      // 다른 필드(분류/담당자/기타)는 commit 직접 호출 (blur 등록 안됨)
      const isTitleField = (e.currentTarget as HTMLInputElement).placeholder.includes("업무명");
      if (!isTitleField && title.trim()) commit();
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-amber-50/30 hover:bg-amber-50/60 transition">
      <td className="px-2 py-1.5">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="분류"
          disabled={saving}
          className="w-full h-6 px-1.5 text-[10.5px] bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-300 outline-none rounded"
        />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <Plus className="w-3 h-3 text-amber-500 shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            placeholder="새 업무명 입력 후 Enter (목표일 입력 시 자동 정렬)"
            disabled={saving}
            className="flex-1 h-6 px-1 text-[11.5px] font-medium bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-300 outline-none rounded placeholder:text-amber-600 placeholder:font-normal"
          />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          disabled={saving}
          className="w-full h-6 px-1 text-[10px] bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-300 outline-none rounded tabular-nums"
        />
      </td>
      <td className="px-2 py-1.5 text-slate-300 text-[10px]">—</td>
      <td className="px-2 py-1.5 text-slate-300 text-[10px]">시작 전</td>
      <td className="px-2 py-1.5">
        <input
          value={assigneeCode}
          onChange={(e) => setAssigneeCode(e.target.value.toUpperCase())}
          onKeyDown={onKeyDown}
          placeholder="DHK"
          disabled={saving}
          className="w-full h-6 px-1 text-[10.5px] font-mono bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-300 outline-none rounded"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="기타"
          disabled={saving}
          className="w-full h-6 px-1 text-[10.5px] bg-transparent focus:bg-white focus:ring-1 focus:ring-amber-300 outline-none rounded"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={commit}
          disabled={!title.trim() || saving}
          title="추가 (또는 업무명에서 Enter)"
          className="inline-flex w-5 h-5 items-center justify-center rounded bg-amber-100 hover:bg-amber-200 disabled:opacity-30 text-amber-700 transition"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </td>
      <td className="px-1 py-1.5"></td>
    </tr>
  );
}
