import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COLOR_POOL = [
  "bg-blue-50 text-blue-700 ring-blue-200",
  "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "bg-amber-50 text-amber-700 ring-amber-200",
  "bg-rose-50 text-rose-700 ring-rose-200",
  "bg-violet-50 text-violet-700 ring-violet-200",
  "bg-pink-50 text-pink-700 ring-pink-200",
  "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "bg-teal-50 text-teal-700 ring-teal-200",
];

function slugify(s: string): string {
  // 영문/숫자/언더스코어만 남기고, 한글 등은 base36 hash로 대체
  const clean = s
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  // 한글이 들어있으면 hash 추가 (uniqueness)
  if (/[가-힣]/.test(clean)) {
    const hash = Array.from(clean)
      .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
      .toString(36)
      .replace(/-/g, "n");
    return `custom_${hash}`;
  }
  return clean || `custom_${Date.now().toString(36)}`;
}

/** GET ?category=...  특정 카테고리의 사용자정의 옵션 목록 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const where = category ? { category } : {};
  const items = await prisma.dropdownOption.findMany({
    where,
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(items);
}

/** POST { category, label, color? } — 신규 옵션 추가 (value는 자동 생성) */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const category = String(body.category ?? "").trim();
  const label = String(body.label ?? "").trim();
  if (!category || !label) {
    return NextResponse.json({ error: "category, label 필수" }, { status: 400 });
  }

  // 자동 value 생성 + 중복 회피
  let value = slugify(label);
  // 같은 category에 같은 value가 있으면 suffix
  const existing = await prisma.dropdownOption.findUnique({
    where: { category_value: { category, value } },
  });
  if (existing) value = `${value}_${Date.now().toString(36)}`;

  // 같은 category의 마지막 옵션 인덱스로 컬러 결정
  const count = await prisma.dropdownOption.count({ where: { category } });
  const color: string =
    typeof body.color === "string" && body.color.trim()
      ? body.color
      : COLOR_POOL[count % COLOR_POOL.length];

  const last = await prisma.dropdownOption.findFirst({
    where: { category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.dropdownOption.create({
    data: {
      category,
      value,
      label,
      color,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/projects");
  return NextResponse.json(created);
}
