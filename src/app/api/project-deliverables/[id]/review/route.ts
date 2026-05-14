/**
 * 산출물 검토 워크플로우
 *
 * action:
 *  - submit    : 담당자가 검토 요청 (pending/revision → in_review)
 *  - approve   : 관리자가 완료 처리 (in_review → approved)
 *  - revise    : 관리자가 보완 요청 (in_review → revision, feedback 필수)
 *  - reset     : 다시 미검토로 (관리자만, 디버그용)
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { action, feedback } = await req.json();
  if (!["submit", "approve", "revise", "reset"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const data: any = {};
  if (action === "submit") {
    data.reviewStatus = "in_review";
    data.reviewSubmittedAt = new Date();
    data.reviewedAt = null;
    data.reviewedById = null;
    data.reviewFeedback = null;
  } else if (action === "approve") {
    data.reviewStatus = "approved";
    data.reviewedAt = new Date();
    data.reviewedById = me.id;
    data.reviewFeedback = feedback ?? null;
    data.isCompleted = true;
    data.completedDate = new Date();
  } else if (action === "revise") {
    if (!feedback) return NextResponse.json({ error: "보완 사유(피드백)를 입력하세요" }, { status: 400 });
    data.reviewStatus = "revision";
    data.reviewedAt = new Date();
    data.reviewedById = me.id;
    data.reviewFeedback = feedback;
  } else if (action === "reset") {
    data.reviewStatus = "pending";
    data.reviewSubmittedAt = null;
    data.reviewedAt = null;
    data.reviewedById = null;
    data.reviewFeedback = null;
  }

  const d = await prisma.projectDeliverable.update({ where: { id: params.id }, data });
  revalidatePath("/projects");
  revalidatePath("/reviews");
  return NextResponse.json(serializeProject(d));
}
