import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const BIGINT_FIELDS = ["confirmedRevenue", "expectedRevenue"];
const DATE_FIELDS = ["startDate", "endDate", "midReportDate", "finalReportDate"];
const FLOAT_FIELDS = ["selfFunding"];
const INT_FIELDS = ["year", "sortOrder"];
const ALLOWED = new Set([
  "title",
  "projectCode",
  "displayCode",
  "year",
  "companyId",
  "agencyId",
  "bizCategory",
  "serviceType",
  "serviceDetail",
  "status",
  "pmCode",
  "managerId",
  "confirmedRevenue",
  "expectedRevenue",
  "confirmedYn",
  "source",
  "selfFunding",
  "sortOrder",
  "content",
  "nurtureType",
  "region",
  "startDate",
  "endDate",
  "isAdvance",
  "isBalance",
  "parentProjectCode",
  "requestStatus",
  "agreementYn",
  "advancePaidYn",
  "midReportDate",
  "midReportYn",
  "finalReportDate",
  "finalReportYn",
  "revisionYn",
  "keyword",
  "notes",
  "remarks",
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
    } else if (FLOAT_FIELDS.includes(k)) {
      data[k] = v == null ? null : Number(v);
    } else if (INT_FIELDS.includes(k)) {
      data[k] = v == null ? null : Number(v);
    } else {
      data[k] = v;
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
    include: { company: true, agency: true, manager: true, taxInvoices: true },
  });
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.project.delete({ where: { id: params.id } });
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json({ ok: true });
}
