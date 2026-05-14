import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const list = await prisma.userEducation.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !body.schoolName) {
    return NextResponse.json({ error: "userId, schoolName required" }, { status: 400 });
  }
  const last = await prisma.userEducation.findFirst({
    where: { userId: body.userId },
    orderBy: { sortOrder: "desc" },
  });
  const e = await prisma.userEducation.create({
    data: {
      userId: body.userId,
      level: body.level ?? "대학",
      schoolName: body.schoolName,
      major: body.major ?? null,
      location: body.location ?? null,
      enterDate: body.enterDate ? new Date(body.enterDate) : null,
      graduateDate: body.graduateDate ? new Date(body.graduateDate) : null,
      daytime: body.daytime ?? null,
      graduateType: body.graduateType ?? "졸업",
      note: body.note ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/users");
  return NextResponse.json(e);
}
