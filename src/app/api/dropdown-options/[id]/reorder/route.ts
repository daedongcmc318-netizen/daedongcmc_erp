import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH { direction: "up" | "down" }
 *   같은 category 내에서 인접한 옵션과 sortOrder 교환.
 *   끝/처음에 있어 더 이동할 수 없으면 no-op (200 반환).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const direction = body.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "direction은 up 또는 down" }, { status: 400 });
  }

  const target = await prisma.dropdownOption.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 인접 옵션 찾기
  const neighbor = await prisma.dropdownOption.findFirst({
    where: {
      category: target.category,
      sortOrder:
        direction === "up"
          ? { lt: target.sortOrder }
          : { gt: target.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbor) {
    // 더 이동할 곳이 없으면 그대로
    return NextResponse.json({ ok: true, moved: false });
  }

  // 두 row의 sortOrder swap — 같은 인덱스 발생 가능성 회피 위해 3-step
  const TMP = -999999;
  await prisma.$transaction([
    prisma.dropdownOption.update({ where: { id: target.id }, data: { sortOrder: TMP } }),
    prisma.dropdownOption.update({ where: { id: neighbor.id }, data: { sortOrder: target.sortOrder } }),
    prisma.dropdownOption.update({ where: { id: target.id }, data: { sortOrder: neighbor.sortOrder } }),
  ]);

  revalidatePath("/projects");
  return NextResponse.json({ ok: true, moved: true });
}
