/**
 * 프로젝트 엑셀 백업 다운로드
 * GET /api/projects/export?year=2026&source=nurture&manager=ID
 * - 노션 export 와 유사한 컬럼 구조로 xlsx 생성
 * - 발굴/육성 시트를 별도 시트로 분리 (source 미지정 시)
 */
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BIZ_LABEL: Record<string, string> = {
  innovation: "혁신바우처",
  export: "수출바우처",
  contract: "용역",
  certification: "인증",
  rental: "임대",
};
const STATUS_LABEL: Record<string, string> = {
  request_received: "서비스요청수신",
  contract_pending: "수행계약대기",
  cost_audit: "원가감리",
  in_progress: "서비스진행중",
  review_pending: "성과물검토중",
  settlement_request: "정산승인요청",
  settlement_done: "정산완료",
  payment_done: "입금완료",
};
const SERVICE_LABEL: Record<string, string> = {
  consulting: "혁신컨설팅",
  marketing: "혁신마케팅",
  tech_support: "혁신기술지원",
  export_consulting: "수출컨설팅",
  translation: "통번역",
  exhibition: "전시회행사",
  contract_work: "용역컨설팅",
  certification: "인증",
  rental: "임대",
  cost_settlement: "비용정산",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function mapNurture(p: any): Record<string, any> {
  const deli = p.deliverables ?? [];
  const inv = p.taxInvoices?.[0];
  const contact = p.company?.contacts?.[0];
  return {
    연도: p.year,
    구분: p.displayCode ?? "",
    "업체.기관명": p.title,
    사업영역: BIZ_LABEL[p.bizCategory] ?? p.bizCategory,
    운영기관: p.agency?.name ?? "",
    서비스: SERVICE_LABEL[p.serviceType ?? ""] ?? p.serviceType ?? "",
    진행현황: STATUS_LABEL[p.status] ?? p.status,
    상세서비스: p.serviceDetail ?? "",
    지역: p.region ?? "",
    PM: p.pmCode ?? "",
    담당자: p.manager?.name ?? "",
    확정매출: Number(p.confirmedRevenue ?? 0),
    신규육성: p.nurtureType === "new" ? "신규" : p.nurtureType === "nurture" ? "육성" : "",
    요청수신:
      p.requestStatus === "received"
        ? "작성완료"
        : p.requestStatus === "submitted"
          ? "접수"
          : p.requestStatus === "na"
            ? "해당없음"
            : "",
    협약: p.agreementYn ? "Yes" : "No",
    선금: p.advancePaidYn ? "Yes" : "No",
    수행일자:
      p.startDate && p.endDate ? `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}` : "",
    중간보고일자: fmtDate(p.midReportDate),
    중간보고: p.midReportYn ? "Yes" : "No",
    완료보고일자: fmtDate(p.finalReportDate),
    완료보고: p.finalReportYn ? "Yes" : "No",
    보완: p.revisionYn ? "Yes" : "No",
    품목: inv?.description ?? "",
    계산서발행: inv?.issuedYn ? "Yes" : "No",
    발행일자: fmtDate(inv?.issueDate),
    부가세입금: inv?.vatReceivedYn ? "Yes" : "No",
    정산완료: inv?.settlementDoneYn ? "Yes" : "No",
    입금완료: inv?.paymentDoneYn ? "Yes" : "No",
    입금일자: fmtDate(inv?.paymentDate),
    계산서발행금액: Number(inv?.amount ?? 0),
    업체담당자: contact?.name ?? "",
    전화번호: contact?.phone ?? "",
    이메일: contact?.email ?? "",
    키워드: p.keyword ?? "",
    비고: p.notes ?? "",
    산출물1: deli.find((d: any) => d.seq === 1)?.title ?? "",
    산출물2: deli.find((d: any) => d.seq === 2)?.title ?? "",
    산출물3: deli.find((d: any) => d.seq === 3)?.title ?? "",
    특이사항: p.remarks ?? "",
  };
}

function mapDiscovery(p: any): Record<string, any> {
  return {
    연도: p.year,
    "업체.기관명": p.title,
    사업영역: BIZ_LABEL[p.bizCategory] ?? p.bizCategory,
    서비스: SERVICE_LABEL[p.serviceType ?? ""] ?? p.serviceType ?? "",
    진행현황: STATUS_LABEL[p.status] ?? p.status,
    상세서비스: p.serviceDetail ?? "",
    내용: p.content ?? "",
    지역: p.region ?? "",
    PM: p.pmCode ?? "",
    담당자: p.manager?.name ?? "",
    자부담: p.selfFunding ?? "",
    예상매출: Number(p.expectedRevenue ?? 0),
    확정: p.confirmedYn ? "Yes" : "No",
    확정매출: Number(p.confirmedRevenue ?? 0),
    신규육성: p.nurtureType === "new" ? "신규" : p.nurtureType === "nurture" ? "육성" : "",
    비고: p.notes ?? "",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const source = searchParams.get("source");
  const manager = searchParams.get("manager");

  const where: any = {};
  if (yearParam) where.year = Number(yearParam);
  if (source) where.source = source;
  if (manager) where.managerId = manager;

  const projects = await prisma.project.findMany({
    where,
    include: {
      company: { include: { contacts: { take: 1, orderBy: { isPrimary: "desc" } } } },
      agency: true,
      manager: true,
      taxInvoices: { orderBy: { createdAt: "asc" } },
      deliverables: { orderBy: { seq: "asc" } },
    },
    orderBy: [{ year: "desc" }, { source: "asc" }, { sortOrder: "asc" }],
  });

  const wb = XLSX.utils.book_new();

  // 발굴/육성 분리 시트
  const nur = projects.filter((p) => p.source === "nurture");
  const disc = projects.filter((p) => p.source === "discovery");

  if (nur.length > 0) {
    const ws = XLSX.utils.json_to_sheet(nur.map(mapNurture));
    XLSX.utils.book_append_sheet(wb, ws, "육성");
  }
  if (disc.length > 0) {
    const ws = XLSX.utils.json_to_sheet(disc.map(mapDiscovery));
    XLSX.utils.book_append_sheet(wb, ws, "발굴");
  }
  if (nur.length === 0 && disc.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ 비어있음: "조건에 맞는 프로젝트가 없습니다" }]);
    XLSX.utils.book_append_sheet(wb, ws, "결과");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const yearLabel = yearParam || "전체연도";
  const sourceLabel = source ? `_${source === "nurture" ? "육성" : "발굴"}` : "";
  const managerLabel = manager ? "_담당자별" : "";
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `대동CMC_프로젝트_${yearLabel}${sourceLabel}${managerLabel}_${dateStr}.xlsx`;

  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
