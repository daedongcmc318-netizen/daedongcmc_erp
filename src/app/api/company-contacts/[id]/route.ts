import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const ALLOWED = new Set(["name", "position", "phone", "email", "isPrimary"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    data[k] = v === "" ? null : v;
  }
  const c = await prisma.companyContact.update({ where: { id: params.id }, data });
  revalidatePath("/companies");
  return NextResponse.json(c);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.companyContact.delete({ where: { id: params.id } });
  revalidatePath("/companies");
  return NextResponse.json({ ok: true });
}
