import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * PATCH { electronicTaxInvoiceId } — 실적-세금계산서 수동 연결/해제
 *   electronicTaxInvoiceId: invoice id 또는 null (해제)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const invoiceId: string | null = body.electronicTaxInvoiceId ?? null;

  const updated = await prisma.trackRecord.update({
    where: { id: params.id },
    data: { electronicTaxInvoiceId: invoiceId },
    include: {
      clientCompany: { select: { id: true, name: true } },
      electronicTaxInvoice: {
        select: {
          id: true,
          approvalNo: true,
          writeDate: true,
          issueDate: true,
          supplierName: true,
          buyerName: true,
          totalAmount: true,
          itemName: true,
        },
      },
    },
  });
  revalidatePath("/track-records");
  return NextResponse.json(serializeProject(updated));
}
