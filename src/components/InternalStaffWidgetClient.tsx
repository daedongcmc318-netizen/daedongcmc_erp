"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, LogIn, LogOut, Briefcase, CalendarOff, Clock, ArrowRight } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

type StaffItem = {
  id: string;
  name: string;
  dept: string;
  position: string;
  status: "before_work" | "working" | "after_work" | "business_trip" | "leave";
  statusLabel: string;
  leaveType: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

const STATUS_META: Record<
  StaffItem["status"],
  { label: string; icon: any; bg: string; text: string; ring: string; dot: string }
> = {
  before_work: {
    label: "출근 전",
    icon: Clock,
    bg: "bg-slate-50",
    text: "text-slate-500",
    ring: "ring-slate-200",
    dot: "bg-slate-300",
  },
  working: {
    label: "근무중",
    icon: LogIn,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
  },
  after_work: {
    label: "퇴근",
    icon: LogOut,
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200",
    dot: "bg-blue-500",
  },
  business_trip: {
    label: "출장",
    icon: Briefcase,
    bg: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
    dot: "bg-violet-500",
  },
  leave: {
    label: "연차",
    icon: CalendarOff,
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
  },
};

function fmtTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function InternalStaffWidgetClient({
  items: initialItems,
  totalInternal,
}: {
  items: StaffItem[];
  totalInternal: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<StaffItem[]>(initialItems);

  // 본인이 자신을 출장 모드로 토글할 수 있도록 — 위젯에서는 본인 카드만 토글 가능
  // (관리자 권한 처리는 추후 확장)
  const counts = {
    before_work: items.filter((i) => i.status === "before_work").length,
    working: items.filter((i) => i.status === "working").length,
    after_work: items.filter((i) => i.status === "after_work").length,
    business_trip: items.filter((i) => i.status === "business_trip").length,
    leave: items.filter((i) => i.status === "leave").length,
  };

  return (
    <div className="rounded-2xl shadow-card border border-slate-200/70 bg-white p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold">사무실 근무 현황</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium tabular-nums">
            {items.length}명
          </span>
        </div>
        <Link
          href="/attendance"
          className="text-[11px] text-brand-600 hover:text-brand-700 flex items-center gap-0.5 font-medium"
        >
          근태 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 상태 카운트 요약 */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        <CountPill label="출근 전" count={counts.before_work} status="before_work" />
        <CountPill label="근무중" count={counts.working} status="working" />
        <CountPill label="퇴근" count={counts.after_work} status="after_work" />
        <CountPill label="출장" count={counts.business_trip} status="business_trip" />
        <CountPill label="연차" count={counts.leave} status="leave" />
      </div>

      {/* 직원별 카드 */}
      <div className="space-y-1.5 flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-slate-400">
            내부직원이 지정되지 않았습니다.
            <br />
            직원관리에서 isInternal을 체크하세요.
          </div>
        ) : (
          items.map((s) => <StaffCard key={s.id} item={s} />)
        )}
      </div>
    </div>
  );
}

function CountPill({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: StaffItem["status"];
}) {
  const meta = STATUS_META[status];
  return (
    <div className={clsx("rounded-lg px-2 py-1.5 text-center", meta.bg)}>
      <div className={clsx("text-[9px] font-medium uppercase tracking-wider", meta.text)}>{label}</div>
      <div className={clsx("text-lg font-bold tabular-nums leading-tight", meta.text)}>{count}</div>
    </div>
  );
}

function StaffCard({ item }: { item: StaffItem }) {
  const meta = STATUS_META[item.status];
  const Icon = meta.icon;
  // 휴가의 경우 leaveType에 따라 라벨이 다름 (이미 statusLabel에 반영됨)
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition hover:shadow-sm",
        meta.bg,
        `border-${meta.ring.replace("ring-", "")}`
      )}
    >
      <div
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 bg-white",
          meta.text,
          "ring-1",
          meta.ring
        )}
      >
        {item.name.slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-slate-800 truncate">{item.name}</span>
          <span className="text-[9px] text-slate-400 truncate">{item.position}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={clsx("w-1.5 h-1.5 rounded-full", meta.dot)} />
          <span className={clsx("text-[10.5px] font-medium", meta.text)}>{item.statusLabel}</span>
          {item.checkIn && (
            <span className="text-[9px] text-slate-400 tabular-nums">
              · {fmtTime(item.checkIn)}
              {item.checkOut ? ` ~ ${fmtTime(item.checkOut)}` : ""}
            </span>
          )}
        </div>
      </div>
      <Icon className={clsx("w-3.5 h-3.5 shrink-0", meta.text)} />
    </div>
  );
}
