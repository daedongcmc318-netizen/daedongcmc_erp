import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
    }

    // username = empNo / pmCode / email / 별칭(jhchoi 등)
    const aliasMap: Record<string, { name: string }> = {
      jhchoi: { name: "최진혁" },
    };
    const alias = aliasMap[username.toLowerCase()];

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { empNo: username },
          { pmCode: username.toUpperCase() },
          { email: username },
          ...(alias ? [{ name: alias.name }] : []),
        ],
        status: { not: "inactive" },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 일치하지 않습니다." },
        { status: 401 }
      );
    }

    setSessionCookie(user.id);
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        empNo: user.empNo,
        role: user.role,
        dept: user.dept,
        position: user.position,
      },
    });
  } catch (err: any) {
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        detail: err?.message ?? String(err),
        stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
