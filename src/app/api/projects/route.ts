import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const status = searchParams.get("status");
  const bizCategory = searchParams.get("bizCategory");
  const pmCode = searchParams.get("pmCode");
  const q = searchParams.get("q");

  const where: any = {};
  if (year) where.year = Number(year);
  if (status) where.status = status;
  if (bizCategory) where.bizCategory = bizCategory;
  if (pmCode) where.pmCode = pmCode;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { projectCode: { contains: q } },
      { serviceDetail: { contains: q } },
      { keyword: { contains: q } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      company: true,
      agency: true,
      manager: true,
      taxInvoices: true,
    },
    orderBy: [{ year: "desc" }, { projectCode: "asc" }],
  });

  return NextResponse.json(projects.map(serializeProject));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const source: string = body.source === "discovery" ? "discovery" : "nurture";

  // sortOrder 처리: insertAfterId가 오면 그 다음에 끼워 넣고, insertBeforeId면 그 앞에
  let sortOrder: number;
  if (body.insertAfterId || body.insertBeforeId) {
    const refId = body.insertAfterId ?? body.insertBeforeId;
    const ref = await prisma.project.findUnique({ where: { id: refId } });
    if (ref) {
      const op = body.insertAfterId ? "gt" : "gte";
      const after = await prisma.project.findFirst({
        where: { source, sortOrder: { [op]: ref.sortOrder } as any },
        orderBy: { sortOrder: "asc" },
        skip: body.insertAfterId ? 1 : 1,
      });
      sortOrder = after ? (ref.sortOrder + after.sortOrder) / 2 : ref.sortOrder + 1;
      // 정수 충돌 회피: float-like spacing
    } else {
      sortOrder = 0;
    }
  } else if (body.sortOrder != null) {
    sortOrder = Number(body.sortOrder);
  } else {
    const last = await prisma.project.findFirst({
      where: { source },
      orderBy: { sortOrder: "desc" },
    });
    sortOrder = (last?.sortOrder ?? 0) + 1;
  }

  const data: any = {
    projectCode: body.projectCode || `NEW-${Date.now()}`,
    displayCode: body.displayCode ?? null,
    year: Number(body.year ?? new Date().getFullYear()),
    title: body.title || "(제목 없음)",
    bizCategory: body.bizCategory || "innovation",
    status: body.status || "request_received",
    source,
    sortOrder: Math.round(sortOrder),
  };
  if (body.companyId) data.companyId = body.companyId;
  if (body.agencyId) data.agencyId = body.agencyId;
  if (body.serviceType) data.serviceType = body.serviceType;
  if (body.serviceDetail) data.serviceDetail = body.serviceDetail;
  if (body.pmCode) data.pmCode = body.pmCode;
  if (body.managerId) data.managerId = body.managerId;
  if (body.region) data.region = body.region;
  if (body.nurtureType) data.nurtureType = body.nurtureType;
  if (body.content) data.content = body.content;
  if (body.selfFunding != null) data.selfFunding = Number(body.selfFunding);
  if (body.confirmedRevenue != null) data.confirmedRevenue = BigInt(body.confirmedRevenue);
  if (body.expectedRevenue != null) data.expectedRevenue = BigInt(body.expectedRevenue);
  if (body.confirmedYn != null) data.confirmedYn = !!body.confirmedYn;
  if (body.startDate) data.startDate = new Date(body.startDate);
  if (body.endDate) data.endDate = new Date(body.endDate);
  if (body.keyword) data.keyword = body.keyword;
  if (body.notes) data.notes = body.notes;

  // 끼워 넣을 자리가 정수로 깨질 수 있으니, 같은 source에서 충돌하면 모두 한 칸씩 밀기
  const conflict = await prisma.project.findFirst({
    where: { source, sortOrder: data.sortOrder },
  });
  if (conflict) {
    await prisma.project.updateMany({
      where: { source, sortOrder: { gte: data.sortOrder } },
      data: { sortOrder: { increment: 1 } },
    });
  }

  const project = await prisma.project.create({
    data,
    include: { company: true, agency: true, manager: true, taxInvoices: true },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(project));
}
