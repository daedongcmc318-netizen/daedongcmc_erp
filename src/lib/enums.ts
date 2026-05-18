// 육성(nurture) 프로젝트 진행현황
export const PROJECT_STATUS = [
  { value: "request_received", label: "서비스요청수신", color: "bg-slate-100 text-slate-700" },
  { value: "contract_pending", label: "수행계약대기", color: "bg-amber-100 text-amber-800" },
  { value: "cost_audit", label: "원가감리", color: "bg-orange-100 text-orange-800" },
  { value: "in_progress", label: "서비스진행중", color: "bg-blue-100 text-blue-700" },
  { value: "mid_completed", label: "중간완료", color: "bg-sky-100 text-sky-700" },
  { value: "review_pending", label: "수행확인요청", color: "bg-indigo-100 text-indigo-700" },
  { value: "settlement_request", label: "정산승인요청", color: "bg-purple-100 text-purple-700" },
  { value: "settlement_done", label: "정산완료", color: "bg-emerald-100 text-emerald-700" },
  { value: "payment_done", label: "입금완료", color: "bg-green-100 text-green-800" },
  { value: "scheduled", label: "A예정", color: "bg-zinc-100 text-zinc-600" },
] as const;

// 발굴(discovery) 프로젝트 진행현황 — 노션 엑셀 기준
// value 는 한국어 그대로 (노션 import 시 그대로 들어오므로). 색상은 단계 의미별 매핑.
export const DISCOVERY_STATUS = [
  { value: "문의", label: "문의", color: "bg-slate-100 text-slate-600" },
  { value: "견적문의", label: "견적문의", color: "bg-slate-100 text-slate-700" },
  { value: "미팅요청", label: "미팅요청", color: "bg-cyan-100 text-cyan-700" },
  { value: "미팅진행", label: "미팅진행", color: "bg-cyan-100 text-cyan-800" },
  { value: "검토중", label: "검토중", color: "bg-amber-100 text-amber-700" },
  { value: "사업신청", label: "사업신청", color: "bg-violet-100 text-violet-700" },
  { value: "접수예정", label: "접수예정", color: "bg-blue-100 text-blue-700" },
  { value: "접수완료", label: "접수완료", color: "bg-indigo-100 text-indigo-700" },
  { value: "선정", label: "선정", color: "bg-emerald-100 text-emerald-700" },
  { value: "탈락", label: "탈락", color: "bg-rose-100 text-rose-700" },
  { value: "거절", label: "거절", color: "bg-rose-200 text-rose-800" },
  { value: "미진행", label: "미진행", color: "bg-slate-200 text-slate-500" },
] as const;

export const BIZ_CATEGORY = [
  { value: "innovation", label: "혁신바우처", color: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "export", label: "수출바우처", color: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  { value: "tp", label: "테크노파크", color: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "contract", label: "용역", color: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "certification", label: "인증", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "rental", label: "임대", color: "bg-amber-50 text-amber-800 ring-amber-200" },
] as const;

export const SERVICE_TYPE = [
  { value: "consulting", label: "혁신컨설팅" },
  { value: "marketing", label: "혁신마케팅" },
  { value: "tech_support", label: "혁신기술지원" },
  { value: "export_consulting", label: "수출컨설팅" },
  { value: "translation", label: "통번역" },
  { value: "exhibition", label: "전시회행사" },
  { value: "contract_work", label: "용역컨설팅" },
  { value: "certification", label: "인증" },
  { value: "rental", label: "임대" },
  { value: "cost_settlement", label: "비용정산" },
] as const;

export const NURTURE_TYPE = [
  { value: "new", label: "신규", color: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "nurture", label: "육성", color: "bg-teal-50 text-teal-700 ring-teal-200" },
] as const;

export const REQUEST_STATUS = [
  { value: "received", label: "작성완료" },
  { value: "submitted", label: "접수" },
  { value: "na", label: "해당없음" },
] as const;

export function getStatusMeta(value: string) {
  // 육성(nurture) 우선 매칭 → 발굴(discovery) → fallback
  return (
    PROJECT_STATUS.find((s) => s.value === value) ??
    DISCOVERY_STATUS.find((s) => s.value === value) ??
    { value, label: value, color: "bg-slate-100 text-slate-700" }
  );
}
export function getBizMeta(value: string) {
  return BIZ_CATEGORY.find((s) => s.value === value) ?? { value, label: value, color: "bg-slate-50 text-slate-700 ring-slate-200" };
}
export function getServiceLabel(value: string | null | undefined) {
  if (!value) return "";
  return SERVICE_TYPE.find((s) => s.value === value)?.label ?? value;
}
export function getNurtureMeta(value: string | null | undefined) {
  if (!value) return null;
  return NURTURE_TYPE.find((s) => s.value === value) ?? null;
}
