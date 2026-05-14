import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

// POST { budgetId, vendorName, vendorCompanyId?, amount, ... } — 지출 신규
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const budgetId = String(body.budgetId ?? "").trim();
  if (!budgetId) return NextResponse.json({ error: "budgetId 필수" }, { status: 400 });

  // budget 내 다음 seq
  const last = await prisma.mgmtFeeExpense.findFirst({
    where: { budgetId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const seq = (last?.seq ?? 0) + 1;

  const created = await prisma.mgmtFeeExpense.create({
    data: {
      budgetId,
      seq,
      vendorCompanyId: body.vendorCompanyId ?? null,
      vendorName: String(body.vendorName ?? "").trim(),
      taxInvoiceDate: body.taxInvoiceDate ? new Date(body.taxInvoiceDate) : null,
      amount: BigInt(body.amount ?? 0),
      runningBalance: body.runningBalance == null ? null : BigInt(body.runningBalance),
      contractDone: !!body.contractDone,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
      settlementDone: !!body.settlementDone,
      filed: !!body.filed,
      notes: body.notes ?? null,
    },
    include: { vendorCompany: true },
  });
  revalidatePath("/mgmt-fees");
  return NextResponse.json(serializeProject(created));
}
