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

  // 자동화 로직: 보고서 체크 → 상태 자동 변경
  //   - midReportYn = true  → status = "mid_completed" (중간완료)  (사용자가 status를 직접 지정하지 않은 경우에만)
  //   - finalReportYn = true → status = "review_pending" (수행확인요청)
  //   - 체크 해제 시 자동 다운그레이드는 하지 않음 (실수 방지). 상태를 직접 수정해야 함.
  if (data.midReportYn === true && !("status" in data)) {
    data.status = "mid_completed";
  }
  if (data.finalReportYn === true && !("status" in data)) {
    data.status = "review_pending";
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
    include: {
      company: { include: { contacts: { take: 1, orderBy: { isPrimary: "desc" } } } },
      agency: true,
      manager: true,
      taxInvoices: { orderBy: { createdAt: "asc" } },
      deliverables: { orderBy: { seq: "asc" } },
    },
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
