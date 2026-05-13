import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.laborContract.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items.map(serializeProject));
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const c = await prisma.laborContract.create({
    data: {
      title: body.title,
      category: body.category ?? null,
      dept: body.dept ?? null,
      projectId: body.projectId ?? null,
      fileUrl: body.fileUrl ?? null,
      fileName: body.fileName ?? null,
      message: body.message ?? null,
      use2FA: !!body.use2FA,
      stage: "draft",
      createdById: me?.id ?? null,
    },
  });
  revalidatePath("/contracts");
  return NextResponse.json(serializeProject(c));
}
