import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const BIGINT_FIELDS = ["amount"];
const DATE_FIELDS = ["issueDate", "paymentDate"];
const ALLOWED = new Set([
  "companyId",
  "invoiceNo",
  "amount",
  "issueDate",
  "issuedYn",
  "vatReceivedYn",
  "settlementDoneYn",
  "paymentDoneYn",
  "paymentDate",
  "description",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (BIGINT_FIELDS.includes(k)) {
      data[k] = v == null ? null : BigInt(v as any);
    } else if (DATE_FIELDS.includes(k)) {
      data[k] = v ? new Date(v as string) : null;
    } else {
      data[k] = v;
    }
  }

  const updated = await prisma.taxInvoice.update({ where: { id: params.id }, data });
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.taxInvoice.delete({ where: { id: params.id } });
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json({ ok: true });
}
