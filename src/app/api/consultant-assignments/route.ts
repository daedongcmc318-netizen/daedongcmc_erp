import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * POST { planId, consultantId, date }
 *   배정 생성. unique 제약 위배 시 명확한 오류 메시지 반환.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const planId = String(body.planId ?? "").trim();
  const consultantId = String(body.consultantId ?? "").trim();
  const dateStr = String(body.date ?? "").trim();
  if (!planId || !consultantId || !dateStr) {
    return NextResponse.json({ error: "planId, consultantId, date 필수" }, { status: 400 });
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return NextResponse.json({ error: "유효하지 않은 날짜" }, { status: 400 });

  // 평일만 허용 (주말 차단)
  if (isWeekend(date)) {
    return NextResponse.json({ error: "주말은 배정할 수 없습니다." }, { status: 400 });
  }

  // 중복 체크 (DB unique constraint에 의해서도 보호되지만 명확한 메시지 위해 사전 체크)
  const existing = await prisma.consultantAssignment.findUnique({
    where: { consultantId_date: { consultantId, date } },
    include: {
      plan: { select: { title: true } },
      consultant: { select: { name: true } },
    },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `이미 ${existing.consultant.name}님이 ${dateStr.slice(0, 10)}에 '${existing.plan.title}' 사업에 배정되어 있습니다.`,
        conflict: { planTitle: existing.plan.title, consultantName: existing.consultant.name },
      },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.consultantAssignment.create({
      data: { planId, consultantId, date, notes: body.notes ?? null },
      include: {
        plan: { select: { id: true, title: true } },
        consultant: { select: { id: true, name: true } },
      },
    });
    revalidatePath("/consultant-md");
    return NextResponse.json(serializeProject(created));
  } catch (e: any) {
    // unique 위배 race condition
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "이미 배정된 날짜입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message ?? "생성 실패" }, { status: 500 });
  }
}
