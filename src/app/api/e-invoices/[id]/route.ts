import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.electronicTaxInvoice.delete({ where: { id: params.id } });
  revalidatePath("/invoices");
  return NextResponse.json({ ok: true });
}
