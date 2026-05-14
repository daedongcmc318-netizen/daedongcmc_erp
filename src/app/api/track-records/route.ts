import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * POST { type, ... } — 새 실적 추가
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const type = body.type === "innovation" ? "innovation" : body.type === "export" ? "export" : null;
  if (!type) return NextResponse.json({ error: "type 필수 (innovation|export)" }, { status: 400 });

  const created = await prisma.trackRecord.create({
    data: {
      type,
      seqNo: body.seqNo ?? null,
      serviceName: String(body.serviceName ?? "(미지정)"),
      serviceFee: BigInt(body.serviceFee ?? 0),
      processedAmount: body.processedAmount != null ? BigInt(body.processedAmount) : null,
      feeType: body.feeType ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      clientCompanyId: body.clientCompanyId ?? null,
      clientName: String(body.clientName ?? "(미지정)"),
      processedDate: body.processedDate ? new Date(body.processedDate) : null,
      status: body.status ?? null,
      supportProgram: body.supportProgram ?? null,
      year: body.year ?? null,
      round: body.round ?? null,
      bizPeriodStart: body.bizPeriodStart ? new Date(body.bizPeriodStart) : null,
      bizPeriodEnd: body.bizPeriodEnd ? new Date(body.bizPeriodEnd) : null,
      bizNoChanged: !!body.bizNoChanged,
      country: body.country ?? null,
      region: body.region ?? null,
      notes: body.notes ?? null,
    },
    include: { clientCompany: { select: { id: true, name: true } } },
  });
  revalidatePath("/track-records");
  return NextResponse.json(serializeProject(created));
}
