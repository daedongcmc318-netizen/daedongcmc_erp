import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const BIGINT_FIELDS = ["consultingBudget", "dailyRate"];
const INT_FIELDS = ["year", "requiredMD", "sortOrder"];
const ALLOWED = new Set([
  "year",
  "title",
  "projectId",
  "managerId",
  "consultingBudget",
  "dailyRate",
  "requiredMD",
  "notes",
  "sortOrder",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (BIGINT_FIELDS.includes(k)) data[k] = v == null ? BigInt(0) : BigInt(v as any);
    else if (INT_FIELDS.includes(k)) data[k] = v == null ? null : Number(v);
    else data[k] = v;
  }

  // consultingBudget / dailyRate 가 바뀌면 requiredMD 자동 재계산 (수동지정 안한 경우)
  if (body.recalcMD && data.consultingBudget != null && data.dailyRate != null) {
    if (data.dailyRate > BigInt(0)) {
      data.requiredMD = Number(data.consultingBudget / data.dailyRate);
    }
  }

  const updated = await prisma.consultantPlan.update({
    where: { id: params.id },
    data,
    include: {
      manager: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, displayCode: true } },
      assignments: { select: { id: true, date: true, consultantId: true } },
    },
  });
  revalidatePath("/consultant-md");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.consultantPlan.delete({ where: { id: params.id } });
  revalidatePath("/consultant-md");
  return NextResponse.json({ ok: true });
}
