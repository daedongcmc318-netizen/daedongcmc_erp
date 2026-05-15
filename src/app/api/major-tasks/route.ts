import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "active"; // active / all
  const where = scope === "active" ? { completed: false } : {};

  const items = await prisma.majorTask.findMany({
    where,
    include: { assignee: { select: { id: true, name: true, pmCode: true } } },
    orderBy: [{ completed: "asc" }, { sortOrder: "asc" }, { targetDate: "asc" }],
  });
  return NextResponse.json(items.map(serializeProject));
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title 필수" }, { status: 400 });

  // 마지막 sortOrder
  const last = await prisma.majorTask.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.majorTask.create({
    data: {
      title,
      category: body.category ?? null,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      status: body.status ?? "not_started",
      priority: body.priority ?? null,
      assigneeId: body.assigneeId ?? null,
      assigneeCode: body.assigneeCode ?? null,
      notes: body.notes ?? null,
      completed: !!body.completed,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdById: me.id,
    },
    include: { assignee: { select: { id: true, name: true, pmCode: true } } },
  });
  revalidatePath("/");
  revalidatePath("/major-tasks");
  return NextResponse.json(serializeProject(created));
}
