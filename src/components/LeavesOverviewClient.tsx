"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Search, Users as UsersIcon } from "lucide-react";
import clsx from "clsx";

type Row = {
  id: string;
  name: string;
  dept: string;
  position: string;
  joinDate: string | null;
  tenure: string;
  // 통합 연차/월차
  combinedTotal: number;
  combinedUsed: number;
  combinedRemaining: number;
  // 내부 분해 (툴팁 근거)
  annualTotal: number;
  monthlyBase: number;
  carryover: number;
  pendingDeducting: number;
  byType: Record<string, number>;
  hasQuota?: boolean;
  approvalSummary: { pendingCount: number; approvedCount: number; rejectedCount: number };
};

export default function LeavesOverviewClient({
  year,
  rows,
  isPriv,
  me,
}: {
  year: number;
  rows: Row[];
  isPriv: boolean;
  me: { id: string; name: string; role: string };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const depts = useMemo(() => Array.from(new Set(rows.map((r) => r.dept))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (deptFilter && r.dept !== deptFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (![r.name, r.dept, r.position].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, deptFilter]);

  // 합계
  const totals = useMemo(() => {
    const t = { combinedTotal: 0, combinedUsed: 0, pending: 0 };
    for (const r of filtered) {
      t.combinedTotal += r.combinedTotal;
      t.combinedUsed += r.combinedUsed;
      t.pending += r.pendingDeducting;
    }
    return t;
  }, [filtered]);

  function navYear(delta: number) {
    router.push(`/leaves/overview?year=${year + delta}`);
  }

  return (
    <div className="px-6 py-6 max-w-[1700px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">근태관리 ▸ 휴가현황</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">휴가 사용·잔여 현황</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isPriv ? `${rows.length}명 내부직원` : "본인"} · {year}년 기준
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => navYear(-1)} className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-base font-semibold tabular-nums px-4">{year}</div>
          <button onClick={() => navYear(1)} className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 전체 합계 카드 — 총 인원 → 연차/월차 합계 → 대기 결재중 */}
      {isPriv && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <SumCard label="총 인원" used={filtered.length} total={null} color="slate" suffix="명" />
          <SumCard label="연차/월차 합계 사용" used={totals.combinedUsed} total={totals.combinedTotal} color="blue" />
          <SumCard label="대기 (결재중)" used={totals.pending} total={null} color="amber" />
        </div>
      )}

      {/* 필터 */}
      {isPriv && (
        <div className="flex items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름/부서/직위 검색..."
              className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-56"
            />
          </div>
          <UsersIcon className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-7 px-2 text-[12px] border border-slate-200 rounded bg-white outline-none focus:border-brand-300"
          >
            <option value="">전체 부서</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
            {filtered.length} / {rows.length}명
          </span>
        </div>
      )}

      {/* 직원별 표 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-slate-50 text-slate-500 text-[10.5px]">
              <tr className="border-b border-slate-200">
                <th rowSpan={2} className="text-center px-3 py-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-32">이름</th>
                <th rowSpan={2} className="text-center px-3 py-2 border-r border-slate-200 w-40">부서·직위</th>
                <th rowSpan={2} className="text-center px-3 py-2 border-r border-slate-200 w-24">입사일</th>
                <th rowSpan={2} className="text-center px-3 py-2 border-r border-slate-200 w-24">근속</th>
                <th colSpan={3} className="text-center px-2 py-1 border-r border-slate-200 bg-blue-50 text-blue-700">연차/월차</th>
                <th rowSpan={2} className="text-center px-2 py-2 border-r border-slate-200 w-20 bg-amber-50 text-amber-700">결재중</th>
                <th rowSpan={2} className="text-center px-2 py-2 border-r border-slate-200 w-24 bg-rose-50 text-rose-700">결재상태</th>
                <th colSpan={6} className="text-center px-2 py-1 bg-emerald-50 text-emerald-700">기타</th>
              </tr>
              <tr className="border-b border-slate-200">
                <th className="text-center px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">한도</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">사용</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">잔여</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">공</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">병</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">출산</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">경조</th>
                <th className="text-center px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">보건</th>
                <th className="text-center px-2 py-1.5 w-12 bg-emerald-50/50">기타</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pct = r.combinedTotal > 0 ? Math.min(100, (r.combinedUsed / r.combinedTotal) * 100) : 0;
                const tooltip = `연차 ${r.annualTotal} + 월차 ${r.monthlyBase}${r.carryover > 0 ? ` + 전년이월 ${r.carryover}` : ""}`;
                const s = r.approvalSummary;
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-3 py-2 border-r border-slate-100 sticky left-0 bg-white z-10 font-medium text-slate-800 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {r.name.slice(0, 1)}
                        </span>
                        <span>{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 text-[11px] text-slate-600 text-center">
                      <div className="truncate">{r.dept}</div>
                      <div className="text-[10px] text-slate-400">{r.position}</div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10.5px] text-slate-500 tabular-nums text-center">
                      {r.joinDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 text-[10.5px] text-slate-600 text-center">
                      {r.tenure}
                    </td>
                    {/* 연차/월차 통합 */}
                    <td
                      className="px-2 py-2 border-r border-slate-100 text-right tabular-nums text-slate-700"
                      title={tooltip}
                    >
                      {r.combinedTotal}
                      {r.carryover > 0 && (
                        <span className="ml-1 text-[9.5px] text-violet-600">(+{r.carryover})</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold text-blue-700">
                      {r.combinedUsed}
                    </td>
                    <td className={clsx("px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold", r.combinedRemaining < 0 ? "text-rose-600" : "text-slate-800")}>
                      {r.combinedRemaining}
                      {r.combinedTotal > 0 && (
                        <div className="h-1 bg-blue-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                    {/* 결재중 */}
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums text-amber-700">
                      {r.pendingDeducting > 0 ? r.pendingDeducting : <span className="text-slate-300">—</span>}
                    </td>
                    {/* 결재상태 */}
                    <td className="px-2 py-2 border-r border-slate-100 text-center text-[10.5px]">
                      <ApprovalBadge summary={s} />
                    </td>
                    {/* 기타 6종 */}
                    {(["public", "sick", "maternity", "family_event", "health", "other"] as const).map((k, idx, arr) => (
                      <td
                        key={k}
                        className={clsx(
                          "px-2 py-2 text-right tabular-nums",
                          idx < arr.length - 1 && "border-r border-slate-100"
                        )}
                      >
                        {r.byType[k] ? <strong className="text-emerald-700">{r.byType[k]}</strong> : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-sm text-slate-400">
                    표시할 직원이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2">
        ※ 연차/월차 통합 표시. 한도 옆 <span className="text-violet-600">(+N)</span>은 전년도 월차 이월분 (연차는 이월 불가, 연내 소진)<br />
        ※ 잔여 = 한도 - 사용. 결재중인 휴가는 별도 컬럼 표시(잔여 미차감)
      </div>
    </div>
  );
}

function SumCard({
  label,
  used,
  total,
  color,
  suffix,
}: {
  label: string;
  used: number;
  total: number | null;
  color: "blue" | "violet" | "amber" | "emerald" | "slate";
  suffix?: string;
}) {
  const c = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  }[color];
  return (
    <div className={clsx("border rounded-xl p-3", c)}>
      <div className="text-[10.5px] opacity-80 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums">{used}</span>
        {total != null && total > 0 && (
          <span className="text-[10.5px] opacity-70">/ {total}</span>
        )}
        {suffix && <span className="text-[10.5px] opacity-70">{suffix}</span>}
        {!suffix && <span className="text-[10.5px] opacity-70">일</span>}
      </div>
    </div>
  );
}

function ApprovalBadge({
  summary,
}: {
  summary: { pendingCount: number; approvedCount: number; rejectedCount: number };
}) {
  const { pendingCount, approvedCount, rejectedCount } = summary;
  const total = pendingCount + approvedCount + rejectedCount;
  if (total === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {approvedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] tabular-nums">
          승인 {approvedCount}
        </span>
      )}
      {pendingCount > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 text-[10px] tabular-nums">
          대기 {pendingCount}
        </span>
      )}
      {rejectedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[10px] tabular-nums">
          반려 {rejectedCount}
        </span>
      )}
    </div>
  );
}
