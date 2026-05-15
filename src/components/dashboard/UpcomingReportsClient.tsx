"use client";
import { useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { getBizMeta, getServiceLabel } from "@/lib/enums";

export type UpcomingItem = {
  kind: "mid" | "final";
  date: Date | string;
  done: boolean;
  project: {
    id: string;
    title: string;
    bizCategory: string;
    serviceType: string | null;
    serviceDetail: string | null;
    displayCode: string | null;
    manager: { name: string; pmCode: string | null } | null;
  };
};

export default function UpcomingReportsClient({
  items,
  todayMs,
}: {
  items: UpcomingItem[];
  todayMs: number;
}) {
  const [showDone, setShowDone] = useState(false);

  const undone = items.filter((it) => !it.done);
  const done = items.filter((it) => it.done);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold">1주 이내 보고 마감</h3>
          <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium tabular-nums">
            <span className={undone.length > 0 ? "text-rose-600" : "text-slate-400"}>{undone.length}</span>
            <span className="text-slate-400 mx-0.5">/</span>
            <span className="text-slate-600">{items.length}</span>
            <span className="text-slate-400 ml-0.5">건</span>
            <span className="text-[10px] text-slate-400 ml-1">(미완료/전체)</span>
          </span>
        </div>
        <Link
          href="/projects"
          className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5"
        >
          프로젝트 보기 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400">
          이번 주 안에 마감 예정인 보고가 없습니다.
        </div>
      ) : (
        <>
          {/* 미완료 (항상 노출, 위) */}
          {undone.length > 0 ? (
            <ReportTable items={undone} todayMs={todayMs} />
          ) : (
            <div className="text-center py-6 text-xs text-emerald-600 bg-emerald-50/40 border border-emerald-100 rounded-lg flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              이번 주 미완료 보고가 없습니다 🎉
            </div>
          )}

          {/* 완료 (접기) */}
          {done.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100 transition"
              >
                <span className="flex items-center gap-1.5 text-[11.5px] text-slate-600 font-medium">
                  {showDone ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  완료된 보고
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
                    {done.length}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {showDone ? "접기" : "펼쳐서 확인"}
                </span>
              </button>
              {showDone && (
                <div className="mt-2">
                  <ReportTable items={done} todayMs={todayMs} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportTable({ items, todayMs }: { items: UpcomingItem[]; todayMs: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-[10.5px] text-slate-500 font-medium">
            <th className="text-left px-3 py-2 w-16">구분</th>
            <th className="text-left px-3 py-2 w-20">분야</th>
            <th className="text-left px-3 py-2 w-44">서비스</th>
            <th className="text-left px-3 py-2 w-24">일자</th>
            <th className="text-left px-3 py-2 w-24">담당자</th>
            <th className="text-left px-3 py-2 w-28">D-day</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const date = new Date(it.date);
            const diffDays = Math.round(
              (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - todayMs) /
                86400000
            );
            const bizMeta = getBizMeta(it.project.bizCategory);
            const serviceLabel = getServiceLabel(it.project.serviceType);
            const dday =
              diffDays === 0 ? "D-DAY" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
            const urgency =
              diffDays <= 1
                ? "bg-rose-100 text-rose-700"
                : diffDays <= 3
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700";
            return (
              <tr
                key={`${it.kind}-${it.project.id}-${idx}`}
                className={clsx(
                  "border-t border-slate-100 hover:bg-slate-50/70",
                  it.done && "opacity-70"
                )}
              >
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 whitespace-nowrap",
                      it.kind === "mid"
                        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                        : "bg-purple-50 text-purple-700 ring-purple-200"
                    )}
                  >
                    {it.kind === "mid" ? "중간보고" : "완료보고"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium whitespace-nowrap ${bizMeta.color}`}
                  >
                    {bizMeta.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] text-slate-700 truncate" title={it.project.title}>
                      {it.project.displayCode && (
                        <span className="font-mono text-[10px] text-slate-400 mr-1">
                          {it.project.displayCode}
                        </span>
                      )}
                      {it.project.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {serviceLabel}
                      {it.project.serviceDetail ? ` · ${it.project.serviceDetail}` : ""}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                  {date.toISOString().slice(5, 10).replace("-", "/")}
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})
                  </span>
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-700">
                  {it.project.manager ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-[9px] font-semibold flex items-center justify-center">
                        {it.project.manager.name.slice(0, 1)}
                      </span>
                      {it.project.manager.name}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums whitespace-nowrap",
                        it.done ? "bg-slate-100 text-slate-500" : urgency
                      )}
                    >
                      {dday}
                    </span>
                    {it.done && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
                        ✓ 완료
                      </span>
                    )}
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
