import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// POST /api/projects/reorder
// body: { source: 'nurture'|'discovery', orderedIds: string[] }
export async function POST(req: NextRequest) {
  const { source, orderedIds } = await req.json();
  if (!Array.isArray(orderedIds) || !source) {
    return NextResponse.json({ error: "source and orderedIds required" }, { status: 400 });
  }
  // 트랜잭션: 받은 순서대로 sortOrder를 1..N으로 재할당
  await prisma.$transaction(
    orderedIds.map((id: string, idx: number) =>
      prisma.project.update({
        where: { id },
        data: { sortOrder: idx + 1 },
      })
    )
  );
  revalidatePath("/projects");
  return NextResponse.json({ ok: true });
}
