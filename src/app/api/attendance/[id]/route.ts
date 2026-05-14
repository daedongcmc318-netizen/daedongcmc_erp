import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["checkIn", "checkOut", "status", "notes"]);
const DATE_FIELDS = ["checkIn", "checkOut"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden — admin 만 가능" }, { status: 403 });

  const body = await req.json();
  const data: any = { editedById: me.id, editedAt: new Date() };
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (DATE_FIELDS.includes(k)) {
      data[k] = v ? new Date(v as string) : null;
    } else if (v === "" || v === undefined) {
      data[k] = null;
    } else {
      data[k] = v;
    }
  }

  const updated = await prisma.attendance.update({ where: { id: params.id }, data });
  revalidatePath("/attendance");
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden — admin 만 가능" }, { status: 403 });
  await prisma.attendance.delete({ where: { id: params.id } });
  revalidatePath("/attendance");
  return NextResponse.json({ ok: true });
}
