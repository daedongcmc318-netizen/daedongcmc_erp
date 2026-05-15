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
  annualTotal: number;
  annualUsed: number;
  annualRemaining: number;
  monthlyTotal: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  pendingDeducting: number;
  byType: Record<string, number>;
  hasQuota?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  annual: "연차",
  monthly: "월차",
  half_am: "오전반차",
  half_pm: "오후반차",
  public: "공가",
  sick: "병가",
  maternity: "출산",
  summer: "하계",
  family_event: "경조",
  disaster: "재해",
  health: "보건",
  other: "기타",
};

const NON_DEDUCTING = ["public", "sick", "maternity", "summer", "family_event", "disaster", "health", "other"];

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
    const t = {
      annualTotal: 0,
      annualUsed: 0,
      monthlyTotal: 0,
      monthlyUsed: 0,
      pending: 0,
      special: 0,
    };
    for (const r of filtered) {
      t.annualTotal += r.annualTotal;
      t.annualUsed += r.annualUsed;
      t.monthlyTotal += r.monthlyTotal;
      t.monthlyUsed += r.monthlyUsed;
      t.pending += r.pendingDeducting;
      for (const k of NON_DEDUCTING) t.special += r.byType[k] ?? 0;
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

      {/* 전체 합계 카드 */}
      {isPriv && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <SumCard label="연차 합계 사용" used={totals.annualUsed} total={totals.annualTotal} color="blue" />
          <SumCard label="월차 합계 사용" used={totals.monthlyUsed} total={totals.monthlyTotal} color="violet" />
          <SumCard label="대기 (결재중)" used={totals.pending} total={null} color="amber" />
          <SumCard label="특별/공/병가 합계" used={totals.special} total={null} color="emerald" />
          <SumCard label="총 인원" used={filtered.length} total={null} color="slate" suffix="명" />
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
                <th rowSpan={2} className="text-left px-3 py-2 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 w-32">이름</th>
                <th rowSpan={2} className="text-left px-3 py-2 border-r border-slate-200 w-40">부서·직위</th>
                <th rowSpan={2} className="text-left px-3 py-2 border-r border-slate-200 w-24">입사일</th>
                <th rowSpan={2} className="text-left px-3 py-2 border-r border-slate-200 w-24">근속</th>
                <th colSpan={3} className="text-center px-2 py-1 border-r border-slate-200 bg-blue-50 text-blue-700">연차</th>
                <th colSpan={3} className="text-center px-2 py-1 border-r border-slate-200 bg-violet-50 text-violet-700">월차</th>
                <th rowSpan={2} className="text-right px-2 py-2 border-r border-slate-200 w-20 bg-amber-50 text-amber-700">결재중</th>
                <th colSpan={6} className="text-center px-2 py-1 border-r border-slate-200 bg-emerald-50 text-emerald-700">기타</th>
              </tr>
              <tr className="border-b border-slate-200">
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">한도</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">사용</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-blue-50/50 w-14">잔여</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-violet-50/50 w-14">한도</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-violet-50/50 w-14">사용</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 bg-violet-50/50 w-14">잔여</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">공</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">병</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">출산</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">경조</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">보건</th>
                <th className="text-right px-2 py-1.5 border-r border-slate-200 w-12 bg-emerald-50/50">기타</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const annualPct = r.annualTotal > 0 ? Math.min(100, (r.annualUsed / r.annualTotal) * 100) : 0;
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="px-3 py-2 border-r border-slate-100 sticky left-0 bg-white z-10 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {r.name.slice(0, 1)}
                        </span>
                        <span>{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 text-[11px] text-slate-600">
                      <div className="truncate">{r.dept}</div>
                      <div className="text-[10px] text-slate-400">{r.position}</div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 font-mono text-[10.5px] text-slate-500 tabular-nums">
                      {r.joinDate?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-100 text-[10.5px] text-slate-600">
                      {r.tenure}
                    </td>
                    {/* 연차 */}
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums text-slate-700">
                      {r.annualTotal}
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold text-blue-700">
                      {r.annualUsed}
                    </td>
                    <td className={clsx("px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold", r.annualRemaining < 0 ? "text-rose-600" : "text-slate-800")}>
                      {r.annualRemaining}
                      {r.annualTotal > 0 && (
                        <div className="h-1 bg-blue-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-blue-500" style={{ width: `${annualPct}%` }} />
                        </div>
                      )}
                    </td>
                    {/* 월차 */}
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums text-slate-700">
                      {r.monthlyTotal}
                    </td>
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold text-violet-700">
                      {r.monthlyUsed}
                    </td>
                    <td className={clsx("px-2 py-2 border-r border-slate-100 text-right tabular-nums font-semibold", r.monthlyRemaining < 0 ? "text-rose-600" : "text-slate-800")}>
                      {r.monthlyRemaining}
                    </td>
                    {/* 결재중 */}
                    <td className="px-2 py-2 border-r border-slate-100 text-right tabular-nums text-amber-700">
                      {r.pendingDeducting > 0 ? r.pendingDeducting : <span className="text-slate-300">—</span>}
                    </td>
                    {/* 기타 6종 */}
                    {(["public", "sick", "maternity", "family_event", "health", "other"] as const).map((k) => (
                      <td key={k} className="px-2 py-2 border-r border-slate-100 text-right tabular-nums">
                        {r.byType[k] ? <strong className="text-emerald-700">{r.byType[k]}</strong> : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="text-center py-12 text-sm text-slate-400">
                    표시할 직원이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2">
        ※ 잔여 = 한도 - 사용 (결재중인 휴가는 별도 컬럼으로 표시, 잔여에는 미차감)<br />
        ※ 연차 한도: 입사 1년 미만 → 0 (월차로 부여) / 1~3년 → 15 / 이후 2년마다 +1, 최대 25 (근로기준법 60조)<br />
        ※ 공/병/특별/보건/기타 휴가는 잔여 차감 없이 사용 횟수만 누적
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
