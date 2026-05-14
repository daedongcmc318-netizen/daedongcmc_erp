import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// 거래처/키워드로 전체 연도에서 프로젝트 검색
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ items: [], byYear: {}, byCompany: {} });
  }

  const items = await prisma.project.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { displayCode: { contains: q, mode: "insensitive" } },
        { keyword: { contains: q, mode: "insensitive" } },
        { serviceDetail: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      company: { select: { id: true, name: true, bizNo: true } },
      manager: { select: { id: true, name: true } },
    },
    orderBy: [{ year: "desc" }, { sortOrder: "asc" }],
    take: 500,
  });

  const serialized = items.map(serializeProject) as any[];

  // 연도별 그룹
  const byYear: Record<number, any[]> = {};
  for (const it of serialized) {
    if (!byYear[it.year]) byYear[it.year] = [];
    byYear[it.year].push(it);
  }

  // 거래처별 그룹 (회사명 기준)
  const byCompany: Record<string, any[]> = {};
  for (const it of serialized) {
    const key = it.company?.name ?? it.title;
    if (!byCompany[key]) byCompany[key] = [];
    byCompany[key].push(it);
  }

  return NextResponse.json({
    items: serialized,
    byYear,
    byCompany,
  });
}
