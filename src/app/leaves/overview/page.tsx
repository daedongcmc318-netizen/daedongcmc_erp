import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateAnnualLeaveTotal,
  calculateMonthlyLeaveTotal,
  formatTenure,
} from "@/lib/leaves";
import LeavesOverviewClient from "@/components/LeavesOverviewClient";

export const dynamic = "force-dynamic";

const DEDUCTING_TYPES = ["annual", "monthly", "half_am", "half_pm"];

export default async function LeavesOverviewPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/leaves/overview");

  const year = Number(searchParams.year ?? new Date().getFullYear());
  const isPriv = me.role === "admin" || me.role === "manager";

  // 내부직원만 표시
  const where = isPriv ? { isInternal: true, status: "active" } : { id: me.id };
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      dept: true,
      position: true,
      joinDate: true,
      isInternal: true,
    },
    orderBy: [{ dept: "asc" }, { name: "asc" }],
  });

  const userIds = users.map((u) => u.id);

  // 해당 연도 승인된 휴가
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "approved",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { id: true, userId: true, type: true, days: true, startDate: true, endDate: true },
  });

  // pending 결재중
  const pending = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "pending",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { id: true, userId: true, type: true, days: true },
  });

  // 해당 연도 수동 한도
  const quotas = await prisma.userLeaveQuota.findMany({
    where: { userId: { in: userIds }, year },
  });
  const quotaByUser = new Map(quotas.map((q) => [q.userId, q]));

  // 전년도 (월차 이월 계산용) — 연차는 이월 불가, 월차만 다음해로 이월
  const prevYear = year - 1;
  const prevYearStart = new Date(prevYear, 0, 1);
  const prevYearEnd = new Date(year, 0, 1);
  const [prevLeaves, prevQuotas] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: "approved",
        startDate: { gte: prevYearStart, lt: prevYearEnd },
      },
      select: { userId: true, type: true, days: true },
    }),
    prisma.userLeaveQuota.findMany({
      where: { userId: { in: userIds }, year: prevYear },
    }),
  ]);
  const prevQuotaByUser = new Map(prevQuotas.map((q) => [q.userId, q]));

  // 전년도 월차 이월: max(0, 전년월차한도 - 전년월차사용)
  const carryoverByUser = new Map<string, number>();
  for (const u of users) {
    const pq = prevQuotaByUser.get(u.id);
    const prevMonthlyTotal = pq
      ? pq.monthlyTotal
      : u.joinDate
        ? calculateMonthlyLeaveTotal(u.joinDate, prevYearEnd)
        : 0;
    // 전년에 월차 한도가 있었으면 그 한도에서 deducting type 사용분 차감 → 이월
    if (prevMonthlyTotal <= 0) {
      carryoverByUser.set(u.id, 0);
      continue;
    }
    let prevAnnualTotal = pq
      ? pq.annualTotal
      : u.joinDate
        ? calculateAnnualLeaveTotal(u.joinDate, prevYearEnd)
        : 0;
    // 전년에 deducting 사용분 (연차/월차/반차 합산). 연차 한도가 먼저 소진된 후 월차 사용
    let prevDeducting = 0;
    for (const l of prevLeaves) {
      if (l.userId !== u.id) continue;
      if (!DEDUCTING_TYPES.includes(l.type)) continue;
      prevDeducting += l.days;
    }
    // 연차 한도 먼저 소진 후 월차 차감
    const usedAgainstAnnual = Math.min(prevAnnualTotal, prevDeducting);
    const usedAgainstMonthly = Math.max(0, prevDeducting - usedAgainstAnnual);
    const monthlyLeftover = Math.max(0, prevMonthlyTotal - usedAgainstMonthly);
    carryoverByUser.set(u.id, monthlyLeftover);
  }

  // 신청 단계 (currentLevel / 최종승인 여부) 조회 — "결재상태" 표시용. 가장 최근 신청 1건
  const recentRequests = await prisma.leaveRequest.findMany({
    where: { userId: { in: userIds }, startDate: { gte: yearStart, lt: yearEnd } },
    select: { userId: true, status: true, currentLevel: true, startDate: true },
    orderBy: { createdAt: "desc" },
  });
  const requestSummaryByUser = new Map<
    string,
    { pendingCount: number; approvedCount: number; rejectedCount: number }
  >();
  for (const r of recentRequests) {
    const s = requestSummaryByUser.get(r.userId) ?? { pendingCount: 0, approvedCount: 0, rejectedCount: 0 };
    if (r.status === "pending") s.pendingCount += 1;
    else if (r.status === "approved") s.approvedCount += 1;
    else if (r.status === "rejected") s.rejectedCount += 1;
    requestSummaryByUser.set(r.userId, s);
  }

  const now = new Date();
  const rows = users.map((u) => {
    const myLeaves = leaves.filter((l) => l.userId === u.id);
    const myPending = pending.filter((p) => p.userId === u.id);
    const q = quotaByUser.get(u.id);

    const annualTotal = q ? q.annualTotal : u.joinDate ? calculateAnnualLeaveTotal(u.joinDate, now) : 0;
    const monthlyBase = q ? q.monthlyTotal : u.joinDate ? calculateMonthlyLeaveTotal(u.joinDate, now) : 0;
    const carryover = carryoverByUser.get(u.id) ?? 0;
    // 연차/월차 통합: 한도 = 연차 + 월차(이월 포함)
    const combinedTotal = annualTotal + monthlyBase + carryover;

    let combinedUsed = 0;
    const byType: Record<string, number> = {};
    for (const l of myLeaves) {
      byType[l.type] = (byType[l.type] ?? 0) + l.days;
      if (DEDUCTING_TYPES.includes(l.type)) combinedUsed += l.days;
    }
    let pendingDeducting = 0;
    for (const p of myPending) {
      if (DEDUCTING_TYPES.includes(p.type)) pendingDeducting += p.days;
    }

    const summary = requestSummaryByUser.get(u.id) ?? {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };

    return {
      id: u.id,
      name: u.name,
      dept: u.dept,
      position: u.position,
      joinDate: u.joinDate ? u.joinDate.toISOString() : null,
      tenure: formatTenure(u.joinDate, now),
      // 통합 연차/월차
      combinedTotal,
      combinedUsed,
      combinedRemaining: combinedTotal - combinedUsed,
      // 내부 분해 (툴팁/근거 표시용)
      annualTotal,
      monthlyBase,
      carryover,
      pendingDeducting,
      byType,
      hasQuota: !!q,
      // 결재상태
      approvalSummary: summary,
    };
  });

  return (
    <LeavesOverviewClient
      year={year}
      rows={rows}
      isPriv={isPriv}
      me={{ id: me.id, name: me.name, role: me.role }}
    />
  );
}
