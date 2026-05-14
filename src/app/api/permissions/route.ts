import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const perms = await prisma.permission.findMany({
    orderBy: [{ role: "asc" }, { section: "asc" }],
  });
  return NextResponse.json(perms);
}

// 일괄 업데이트: { permissions: [{role, section, canView, canEdit, canDelete}, ...] }
export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "관리자만 가능" }, { status: 403 });

  const body = await req.json();
  if (!Array.isArray(body.permissions)) {
    return NextResponse.json({ error: "permissions 배열 필요" }, { status: 400 });
  }

  // admin은 항상 모든 권한을 가지도록 강제
  for (const p of body.permissions) {
    if (p.role === "admin") {
      p.canView = true;
      p.canEdit = true;
      p.canDelete = true;
    }
  }

  await prisma.$transaction(
    body.permissions.map((p: any) =>
      prisma.permission.upsert({
        where: { role_section: { role: p.role, section: p.section } },
        update: {
          canView: !!p.canView,
          canEdit: !!p.canEdit,
          canDelete: !!p.canDelete,
        },
        create: {
          role: p.role,
          section: p.section,
          canView: !!p.canView,
          canEdit: !!p.canEdit,
          canDelete: !!p.canDelete,
        },
      })
    )
  );
  revalidatePath("/permissions");
  return NextResponse.json({ ok: true, count: body.permissions.length });
}
