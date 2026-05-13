import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

// 거래처의 세금계산서 이력 — 사업자번호 + 회사명 양쪽 매칭
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bizNo = (company.bizNo ?? "").replace(/[^\d]/g, "");
  const validBiz = bizNo.length === 10 && !company.bizNo?.startsWith("temp-");
  const name = company.name;

  const orConds: any[] = [];
  if (validBiz) {
    orConds.push({ supplierBizNo: bizNo });
    orConds.push({ buyerBizNo: bizNo });
  }
  // 이름 매칭 (보조) — 거래처 한쪽이 우리이고 다른 쪽이 이 회사명인 경우
  orConds.push({ supplierName: { contains: name } });
  orConds.push({ buyerName: { contains: name } });

  const items = await prisma.electronicTaxInvoice.findMany({
    where: { OR: orConds },
    orderBy: { writeDate: "desc" },
    take: 500,
  });

  // 정확한 매칭만 남기기: 사업자번호 일치 OR 이름 정확히 일치하는 쪽이 우리(대동)가 아닌 경우
  const OUR = "8298801029";
  const filtered = items.filter((it) => {
    if (validBiz) {
      if (it.supplierBizNo === bizNo || it.buyerBizNo === bizNo) return true;
    }
    // 이름 매칭: 우리 회사가 아닌 쪽의 이름이 회사명 포함
    if (it.supplierBizNo !== OUR && it.supplierName?.includes(name)) return true;
    if (it.buyerBizNo !== OUR && it.buyerName?.includes(name)) return true;
    return false;
  });

  const salesAgg = {
    count: filtered.filter((i) => i.type === "sales").length,
    total: filtered
      .filter((i) => i.type === "sales")
      .reduce((s, i) => s + Number(i.totalAmount), 0),
    supply: filtered
      .filter((i) => i.type === "sales")
      .reduce((s, i) => s + Number(i.supplyAmount), 0),
  };
  const purchaseAgg = {
    count: filtered.filter((i) => i.type === "purchase").length,
    total: filtered
      .filter((i) => i.type === "purchase")
      .reduce((s, i) => s + Number(i.totalAmount), 0),
    supply: filtered
      .filter((i) => i.type === "purchase")
      .reduce((s, i) => s + Number(i.supplyAmount), 0),
  };

  return NextResponse.json({
    company: { id: company.id, name: company.name, bizNo: company.bizNo },
    items: filtered.map(serializeProject),
    summary: { sales: salesAgg, purchase: purchaseAgg },
  });
}
