import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

// 결재 액션 — action: 'approve' | 'reject'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action, reason } = await req.json();

  const data: any = {
    approverId: me.id,
    approvedDate: new Date(),
  };
  if (action === "approve") data.status = "approved";
  else if (action === "reject") {
    data.status = "rejected";
    data.rejectReason = reason ?? null;
  } else {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const updated = await prisma.expenseRequest.update({
    where: { id: params.id },
    data,
    include: {
      requester: { select: { id: true, name: true, pmCode: true } },
      approver: { select: { id: true, name: true, pmCode: true } },
      project: { select: { id: true, title: true, displayCode: true, year: true } },
    },
  });
  revalidatePath("/expenses");
  revalidatePath("/");
  return NextResponse.json(serializeProject(updated));
}
