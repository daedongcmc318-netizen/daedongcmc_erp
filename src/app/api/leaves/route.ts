import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createApprovalChain, getLeaveTypeMeta } from "@/lib/leaves";

export const dynamic = "force-dynamic";

/**
 * POST { type, startDate, endDate, reason } — 휴가 신청
 *   - 내부직원만 가능
 *   - 반차(half_am/half_pm): startDate == endDate, days=0.5
 *   - 연차/월차: 평일 일수 계산 (간단히 endDate-startDate+1)
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { isInternal: true } });
  if (!u?.isInternal && me.role !== "admin") {
    return NextResponse.json({ error: "내부직원만 휴가 신청이 가능합니다." }, { status: 403 });
  }

  const body = await req.json();
  const { type, startDate, endDate, reason } = body;
  const approvalRoute: "internal" | "external" =
    body.approvalRoute === "external" ? "external" : "internal";
  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "필수값 누락" }, { status: 400 });
  }
  const meta = getLeaveTypeMeta(type);
  if (!meta) return NextResponse.json({ error: "유효하지 않은 휴가 종류" }, { status: 400 });

  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return NextResponse.json({ error: "날짜 형식 오류" }, { status: 400 });
  }
  if (e < s) return NextResponse.json({ error: "종료일이 시작일보다 빠릅니다." }, { status: 400 });

  // days 계산: 반차면 0.5, 일반은 (endDate-startDate+1)
  let days: number;
  if (meta.halfDay) {
    if (s.toDateString() !== e.toDateString()) {
      return NextResponse.json({ error: "반차는 같은 날짜로 신청해야 합니다." }, { status: 400 });
    }
    days = 0.5;
  } else {
    const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
    days = diff;
  }

  const created = await prisma.leaveRequest.create({
    data: {
      userId: me.id,
      type,
      approvalRoute,
      startDate: s,
      endDate: e,
      days,
      reason: reason ?? null,
      status: "pending",
      currentLevel: 1,
    },
  });

  await createApprovalChain(created.id, me.id, approvalRoute);

  // 최종 상태 + approvals 포함하여 반환
  const full = await prisma.leaveRequest.findUnique({
    where: { id: created.id },
    include: {
      user: { select: { id: true, name: true, dept: true, position: true } },
      approvals: {
        include: { approver: { select: { id: true, name: true, position: true } } },
        orderBy: { level: "asc" },
      },
    },
  });

  revalidatePath("/leaves");
  revalidatePath("/");
  return NextResponse.json(full);
}

/**
 * GET ?scope=mine|approve|all - 휴가 목록
 *   mine: 본인 신청건
 *   approve: 내가 결재해야 할 것들 (currentLevel의 approver가 me, status=pending)
 *   all: 전체 (admin 전용)
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";

  let where: any = {};
  if (scope === "mine") where = { userId: me.id };
  else if (scope === "approve") {
    where = {
      status: "pending",
      approvals: {
        some: {
          approverId: me.id,
          status: "pending",
        },
      },
    };
  } else if (scope === "all") {
    if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, dept: true, position: true } },
      approvals: {
        include: { approver: { select: { id: true, name: true, position: true } } },
        orderBy: { level: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}
