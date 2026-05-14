import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.expenseRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true, pmCode: true } },
      approver: { select: { id: true, name: true, pmCode: true } },
      project: { select: { id: true, title: true, displayCode: true, year: true } },
    },
  });
  return NextResponse.json(items.map(serializeProject));
}

async function nextExpenseNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;
  const last = await prisma.expenseRequest.findFirst({
    where: { expenseNo: { startsWith: prefix } },
    orderBy: { expenseNo: "desc" },
    select: { expenseNo: true },
  });
  let n = 1;
  if (last) {
    const m = last.expenseNo.match(/(\d+)$/);
    if (m) n = Number(m[1]) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const expenseNo = body.expenseNo || (await nextExpenseNo());
  const e = await prisma.expenseRequest.create({
    data: {
      expenseNo,
      title: body.title,
      projectId: body.projectId ?? null,
      companyId: body.companyId ?? null,
      taxInvoiceId: body.taxInvoiceId ?? null,
      category: body.category ?? "기타",
      amount: BigInt(body.amount ?? 0),
      description: body.description ?? null,
      requesterId: me.id,
      requestDate: body.requestDate ? new Date(body.requestDate) : new Date(),
      status: "pending",
      approverId: body.approverId ?? null,
      paymentMethod: body.paymentMethod ?? null,
      attachmentNote: body.attachmentNote ?? null,
      receiptUrl: body.receiptUrl ?? null,
      taxInvoiceImageUrl: body.taxInvoiceImageUrl ?? null,
      businessRegUrl: body.businessRegUrl ?? null,
      bankAccountUrl: body.bankAccountUrl ?? null,
      quotationUrl: body.quotationUrl ?? null,
      approvalRoute: body.approvalRoute === "external" ? "external" : "internal",
    },
    include: {
      requester: { select: { id: true, name: true, pmCode: true } },
      approver: { select: { id: true, name: true, pmCode: true } },
      project: { select: { id: true, title: true, displayCode: true, year: true } },
    },
  });
  revalidatePath("/expenses");
  return NextResponse.json(serializeProject(e));
}
