"use client";
import { useMemo, useState } from "react";
import { Pin, Search } from "lucide-react";
import clsx from "clsx";
import MajorTasksWidgetClient from "@/components/MajorTasksWidgetClient";

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

export default function MajorTasksPageClient({
  initialTasks,
  users,
}: {
  initialTasks: Task[];
  users: User[];
}) {
  const [tab, setTab] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const base = tab === "active" ? initialTasks.filter((t) => !t.completed) : initialTasks;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((t) =>
      [t.title, t.category, t.assigneeCode, t.notes].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [initialTasks, tab, search]);

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Pin className="w-4 h-4 text-amber-600 rotate-45" />
        <span className="text-xs text-slate-500">프로젝트 관리 ▸ 주요 업무</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">주요 업무 진행현황</h1>
      <p className="text-sm text-slate-500 mb-5">
        프로젝트와 별개로 진행되는 업무 (수행기관 등록, 발표 일정 등). 대시보드 또는 이 페이지에서 모두 편집 가능
      </p>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab("active")}
          className={clsx(
            "px-3 py-1.5 text-sm font-medium rounded-md",
            tab === "active" ? "bg-amber-100 text-amber-800" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          진행중 {initialTasks.filter((t) => !t.completed).length}
        </button>
        <button
          onClick={() => setTab("all")}
          className={clsx(
            "px-3 py-1.5 text-sm font-medium rounded-md",
            tab === "all" ? "bg-amber-100 text-amber-800" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          전체보기 {initialTasks.length}
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="업무명/분류/담당자/메모 검색..."
            className="h-8 pl-7 pr-3 rounded text-xs bg-white border border-slate-200 focus:ring-2 focus:ring-amber-200 focus:outline-none w-64"
          />
        </div>
      </div>

      <MajorTasksWidgetClient initialTasks={filtered} users={users} />
    </div>
  );
}
