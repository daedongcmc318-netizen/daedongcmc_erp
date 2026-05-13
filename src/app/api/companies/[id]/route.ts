import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const DATE_FIELDS = ["foundedAt"];
const ALLOWED = new Set([
  "name",
  "bizNo",
  "repName",
  "address",
  "region",
  "type",
  "website",
  "industry",
  "corpType",
  "foundedAt",
  "rating",
  "internalPmCode",
  "items",
  "notes",
]);

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
  const updated = await prisma.company.update({
    where: { id: params.id },
    data,
    include: {
      contacts: { take: 1, orderBy: { isPrimary: "desc" } },
      _count: { select: { clientProjects: true, agencyProjects: true } },
    },
  });
  revalidatePath("/companies");
  revalidatePath("/");
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // 프로젝트가 연결된 거래처는 삭제 거부
  const used = await prisma.project.count({
    where: { OR: [{ companyId: params.id }, { agencyId: params.id }] },
  });
  if (used > 0) {
    return NextResponse.json(
      { error: `연결된 프로젝트가 ${used}건 있어 삭제할 수 없습니다.` },
      { status: 409 }
    );
  }
  await prisma.company.delete({ where: { id: params.id } });
  revalidatePath("/companies");
  return NextResponse.json({ ok: true });
}
