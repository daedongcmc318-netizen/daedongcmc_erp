import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const full = searchParams.get("full") === "1";
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { empNo: "asc" }],
    ...(full
      ? {}
      : {
          select: {
            id: true,
            name: true,
            pmCode: true,
            dept: true,
            position: true,
            role: true,
            empNo: true,
          },
        }),
  });
  // full=1 일 때 consultantRate(BigInt) 포함되므로 serialize 필수
  return NextResponse.json(users.map(serializeProject));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const empNo = body.empNo?.trim() || `NEW${Date.now().toString().slice(-7)}`;

    // empNo 중복 사전 체크 (좀 더 친절한 에러)
    const dup = await prisma.user.findUnique({ where: { empNo } });
    if (dup) {
      return NextResponse.json(
        { error: `사원번호 '${empNo}' 가 이미 사용 중입니다.` },
        { status: 409 }
      );
    }

    const data: any = {
      empNo,
      name: body.name,
      dept: body.dept || "(미지정)",
      position: body.position || "(미지정)",
      role: body.role || "staff",
      status: "active",
      residentNo: body.residentNo || null,
      email: body.email || null,
      phone: body.phone || null,
      mobile: body.mobile || null,
      positionTitle: body.positionTitle || null,
      pmCode: body.pmCode || null,
      joinDate: body.joinDate ? new Date(body.joinDate) : null,
      joinType: body.joinType || null,
      bankName: body.bankName || null,
      accountNo: body.accountNo || null,
      accountHolder: body.accountHolder || null,
      postCode: body.postCode || null,
      address: body.address || null,
    };
    const u = await prisma.user.create({ data });
    revalidatePath("/users");
    // ★ User 모델의 consultantRate 가 BigInt 라 JSON 직렬화 시 에러 발생 → serializeProject 로 안전 변환
    return NextResponse.json(serializeProject(u));
  } catch (err: any) {
    console.error("[USER POST ERROR]", err);
    return NextResponse.json(
      { error: err?.message ?? "직원 생성 실패", code: err?.code },
      { status: 500 }
    );
  }
}
