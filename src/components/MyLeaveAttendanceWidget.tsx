import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getUserLeaveBalance } from "@/lib/leaves";
import { CalendarDays, Clock, LogIn, ArrowRight, AlertCircle } from "lucide-react";

/**
 * 대시보드용 위젯: 내 연차 잔여 + 오늘 출퇴근 상태 + 결재 대기
 * 내부직원만 표시. 외부직원/시스템관리자에게는 null 반환.
 */
export default async function MyLeaveAttendanceWidget() {
  const me = await getCurrentUser();
  if (!me) return null;

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, isInternal: true, joinDate: true },
  });
  if (!u?.isInternal) return null;

  const balance = await getUserLeaveBalance(u.id);
  if (!balance) return null;

  // 오늘 근태
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = await prisma.attendance.findUnique({
    where: { userId_date: { userId: u.id, date: todayStart } },
  });

  // 결재 대기 건수
  const pendingApprovals = await prisma.leaveApproval.count({
    where: { approverId: u.id, status: "pending", request: { status: "pending" } },
  });

  const fmtTime = (d: Date | null) =>
    d ? new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

  const hasAnnual = balance.annualTotal > 0;
  const remaining = hasAnnual ? balance.annualRemaining : balance.monthlyRemaining;
  const total = hasAnnual ? balance.annualTotal : balance.monthlyTotal;
  const used = hasAnnual ? balance.annualUsed : balance.monthlyUsed;
  const leaveLabel = hasAnnual ? "연차" : "월차";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold">내 근태 / 연차</h3>
        </div>
        {pendingApprovals > 0 && (
          <Link
            href="/leaves"
            className="text-[11px] px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded font-medium flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" /> 결재 대기 {pendingApprovals}건
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 출퇴근 */}
        <Link
          href="/attendance"
          className="group rounded-xl border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-3 hover:shadow-sm hover:border-emerald-200 transition"
        >
          <div className="text-[10px] text-slate-400 mb-1">오늘 출퇴근</div>
          <div className="flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5 text-emerald-500" />
            <div className="flex-1">
              <div className="text-[12px] text-slate-700">
                <span className={today?.checkIn ? "font-semibold text-emerald-700" : "text-slate-400"}>
                  출근 {fmtTime(today?.checkIn ?? null)}
                </span>
              </div>
              <div className="text-[12px] text-slate-700">
                <span className={today?.checkOut ? "font-semibold text-rose-700" : "text-slate-400"}>
                  퇴근 {fmtTime(today?.checkOut ?? null)}
                </span>
              </div>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-brand-500 transition" />
          </div>
        </Link>

        {/* 연차 잔여 */}
        <Link
          href="/leaves"
          className="group rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50 to-white p-3 hover:shadow-sm hover:border-blue-200 transition"
        >
          <div className="text-[10px] text-slate-400 mb-1">{leaveLabel} 잔여</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-blue-700">{remaining}</span>
            <span className="text-xs text-slate-400">/ {total}일</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">사용 {used}일 · 근속 {balance.tenure}</div>
        </Link>

        {/* 신청 바로가기 */}
        <Link
          href="/leaves"
          className="group rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3 hover:bg-brand-50 hover:border-brand-300 transition flex flex-col justify-center items-center text-center"
        >
          <CalendarDays className="w-5 h-5 text-brand-500 mb-1" />
          <div className="text-[12px] font-semibold text-brand-700">휴가 신청</div>
          <div className="text-[10px] text-slate-500">연차 · 월차 · 반차</div>
        </Link>
      </div>
    </div>
  );
}
