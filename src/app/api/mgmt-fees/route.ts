import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), me: null };
  if (me.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), me: null };
  return { error: null, me };
}

// POST  { year, clientName, clientCompanyId?, projectId?, ...budget fields } — 신규 사업
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const year = Number(body.year ?? new Date().getFullYear());
  const clientName = String(body.clientName ?? "").trim();
  if (!clientName) return NextResponse.json({ error: "clientName 필수" }, { status: 400 });

  // 연도별 다음 seq 계산
  const last = await prisma.mgmtFeeBudget.findFirst({
    where: { year },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const seq = (last?.seq ?? 0) + 1;

  const created = await prisma.mgmtFeeBudget.create({
    data: {
      year,
      seq,
      bizCategory: body.bizCategory ?? null,
      clientName,
      clientCompanyId: body.clientCompanyId ?? null,
      projectId: body.projectId ?? null,
      subsidy: BigInt(body.subsidy ?? 0),
      companyShare: BigInt(body.companyShare ?? 0),
      totalAmount: BigInt(body.totalAmount ?? 0),
      mgmtFeeAmount: BigInt(body.mgmtFeeAmount ?? 0),
      mgmtFeeRate: body.mgmtFeeRate == null ? null : Number(body.mgmtFeeRate),
      payableTotal: BigInt(body.payableTotal ?? 0),
      overBudget: BigInt(body.overBudget ?? 0),
      notes: body.notes ?? null,
    },
    include: {
      clientCompany: true,
      project: { select: { id: true, title: true, displayCode: true, year: true } },
      expenses: { include: { vendorCompany: true }, orderBy: { seq: "asc" } },
    },
  });
  revalidatePath("/mgmt-fees");
  return NextResponse.json(serializeProject(created));
}

// GET ?year=2026  목록
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : null;

  const where = year ? { year } : {};
  const items = await prisma.mgmtFeeBudget.findMany({
    where,
    include: {
      clientCompany: true,
      project: { select: { id: true, title: true, displayCode: true, year: true } },
      expenses: { include: { vendorCompany: true }, orderBy: { seq: "asc" } },
    },
    orderBy: [{ year: "desc" }, { seq: "asc" }],
  });

  // 연도 목록
  const years = await prisma.mgmtFeeBudget.groupBy({ by: ["year"], _count: true });

  return NextResponse.json({
    items: items.map(serializeProject),
    years: years.map((y) => y.year).sort((a, b) => b - a),
  });
}
