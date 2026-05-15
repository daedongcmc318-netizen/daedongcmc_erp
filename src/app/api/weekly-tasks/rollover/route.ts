import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { nextWorkday } from "@/lib/workdays";

export const dynamic = "force-dynamic";

/**
 * POST /api/weekly-tasks/rollover
 *   { userId?, fromDate: "YYYY-MM-DD" }
 *
 * fromDate 의 미완료 업무를 다음 영업일로 이관(date 업데이트).
 *   금요일 → 월요일, 공휴일 자동 건너뜀.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const userId = body.userId ?? me.id;
  if (userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.fromDate) {
    return NextResponse.json({ error: "fromDate 필수" }, { status: 400 });
  }
  const from = new Date(body.fromDate);
  if (Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "Invalid fromDate" }, { status: 400 });
  }
  const target = nextWorkday(from);
  // KST 00:00 으로 정규화
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  // fromDate 의 미완료 업무들 조회 (해당 날짜 전체 범위)
  const dayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const candidates = await prisma.weeklyTask.findMany({
    where: {
      userId,
      completed: false,
      status: { not: "done" },
      date: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ moved: 0, target: targetDate.toISOString() });
  }

  await prisma.weeklyTask.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { date: targetDate },
  });

  revalidatePath(`/managers/${userId}`);
  return NextResponse.json({ moved: candidates.length, target: targetDate.toISOString() });
}
