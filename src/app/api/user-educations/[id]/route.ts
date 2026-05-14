import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const DATE_FIELDS = ["enterDate", "graduateDate"];
const ALLOWED = new Set(["level", "schoolName", "major", "location", "enterDate", "graduateDate", "daytime", "graduateType", "note"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (DATE_FIELDS.includes(k)) data[k] = v ? new Date(v as string) : null;
    else data[k] = v;
  }
  const e = await prisma.userEducation.update({ where: { id: params.id }, data });
  revalidatePath("/users");
  return NextResponse.json(e);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.userEducation.delete({ where: { id: params.id } });
  revalidatePath("/users");
  return NextResponse.json({ ok: true });
}
