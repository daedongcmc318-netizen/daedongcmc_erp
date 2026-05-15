import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const BIGINT_FIELDS = ["serviceFee", "processedAmount"];
const DATE_FIELDS = ["startDate", "endDate", "processedDate", "bizPeriodStart", "bizPeriodEnd"];
const INT_FIELDS = ["seqNo", "year", "round"];
const BOOL_FIELDS = ["bizNoChanged"];
const ALLOWED = new Set([
  "type",
  "category",
  "seqNo",
  "serviceName",
  "serviceFee",
  "processedAmount",
  "feeType",
  "startDate",
  "endDate",
  "clientCompanyId",
  "clientName",
  "processedDate",
  "status",
  "supportProgram",
  "year",
  "round",
  "bizPeriodStart",
  "bizPeriodEnd",
  "bizNoChanged",
  "country",
  "region",
  "notes",
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
    if (BIGINT_FIELDS.includes(k)) data[k] = v == null ? null : BigInt(v as any);
    else if (DATE_FIELDS.includes(k)) data[k] = v ? new Date(v as string) : null;
    else if (INT_FIELDS.includes(k)) data[k] = v == null ? null : Number(v);
    else if (BOOL_FIELDS.includes(k)) data[k] = !!v;
    else data[k] = v;
  }

  const updated = await prisma.trackRecord.update({
    where: { id: params.id },
    data,
    include: { clientCompany: { select: { id: true, name: true } } },
  });
  revalidatePath("/track-records");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.trackRecord.delete({ where: { id: params.id } });
  revalidatePath("/track-records");
  return NextResponse.json({ ok: true });
}
