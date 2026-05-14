import { prisma } from "@/lib/prisma";
import InternalStaffWidgetClient from "@/components/InternalStaffWidgetClient";

/**
 * 사무실 내부직원(isInternal=true)의 오늘 근무 현황 위젯.
 * 메인 대시보드 우측에 배치. 4명 기본 표시.
 *
 * 상태 우선순위 (오늘 기준):
 *   1. 승인된 휴가가 있으면 → leave (반차/연차/월차로 세분)
 *   2. Attendance.status="business_trip" → 출장
 *   3. checkIn + checkOut 둘 다 → 퇴근
 *   4. checkIn 있고 checkOut 없음 → 근무중
 *   5. 아무것도 없음 → 출근 전
 */
export default async function InternalStaffWidget() {
  const internalUsers = await prisma.user.findMany({
    where: { isInternal: true, status: "active" },
    select: {
      id: true,
      name: true,
      dept: true,
      position: true,
      joinDate: true,
    },
    orderBy: { name: "asc" },
  });

  if (internalUsers.length === 0) {
    return null;
  }

  // 오늘 0시 기준
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const userIds = internalUsers.map((u) => u.id);

  const [todayAttendances, todayLeaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: { in: userIds }, date: today },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: "approved",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { id: true, userId: true, type: true, startDate: true, endDate: true },
    }),
  ]);

  type StaffItem = {
    id: string;
    name: string;
    dept: string;
    position: string;
    status: "before_work" | "working" | "after_work" | "business_trip" | "leave";
    statusLabel: string;
    leaveType: string | null; // annual/monthly/half_am/half_pm
    checkIn: string | null;
    checkOut: string | null;
  };

  const items: StaffItem[] = internalUsers.map((u) => {
    const att = todayAttendances.find((a) => a.userId === u.id);
    const leave = todayLeaves.find((l) => l.userId === u.id);

    let status: StaffItem["status"] = "before_work";
    let statusLabel = "출근 전";
    let leaveType: string | null = null;

    if (leave) {
      status = "leave";
      leaveType = leave.type;
      statusLabel =
        leave.type === "half_am"
          ? "오전반차"
          : leave.type === "half_pm"
            ? "오후반차"
            : leave.type === "monthly"
              ? "월차"
              : "연차";
    } else if (att?.status === "business_trip") {
      status = "business_trip";
      statusLabel = "출장";
    } else if (att?.checkIn && att?.checkOut) {
      status = "after_work";
      statusLabel = "퇴근";
    } else if (att?.checkIn) {
      status = "working";
      statusLabel = "근무중";
    }

    return {
      id: u.id,
      name: u.name,
      dept: u.dept,
      position: u.position,
      status,
      statusLabel,
      leaveType,
      checkIn: att?.checkIn ? att.checkIn.toISOString() : null,
      checkOut: att?.checkOut ? att.checkOut.toISOString() : null,
    };
  });

  return <InternalStaffWidgetClient items={items} totalInternal={internalUsers.length} />;
}
