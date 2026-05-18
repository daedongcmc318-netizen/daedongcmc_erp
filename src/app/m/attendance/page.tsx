import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocations } from "@/lib/geo";
import MobileAttendanceClient from "@/components/mobile/MobileAttendanceClient";

export const dynamic = "force-dynamic";

export default async function MobileAttendancePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/m/attendance");

  const myUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, name: true, dept: true, position: true, isInternal: true },
  });
  if (!myUser) redirect("/login");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = await prisma.attendance.findUnique({
    where: { userId_date: { userId: me.id, date: todayStart } },
  });

  // 최근 7일
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const recent = await prisma.attendance.findMany({
    where: { userId: me.id, date: { gte: since } },
    orderBy: { date: "desc" },
  });

  const offices = await getOfficeLocations();

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

  return (
    <MobileAttendanceClient
      me={{ ...myUser, isInternal: myUser.isInternal || me.role === "admin", role: me.role }}
      today={today ? serialize(today) : null}
      recent={serialize(recent)}
      offices={offices}
    />
  );
}
