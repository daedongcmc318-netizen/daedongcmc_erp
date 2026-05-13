import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const where: any = {};
  if (type) where.type = type;
  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      contacts: { take: 1, orderBy: { isPrimary: "desc" } },
      _count: { select: { clientProjects: true, agencyProjects: true } },
    },
  });
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const c = await prisma.company.create({
    data: {
      name: body.name,
      type: body.type || "client",
      region: body.region || null,
      bizNo: body.bizNo || null,
      repName: body.repName || null,
      industry: body.industry || null,
      website: body.website || null,
      address: body.address || null,
      internalPmCode: body.internalPmCode || null,
      rating: body.rating || null,
      notes: body.notes || null,
    },
    include: {
      contacts: { take: 1, orderBy: { isPrimary: "desc" } },
      _count: { select: { clientProjects: true, agencyProjects: true } },
    },
  });
  revalidatePath("/companies");
  revalidatePath("/");
  return NextResponse.json(c);
}
