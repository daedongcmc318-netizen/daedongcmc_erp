import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title 필수" }, { status: 400 });

  const created = await prisma.tripReport.create({
    data: {
      userId: me.id,
      title,
      destination: body.destination ?? null,
      purpose: body.purpose ?? null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      totalDays: body.totalDays != null ? Number(body.totalDays) : null,
      totalCost: BigInt(body.totalCost ?? 0),
      content: body.content ?? null,
      result: body.result ?? null,
      attachmentUrl: body.attachmentUrl ?? null,
      status: body.status ?? "draft",
      approvalRoute: body.approvalRoute === "external" ? "external" : "internal",
    },
    include: { user: { select: { id: true, name: true, position: true } } },
  });
  revalidatePath("/expense-trips");
  return NextResponse.json(serializeProject(created));
}

export async function GET(_req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.tripReport.findMany({
    where: { userId: me.id },
    include: { user: { select: { id: true, name: true, position: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items.map(serializeProject));
}
