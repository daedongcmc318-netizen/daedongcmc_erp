import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const empNo = body.empNo?.trim() || `NEW${Date.now().toString().slice(-7)}`;
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
  return NextResponse.json(u);
}
