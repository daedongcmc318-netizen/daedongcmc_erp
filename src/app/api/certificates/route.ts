import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function nextCertNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const last = await prisma.certificate.findFirst({
    where: { certNo: { startsWith: prefix } },
    orderBy: { certNo: "desc" },
    select: { certNo: true },
  });
  let n = 1;
  if (last) {
    const m = last.certNo.match(/-(\d+)$/);
    if (m) n = Number(m[1]) + 1;
  }
  return `${year}-${n}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const where: any = {};
  if (userId) where.userId = userId;
  const list = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, empNo: true } },
    },
  });
  return NextResponse.json(list.map(serializeProject));
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const body = await req.json();
  if (!body.userId || !body.type) {
    return NextResponse.json({ error: "userId, type required" }, { status: 400 });
  }
  const certNo = body.certNo || (await nextCertNo());
  const cert = await prisma.certificate.create({
    data: {
      certNo,
      type: body.type,
      userId: body.userId,
      purpose: body.purpose ?? null,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      customBody: body.customBody ?? null,
      createdById: me?.id ?? null,
    },
    include: { user: { select: { id: true, name: true, empNo: true } } },
  });
  revalidatePath("/users");
  return NextResponse.json(serializeProject(cert));
}
