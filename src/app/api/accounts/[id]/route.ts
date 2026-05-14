import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "로그인 필요" }, { status: 401 }) };
  if (me.role !== "admin") {
    return { error: NextResponse.json({ error: "관리자만 접근 가능" }, { status: 403 }) };
  }
  return { me };
}

// PATCH: role, status, password 변경
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const body = await req.json();
  const data: any = {};
  if (body.role && ["admin", "manager", "staff"].includes(body.role)) data.role = body.role;
  if (body.status && ["active", "inactive", "leave"].includes(body.status)) data.status = body.status;
  if (body.password) {
    if (String(body.password).length < 4) {
      return NextResponse.json({ error: "비밀번호는 4자 이상" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }
  // 비번 제거 옵션
  if (body.clearPassword === true) {
    data.passwordHash = null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 필드 없음" }, { status: 400 });
  }
  const u = await prisma.user.update({ where: { id: params.id }, data });
  revalidatePath("/accounts");
  return NextResponse.json({ ok: true, userId: u.id });
}
