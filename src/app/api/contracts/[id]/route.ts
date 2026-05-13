import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

const ALLOWED = new Set([
  "title",
  "category",
  "dept",
  "projectId",
  "fileUrl",
  "fileName",
  "message",
  "use2FA",
  "recipientUserId",
  "recipientName",
  "recipientEmail",
  "recipientPhone",
  "deliveryMethod",
  "stage",
  "signatureUrl",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (v === "" || v === undefined) data[k] = null;
    else data[k] = v;
  }
  // 단계 전환 시 타임스탬프 기록
  if (data.stage === "requested" && !data.requestedAt) data.requestedAt = new Date();
  if (data.stage === "signed" && !data.signedAt) data.signedAt = new Date();

  const updated = await prisma.laborContract.update({ where: { id: params.id }, data });
  revalidatePath("/contracts");
  return NextResponse.json(serializeProject(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.laborContract.delete({ where: { id: params.id } });
  revalidatePath("/contracts");
  return NextResponse.json({ ok: true });
}
