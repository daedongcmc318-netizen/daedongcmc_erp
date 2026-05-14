import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const BIGINT_FIELDS = ["amount", "runningBalance"];
const DATE_FIELDS = ["taxInvoiceDate", "paymentDate"];
const BOOL_FIELDS = ["contractDone", "settlementDone", "filed"];
const ALLOWED = new Set([
  "vendorCompanyId",
  "vendorName",
  "taxInvoiceDate",
  "amount",
  "runningBalance",
  "contractDone",
  "paymentDate",
  "settlementDone",
  "filed",
  "notes",
]);

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) {
      data[k] = null;
      continue;
    }
    if (BIGINT_FIELDS.includes(k)) data[k] = v == null ? null : BigInt(v as any);
    else if (DATE_FIELDS.includes(k)) data[k] = v ? new Date(v as string) : null;
    else if (BOOL_FIELDS.includes(k)) data[k] = !!v;
    else data[k] = v;
  }

  const updated = await prisma.mgmtFeeExpense.update({
    where: { id: params.id },
    data,
    include: { vendorCompany: true },
  });
  revalidatePath("/mgmt-fees");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;
  await prisma.mgmtFeeExpense.delete({ where: { id: params.id } });
  revalidatePath("/mgmt-fees");
  return NextResponse.json({ ok: true });
}
