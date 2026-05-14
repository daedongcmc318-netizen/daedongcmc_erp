import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH { sortOrder: number }
 *   사용자 옵션의 sortOrder를 직접 지정 (Float 가능).
 *   클라이언트에서 하드코딩 옵션 사이의 fractional 위치 계산 후 전달.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sortOrder = Number(body.sortOrder);
  if (isNaN(sortOrder)) {
    return NextResponse.json({ error: "sortOrder 숫자 필수" }, { status: 400 });
  }

  await prisma.dropdownOption.update({
    where: { id: params.id },
    data: { sortOrder },
  });

  revalidatePath("/projects");
  return NextResponse.json({ ok: true, sortOrder });
}
