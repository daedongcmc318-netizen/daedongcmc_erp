import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  client: "수혜기업",
  agency: "운영기관",
  partner: "협력사",
  etc: "기타",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const where: any = {};
  if (type) where.type = type;

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      _count: { select: { clientProjects: true, agencyProjects: true } },
    },
  });

  const wb = XLSX.utils.book_new();

  // 시트 1: 거래처 기본 정보 (한 행 = 한 거래처, 대표 키맨만)
  const rows = companies.map((c) => {
    const primary = c.contacts[0];
    return {
      거래처명: c.name,
      유형: TYPE_LABEL[c.type] ?? c.type,
      등급: c.rating ?? "",
      사업자번호: c.bizNo && !c.bizNo.startsWith("temp-") ? c.bizNo : "",
      대표자: c.repName ?? "",
      업종: c.industry ?? "",
      법인구분: c.corpType ?? "",
      설립일자: fmtDate(c.foundedAt as any),
      지역: c.region ?? "",
      주소: c.address ?? "",
      홈페이지: c.website ?? "",
      "키맨(대표담당자)": primary?.name ?? "",
      "키맨 직위/전문분야": primary?.position ?? "",
      "키맨 연락처": primary?.phone ?? "",
      "키맨 이메일": primary?.email ?? "",
      담당PM: c.internalPmCode ?? "",
      아이템: c.items ?? "",
      프로젝트수: c._count.clientProjects + c._count.agencyProjects,
      비고: c.notes ?? "",
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws1, "거래처");

  // 시트 2: 키맨/담당자 전체 (한 거래처에 여러 키맨이 있을 수 있음)
  const contactRows: any[] = [];
  for (const c of companies) {
    for (const ct of c.contacts) {
      contactRows.push({
        거래처명: c.name,
        사업자번호: c.bizNo && !c.bizNo.startsWith("temp-") ? c.bizNo : "",
        담당자명: ct.name,
        "직위/전문분야": ct.position ?? "",
        연락처: ct.phone ?? "",
        이메일: ct.email ?? "",
        주담당자여부: ct.isPrimary ? "Yes" : "No",
      });
    }
  }
  if (contactRows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(contactRows);
    XLSX.utils.book_append_sheet(wb, ws2, "키맨");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `대동CMC_거래처${type ? `_${TYPE_LABEL[type] ?? type}` : ""}_${dateStr}.xlsx`;

  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
