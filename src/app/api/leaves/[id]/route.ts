import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH { action: "approve"|"reject"|"cancel", comment? }
 *   - approve: 현재 단계의 결재자만 가능. 통과 후 다음 단계로 이동, 마지막이면 최종 승인.
 *   - reject: 현재 단계의 결재자만 가능. 즉시 거부 처리.
 *   - cancel: 신청자 본인 가능 (status=pending 일 때만)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const action: string = body.action;
  const comment: string | null = body.comment ?? null;

  const lr = await prisma.leaveRequest.findUnique({
    where: { id: params.id },
    include: { approvals: { orderBy: { level: "asc" } } },
  });
  if (!lr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "cancel") {
    if (lr.userId !== me.id) return NextResponse.json({ error: "본인 신청건만 취소 가능" }, { status: 403 });
    if (lr.status !== "pending") return NextResponse.json({ error: "진행 중인 신청만 취소 가능" }, { status: 400 });
    await prisma.leaveRequest.update({ where: { id: params.id }, data: { status: "cancelled" } });
    revalidatePath("/leaves");
    return NextResponse.json({ ok: true });
  }

  // approve/reject — 현재 단계의 결재자여야 함
  const current = lr.approvals.find((a) => a.level === lr.currentLevel && a.status === "pending");
  if (!current) return NextResponse.json({ error: "결재 가능한 단계가 없습니다." }, { status: 400 });
  if (current.approverId !== me.id) return NextResponse.json({ error: "본인에게 위임된 결재가 아닙니다." }, { status: 403 });

  if (action === "reject") {
    await prisma.leaveApproval.update({
      where: { id: current.id },
      data: { status: "rejected", comment, decidedAt: new Date() },
    });
    await prisma.leaveRequest.update({
      where: { id: params.id },
      data: { status: "rejected", finalApprovedAt: new Date(), approverId: me.id, approvedDate: new Date() },
    });
    revalidatePath("/leaves");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    await prisma.leaveApproval.update({
      where: { id: current.id },
      data: { status: "approved", comment, decidedAt: new Date() },
    });

    // 다음 pending 단계로
    const next = lr.approvals.find((a) => a.level > lr.currentLevel && a.status === "pending");
    // auto_passed 단계는 건너뛰며 진행 — 사실상 모두 미리 만들어졌으니 status="pending"인 것만 찾음
    if (next) {
      await prisma.leaveRequest.update({
        where: { id: params.id },
        data: { currentLevel: next.level },
      });
    } else {
      // 마지막 단계 → 최종 승인
      // 단, 더 높은 level이 auto_passed면 그것도 건너뛰고 종료
      await prisma.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: "approved",
          finalApprovedAt: new Date(),
          approverId: me.id,
          approvedDate: new Date(),
          currentLevel: lr.approvals.length + 1,
        },
      });
    }
    revalidatePath("/leaves");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lr = await prisma.leaveRequest.findUnique({ where: { id: params.id } });
  if (!lr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lr.userId !== me.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.leaveRequest.delete({ where: { id: params.id } });
  revalidatePath("/leaves");
  return NextResponse.json({ ok: true });
}
