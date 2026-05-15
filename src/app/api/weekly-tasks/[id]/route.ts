import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

const ALLOWED = new Set([
  "date",
  "category",
  "priority",
  "status",
  "title",
  "progress",
  "notes",
  "completed",
  "sortOrder",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.weeklyTask.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (k === "date") {
      data.date = v ? new Date(v as string) : null;
    } else {
      data[k] = v;
    }
  }
  // completed 동기화: status === "done" → completed=true (반대 자동)
  if (data.status === "done") data.completed = true;
  if (data.completed === true && !data.status) data.status = "done";
  if (data.completed === false && data.status === "done") data.status = "in_progress";

  const updated = await prisma.weeklyTask.update({ where: { id: params.id }, data });
  revalidatePath(`/managers/${task.userId}`);
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.weeklyTask.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.weeklyTask.delete({ where: { id: params.id } });
  revalidatePath(`/managers/${task.userId}`);
  return NextResponse.json({ ok: true });
}
