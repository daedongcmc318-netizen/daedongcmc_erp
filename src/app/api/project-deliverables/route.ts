import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (body.seq == null) return NextResponse.json({ error: "seq required" }, { status: 400 });

  const d = await prisma.projectDeliverable.create({
    data: {
      projectId: body.projectId,
      seq: Number(body.seq),
      title: body.title || "",
      type: body.type ?? null,
      isCompleted: !!body.isCompleted,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      completedDate: body.completedDate ? new Date(body.completedDate) : null,
      notes: body.notes ?? null,
    },
  });
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(d));
}
