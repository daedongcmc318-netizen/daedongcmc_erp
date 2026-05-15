import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const DATE_FIELDS = ["targetDate"];
const BOOL_FIELDS = ["completed"];
const ALLOWED = new Set([
  "category",
  "title",
  "targetDate",
  "status",
  "priority",
  "assigneeId",
  "assigneeCode",
  "notes",
  "completed",
  "sortOrder",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (DATE_FIELDS.includes(k)) data[k] = v ? new Date(v as string) : null;
    else if (BOOL_FIELDS.includes(k)) data[k] = !!v;
    else data[k] = v;
  }

  const updated = await prisma.majorTask.update({
    where: { id: params.id },
    data,
    include: { assignee: { select: { id: true, name: true, pmCode: true } } },
  });
  revalidatePath("/");
  revalidatePath("/major-tasks");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.majorTask.delete({ where: { id: params.id } });
  revalidatePath("/");
  revalidatePath("/major-tasks");
  return NextResponse.json({ ok: true });
}
