import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocations } from "@/lib/geo";
import AttendanceClient from "@/components/AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/attendance");

  const myUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, name: true, dept: true, position: true, isInternal: true },
  });
  if (!myUser) redirect("/login");

  // admin은 isInternal 무관하게 접근 허용 — 강제 활성
  const effectiveInternal = myUser.isInternal || me.role === "admin";

  // 최근 30일 근태
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const records = await prisma.attendance.findMany({
    where: { userId: me.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  // 오늘 기록
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = await prisma.attendance.findUnique({
    where: { userId_date: { userId: me.id, date: todayStart } },
  });

  const serialize = (v: any): any => {
    if (v == null) return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(serialize);
    if (typeof v === "object") {
      const o: any = {};
      for (const k of Object.keys(v)) o[k] = serialize(v[k]);
      return o;
    }
    return v;
  };

  const offices = await getOfficeLocations();

  // 관리자에게는 오늘 전체 내부직원 출퇴근 현황 동봉 (워크/관리자 모드 전환용)
  let allTodayAttendance: any[] = [];
  let internalUsers: any[] = [];
  if (me.role === "admin") {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const tEnd = new Date(t);
    tEnd.setDate(tEnd.getDate() + 1);

    internalUsers = await prisma.user.findMany({
      where: { status: "active", isInternal: true },
      select: { id: true, name: true, dept: true, position: true },
      orderBy: { name: "asc" },
    });
    allTodayAttendance = await prisma.attendance.findMany({
      where: { date: { gte: t, lt: tEnd }, user: { isInternal: true, status: "active" } },
      include: { user: { select: { id: true, name: true, dept: true, position: true } } },
      orderBy: { checkIn: "asc" },
    });
  }

  return (
    <AttendanceClient
      me={{ ...myUser, isInternal: effectiveInternal, role: me.role }}
      today={today ? serialize(today) : null}
      records={serialize(records)}
      offices={offices}
      adminData={
        me.role === "admin"
          ? {
              allTodayAttendance: serialize(allTodayAttendance),
              internalUsers,
            }
          : null
      }
    />
  );
}
