import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const DATE_FIELDS = ["issueDate", "startDate", "endDate"];
const ALLOWED = new Set(["purpose", "issueDate", "startDate", "endDate", "customBody", "type"]);

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
  const c = await prisma.certificate.update({
    where: { id: params.id },
    data,
    include: { user: { select: { id: true, name: true, empNo: true } } },
  });
  revalidatePath("/users");
  return NextResponse.json(serializeProject(c));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.certificate.delete({ where: { id: params.id } });
  revalidatePath("/users");
  return NextResponse.json({ ok: true });
}
