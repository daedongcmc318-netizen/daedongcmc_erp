/**
 * 계정관리 API
 * - GET: 모든 사용자 + 계정 상태 (비번 설정 여부, role, status)
 * - POST: 신규 계정 생성 (직원 신규생성 + 비번 부여, OR 기존 직원에 비번만 부여)
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "로그인 필요" }, { status: 401 }) };
  if (me.role !== "admin") {
    return { error: NextResponse.json({ error: "관리자만 접근 가능" }, { status: 403 }) };
  }
  return { me };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { empNo: "asc" }],
    select: {
      id: true,
      empNo: true,
      name: true,
      email: true,
      dept: true,
      position: true,
      role: true,
      pmCode: true,
      status: true,
      passwordHash: true,
      updatedAt: true,
    },
  });

  // passwordHash는 직접 보내지 않고 boolean으로
  return NextResponse.json(
    users.map((u) => ({
      ...u,
      hasPassword: !!u.passwordHash,
      passwordHash: undefined,
    }))
  );
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  const body = await req.json();
  // 모드 1: 기존 직원에 비번 부여 (userId 제공)
  // 모드 2: 신규 직원 + 비번 한번에 생성 (name + empNo + password)
  if (body.userId && body.password) {
    const hash = await bcrypt.hash(body.password, 10);
    const u = await prisma.user.update({
      where: { id: body.userId },
      data: { passwordHash: hash, ...(body.role ? { role: body.role } : {}) },
    });
    revalidatePath("/accounts");
    return NextResponse.json({ ok: true, userId: u.id });
  }

  if (!body.name || !body.password) {
    return NextResponse.json({ error: "name, password 필요" }, { status: 400 });
  }

  const empNo = body.empNo?.trim() || `ACC${Date.now().toString().slice(-7)}`;
  const exists = await prisma.user.findUnique({ where: { empNo } });
  if (exists) return NextResponse.json({ error: "이미 같은 사원번호의 계정이 있습니다." }, { status: 409 });

  const hash = await bcrypt.hash(body.password, 10);
  const u = await prisma.user.create({
    data: {
      empNo,
      name: body.name,
      email: body.email || null,
      dept: body.dept || "시스템",
      position: body.position || "관리자",
      role: body.role || "staff",
      status: "active",
      passwordHash: hash,
    },
  });
  revalidatePath("/accounts");
  revalidatePath("/users");
  return NextResponse.json({ ok: true, userId: u.id });
}
