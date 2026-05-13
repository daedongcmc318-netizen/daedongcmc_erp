import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const proj = await prisma.project.findUnique({ where: { id: body.projectId } });
  if (!proj) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const data: any = {
    projectId: body.projectId,
    companyId: body.companyId ?? proj.companyId ?? null,
    amount: BigInt(body.amount ?? 0),
    issuedYn: !!body.issuedYn,
    vatReceivedYn: !!body.vatReceivedYn,
    settlementDoneYn: !!body.settlementDoneYn,
    paymentDoneYn: !!body.paymentDoneYn,
    description: body.description ?? null,
    invoiceNo: body.invoiceNo ?? null,
  };
  if (body.issueDate) data.issueDate = new Date(body.issueDate);
  if (body.paymentDate) data.paymentDate = new Date(body.paymentDate);

  const inv = await prisma.taxInvoice.create({ data });
  revalidatePath("/");
  revalidatePath("/projects");
  return NextResponse.json(serializeProject(inv));
}
