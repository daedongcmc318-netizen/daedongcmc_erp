import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

const BIGINT_FIELDS = ["amount"];
const DATE_FIELDS = ["requestDate", "approvedDate"];
const ALLOWED = new Set([
  "title",
  "projectId",
  "companyId",
  "taxInvoiceId",
  "category",
  "amount",
  "description",
  "requestDate",
  "approverId",
  "paymentMethod",
  "attachmentNote",
  "receiptUrl",
  "taxInvoiceImageUrl",
  "businessRegUrl",
  "bankAccountUrl",
  "quotationUrl",
  "approvalRoute",
  "status",
  "approvedDate",
  "rejectReason",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (BIGINT_FIELDS.includes(k)) data[k] = BigInt(v as any);
    else if (DATE_FIELDS.includes(k)) data[k] = v ? new Date(v as string) : null;
    else data[k] = v;
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
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.expenseRequest.delete({ where: { id: params.id } });
  revalidatePath("/expenses");
  return NextResponse.json({ ok: true });
}
