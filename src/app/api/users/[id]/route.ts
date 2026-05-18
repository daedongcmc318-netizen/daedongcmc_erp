import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const DATE_FIELDS = ["joinDate", "leaveDate"];
const FLOAT_FIELDS = ["annualLeaveTotal", "annualLeaveUsed"];
const BIGINT_FIELDS = ["consultantRate"];
const BOOL_FIELDS = ["isInternal", "isPM"];
const ALLOWED = new Set([
  "empNo",
  "name",
  "residentNo",
  "email",
  "phone",
  "mobile",
  "dept",
  "position",
  "positionTitle",
  "role",
  "pmCode",
  "joinDate",
  "joinType",
  "leaveDate",
  "leaveReason",
  "status",
  "bankName",
  "accountNo",
  "accountHolder",
  "postCode",
  "address",
  "passportNo",
  "foreignName1",
  "foreignName2",
  "householderType",
  "annualLeaveTotal",
  "annualLeaveUsed",
  "isInternal",
  "isPM",
  "consultantGrade",
  "consultantRate",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (DATE_FIELDS.includes(k)) {
      data[k] = v ? new Date(v as string) : null;
    } else if (FLOAT_FIELDS.includes(k)) {
      data[k] = Number(v);
    } else if (BIGINT_FIELDS.includes(k)) {
      data[k] = v == null || v === "" ? BigInt(0) : BigInt(v as any);
    } else if (BOOL_FIELDS.includes(k)) {
      data[k] = !!v;
    } else {
      data[k] = v;
    }
  }
  // pmCode unique 충돌 회피
  if (data.pmCode) {
    const conflict = await prisma.user.findFirst({
      where: { pmCode: data.pmCode, id: { not: params.id } },
    });
    if (conflict) {
      await prisma.user.update({ where: { id: conflict.id }, data: { pmCode: null } });
    }
  }
  try {
    const updated = await prisma.user.update({ where: { id: params.id }, data });
    revalidatePath("/users");
    revalidatePath("/");
    // consultantRate(BigInt) 안전 직렬화
    return NextResponse.json(serializeProject(updated));
  } catch (err: any) {
    console.error("[USER PATCH ERROR]", err);
    return NextResponse.json(
      { error: err?.message ?? "수정 실패", code: err?.code },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // 프로젝트의 manager 관계만 null로, 사용자는 soft-delete(status=inactive)
  await prisma.project.updateMany({
    where: { managerId: params.id },
    data: { managerId: null },
  });
  await prisma.user.update({ where: { id: params.id }, data: { status: "inactive" } });
  revalidatePath("/users");
  return NextResponse.json({ ok: true });
}
