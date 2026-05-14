import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import AttendanceMonthlyClient from "@/components/AttendanceMonthlyClient";

export const dynamic = "force-dynamic";

export default async function AttendanceMonthlyPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; userId?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/attendance/monthly");

  const now = new Date();
  const year = Number(searchParams.year ?? now.getFullYear());
  const month = Number(searchParams.month ?? now.getMonth() + 1);
  const filterUserId = searchParams.userId ?? null;

  // 권한: admin/manager 는 전체 / staff 는 본인만
  const isPriv = me.role === "admin" || me.role === "manager";

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  // 내부직원 + admin/manager
  const users = await prisma.user.findMany({
    where: {
      status: "active",
      OR: [{ isInternal: true }, { role: "admin" }],
    },
    select: { id: true, name: true, dept: true, position: true, isInternal: true, role: true },
    orderBy: [{ dept: "asc" }, { name: "asc" }],
  });

  // staff는 본인만
  const targetUserIds = isPriv
    ? filterUserId
      ? [filterUserId]
      : users.map((u) => u.id)
    : [me.id];

  const records = await prisma.attendance.findMany({
    where: {
      userId: { in: targetUserIds },
      date: { gte: start, lt: end },
    },
    orderBy: { date: "asc" },
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: targetUserIds },
      status: "approved",
      OR: [
        { startDate: { gte: start, lt: end } },
        { endDate: { gte: start, lt: end } },
        { AND: [{ startDate: { lt: start } }, { endDate: { gte: end } }] },
      ],
    },
    select: { id: true, userId: true, type: true, startDate: true, endDate: true, days: true },
  });

  return (
    <AttendanceMonthlyClient
      me={{ id: me.id, name: me.name, role: me.role }}
      year={year}
      month={month}
      users={isPriv ? users : users.filter((u) => u.id === me.id)}
      records={records.map(serializeProject) as any}
      leaves={leaves.map(serializeProject) as any}
      filterUserId={filterUserId}
      isPriv={isPriv}
    />
  );
}
