import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/weekly-tasks?userId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
 *   - userId 미지정 시 본인 것을 반환
 *   - 본인 또는 admin 만 조회 가능
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? me.id;
  if (userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const where: any = { userId };
  if (start && end) {
    where.date = { gte: new Date(start), lte: new Date(end) };
  }

  const tasks = await prisma.weeklyTask.findMany({
    where,
    orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks.map(serializeProject));
}

/**
 * POST /api/weekly-tasks
 * 본인 것만 생성 가능 (userId 명시는 admin만 허용)
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const userId = body.userId ?? me.id;
  if (userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = String(body.title ?? "").trim();
  // title 은 빈 문자열이어도 허용 (빈 행 삽입 후 인라인 편집)

  // 같은 날짜 마지막 sortOrder
  const last = await prisma.weeklyTask.findFirst({
    where: { userId, date: new Date(body.date) },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.weeklyTask.create({
    data: {
      userId,
      date: body.date ? new Date(body.date) : new Date(),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      category: body.category ?? null,
      priority: body.priority ?? null,
      status: body.status ?? "not_started",
      title,
      notes: body.notes ?? null,
      completed: !!body.completed,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/managers/${userId}`);
  return NextResponse.json(serializeProject(created));
}
