import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

function calcRequiredMD(consultingBudget: bigint, dailyRate: bigint): number {
  if (dailyRate <= BigInt(0)) return 0;
  // 천 단위로 잘리지 않도록 BigInt 나눗셈
  return Number(consultingBudget / dailyRate);
}

/**
 * POST { title, projectId?, managerId?, consultingBudget, dailyRate?, year? }
 *   신규 사업(Plan) 생성. requiredMD는 자동 계산.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title 필수" }, { status: 400 });

  const year = body.year ?? 2026;
  const dailyRate = BigInt(body.dailyRate ?? 1000000);
  const consultingBudget = BigInt(body.consultingBudget ?? 0);
  const requiredMD =
    body.requiredMD != null ? Number(body.requiredMD) : calcRequiredMD(consultingBudget, dailyRate);

  // 마지막 sortOrder
  const last = await prisma.consultantPlan.findFirst({
    where: { year },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.consultantPlan.create({
    data: {
      year,
      title,
      projectId: body.projectId ?? null,
      managerId: body.managerId ?? null,
      consultingBudget,
      dailyRate,
      requiredMD,
      notes: body.notes ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    include: {
      manager: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, displayCode: true } },
      assignments: { select: { id: true, date: true, consultantId: true } },
    },
  });
  revalidatePath("/consultant-md");
  return NextResponse.json(serializeProject(created));
}

/** GET ?year=2026 — Plan 목록 + 진행 현황 (assignments 포함) */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? 2026);

  const items = await prisma.consultantPlan.findMany({
    where: { year },
    include: {
      manager: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, displayCode: true } },
      assignments: { select: { id: true, date: true, consultantId: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items.map(serializeProject));
}
