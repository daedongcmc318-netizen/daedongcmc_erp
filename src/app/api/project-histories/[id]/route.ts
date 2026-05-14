import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const text = String(body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "body 필수" }, { status: 400 });

  const existing = await prisma.projectHistory.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById && existing.createdById !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "본인 기록만 수정 가능" }, { status: 403 });
  }

  const updated = await prisma.projectHistory.update({
    where: { id: params.id },
    data: { body: text },
  });
  revalidatePath("/projects");
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.projectHistory.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById && existing.createdById !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "본인 기록만 삭제 가능" }, { status: 403 });
  }

  await prisma.projectHistory.delete({ where: { id: params.id } });
  revalidatePath("/projects");
  return NextResponse.json({ ok: true });
}
