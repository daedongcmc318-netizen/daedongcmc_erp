import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const DATE_FIELDS = ["dueDate", "completedDate"];
const ALLOWED = new Set(["seq", "title", "type", "isCompleted", "dueDate", "completedDate", "notes"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (DATE_FIELDS.includes(k)) {
      data[k] = v ? new Date(v as string) : null;
    } else {
      data[k] = v;
    }
  }
  const d = await prisma.projectDeliverable.update({ where: { id: params.id }, data });
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(d));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.projectDeliverable.delete({ where: { id: params.id } });
  revalidatePath("/projects");
  return NextResponse.json({ ok: true });
}
