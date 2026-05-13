import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const c = await prisma.companyContact.create({
    data: {
      companyId: body.companyId,
      name: body.name || "(이름 없음)",
      position: body.position ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      isPrimary: body.isPrimary ?? true,
    },
  });
  revalidatePath("/companies");
  return NextResponse.json(c);
}
