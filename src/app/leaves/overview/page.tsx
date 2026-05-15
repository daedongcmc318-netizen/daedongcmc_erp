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

  // 해당 연도 승인된 휴가
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      status: "approved",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { id: true, userId: true, type: true, days: true, startDate: true, endDate: true },
  });

  // pending 휴가도 같이 (정보 제공용)
  const pending = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      status: "pending",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { id: true, userId: true, type: true, days: true },
  });

  const now = new Date();
  const rows = users.map((u) => {
    const myLeaves = leaves.filter((l) => l.userId === u.id);
    const myPending = pending.filter((p) => p.userId === u.id);

    // 차감 대상: annual / monthly / half_am / half_pm
    const annualTotal = u.joinDate ? calculateAnnualLeaveTotal(u.joinDate, now) : 0;
    const monthlyTotal = u.joinDate ? calculateMonthlyLeaveTotal(u.joinDate, now) : 0;

    let annualUsed = 0;
    let monthlyUsed = 0;
    const byType: Record<string, number> = {};
    for (const l of myLeaves) {
      byType[l.type] = (byType[l.type] ?? 0) + l.days;
      if (l.type === "monthly") monthlyUsed += l.days;
      else if (["annual", "half_am", "half_pm"].includes(l.type)) annualUsed += l.days;
    }
    let pendingDeducting = 0;
    for (const p of myPending) {
      if (["annual", "monthly", "half_am", "half_pm"].includes(p.type)) {
        pendingDeducting += p.days;
      }
    }

    return {
      id: u.id,
      name: u.name,
      dept: u.dept,
      position: u.position,
      joinDate: u.joinDate ? u.joinDate.toISOString() : null,
      tenure: formatTenure(u.joinDate, now),
      annualTotal,
      annualUsed,
      annualRemaining: Math.max(0, annualTotal - annualUsed),
      monthlyTotal,
      monthlyUsed,
      monthlyRemaining: Math.max(0, monthlyTotal - monthlyUsed),
      pendingDeducting,
      byType,
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
