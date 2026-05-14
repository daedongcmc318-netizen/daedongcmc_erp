import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST { ids: string[] } — 다중 프로젝트 삭제
export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids 배열 필요" }, { status: 400 });
  }
  const result = await prisma.project.deleteMany({
    where: { id: { in: ids } },
  });
  revalidatePath("/projects");
  revalidatePath("/");
  return NextResponse.json({ ok: true, deleted: result.count });
}
