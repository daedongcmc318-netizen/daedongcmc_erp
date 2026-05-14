import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET ?projectId=... — 특정 프로젝트의 히스토리 목록 (최신순) */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId 필수" }, { status: 400 });

  const items = await prisma.projectHistory.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

/** POST { projectId, body } — 신규 히스토리 추가 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const projectId = String(body.projectId ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!projectId || !text) return NextResponse.json({ error: "projectId, body 필수" }, { status: 400 });

  const created = await prisma.projectHistory.create({
    data: {
      projectId,
      body: text,
      createdById: me.id,
      createdByName: me.name,
    },
  });
  revalidatePath("/projects");
  return NextResponse.json(created);
}
