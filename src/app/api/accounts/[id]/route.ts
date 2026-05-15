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
  // 이메일 (로그인 ID) 변경
  if (typeof body.email === "string") {
    const newEmail = body.email.trim().toLowerCase();
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
    }
    // 중복 검사 (자기 자신 제외)
    if (newEmail) {
      const dup = await prisma.user.findFirst({
        where: { email: newEmail, id: { not: params.id } },
        select: { id: true, name: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: `이미 같은 이메일을 사용하는 사용자가 있습니다 (${dup.name})` },
          { status: 409 }
        );
      }
    }
    data.email = newEmail || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 필드 없음" }, { status: 400 });
  }
  const u = await prisma.user.update({ where: { id: params.id }, data });
  revalidatePath("/accounts");
  return NextResponse.json({ ok: true, userId: u.id });
}
