import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const BIGINT_FIELDS = ["subsidy", "companyShare", "totalAmount", "mgmtFeeAmount", "payableTotal", "overBudget"];
const FLOAT_FIELDS = ["mgmtFeeRate"];
const ALLOWED = new Set([
  "year",
  "bizCategory",
  "clientCompanyId",
  "clientName",
  "projectId",
  "subsidy",
  "companyShare",
  "totalAmount",
  "mgmtFeeAmount",
  "mgmtFeeRate",
  "payableTotal",
  "overBudget",
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
    if (BIGINT_FIELDS.includes(k)) data[k] = v == null ? BigInt(0) : BigInt(v as any);
    else if (FLOAT_FIELDS.includes(k)) data[k] = v == null ? null : Number(v);
    else if (k === "year") data[k] = Number(v);
    else data[k] = v;
  }

  const updated = await prisma.mgmtFeeBudget.update({
    where: { id: params.id },
    data,
    include: {
      clientCompany: true,
      project: { select: { id: true, title: true, displayCode: true, year: true } },
      expenses: { include: { vendorCompany: true }, orderBy: { seq: "asc" } },
    },
  });
  revalidatePath("/mgmt-fees");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;
  await prisma.mgmtFeeBudget.delete({ where: { id: params.id } });
  revalidatePath("/mgmt-fees");
  return NextResponse.json({ ok: true });
}
