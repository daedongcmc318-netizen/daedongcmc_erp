"use client";
import { useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  PROJECT_STATUS,
  BIZ_CATEGORY,
  SERVICE_TYPE,
  NURTURE_TYPE,
  REQUEST_STATUS,
} from "@/lib/enums";
import { Plus, X, Search, Trash2, ChevronDown, GripVertical } from "lucide-react";
import clsx from "clsx";
import {
  InlineText,
  InlineMoney,
  InlineDecimal,
  CheckCell,
  InlineDate,
  DateRange,
  PillSelect,
} from "@/components/projects/cells";

type CompanyContact = { id?: string; name: string; phone?: string | null; email?: string | null };
type Deliverable = {
  id: string;
  seq: number;
  title: string;
  isCompleted: boolean;
  completedDate: string | null;
};
type TaxInvoice = {
  id: string;
  amount: string;
  issueDate: string | null;
  issuedYn: boolean;
  vatReceivedYn: boolean;
  settlementDoneYn: boolean;
  paymentDoneYn: boolean;
  paymentDate: string | null;
  description: string | null;
  invoiceNo: string | null;
};
type Project = {
  id: string;
  projectCode: string;
  displayCode: string | null;
  year: number;
  title: string;
  companyId: string | null;
  agencyId: string | null;
  bizCategory: string;
  serviceType: string | null;
  serviceDetail: string | null;
  status: string;
  pmCode: string | null;
  managerId: string | null;
  confirmedRevenue: string;
  expectedRevenue: string;
  source: "discovery" | "nurture";
  confirmedYn: boolean;
  selfFunding: number | null;
  sortOrder: number;
  content: string | null;
  nurtureType: string | null;
  region: string | null;
  startDate: string | null;
  endDate: string | null;
  requestStatus: string | null;
  agreementYn: boolean;
  advancePaidYn: boolean;
  midReportDate: string | null;
  midReportYn: boolean;
  finalReportDate: string | null;
  finalReportYn: boolean;
  revisionYn: boolean;
  keyword: string | null;
  notes: string | null;
  remarks: string | null;
  company: { id: string; name: string; contacts?: CompanyContact[] } | null;
  agency: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  taxInvoices: TaxInvoice[];
  deliverables: Deliverable[];
};

type Company = { id: string; name: string; type: string };
type User = { id: string; name: string; pmCode: string | null; position: string };

// 발굴 시트 컬럼 (엑셀 순서 그대로)
const DISCOVERY_COLS = [
  "drag",
  "year",
  "title",
  "bizCategory",
  "serviceType",
  "status",
  "serviceDetail",
  "content",
  "region",
  "pmCode",
  "manager",
  "selfFunding",
  "expectedRevenue",
  "confirmedYn",
  "confirmedRevenue",
  "nurtureType",
  "notes",
  "delete",
] as const;

// 육성 시트 컬럼 (엑셀 순서 그대로)
const NURTURE_COLS = [
  "drag",
  "year",
  "displayCode",
  "title",
  "bizCategory",
  "agency",
  "serviceType",
  "status",
  "serviceDetail",
  "region",
  "pmCode",
  "manager",
  "confirmedRevenue",
  "nurtureType",
  "requestStatus",
  "agreementYn",
  "advancePaidYn",
  "schedule",
  "midReportDate",
  "midReportYn",
  "finalReportDate",
  "finalReportYn",
  "revisionYn",
  "invDescription",
  "invIssuedYn",
  "invIssueDate",
  "invVatReceivedYn",
  "invSettlementDoneYn",
  "invPaymentDoneYn",
  "invPaymentDate",
  "invAmount",
  "contactName",
  "contactPhone",
  "contactEmail",
  "keyword",
  "notes",
  "deliverableAgg",
  "deliverable1",
  "deliverable2",
  "deliverable3",
  "remarks",
  "delete",
] as const;

// 왼쪽 고정(sticky) 열: 가로 스크롤 시에도 업체 행 식별 가능
const FROZEN_NURTURE = ["drag", "year", "displayCode", "title"] as const;
const FROZEN_DISCOVERY = ["drag", "year", "title"] as const;
// 컬럼 폭(px) — Tailwind w-* 클래스와 동기화 필요
const COL_PX: Record<string, number> = {
  drag: 32, // w-8
  year: 64, // w-16
  displayCode: 64, // w-16
  title: 288, // w-72
};
function getStickyLeft(tab: "nurture" | "discovery", col: string): number | null {
  const frozen = (tab === "nurture" ? FROZEN_NURTURE : FROZEN_DISCOVERY) as readonly string[];
  const idx = frozen.indexOf(col);
  if (idx === -1) return null;
  let left = 0;
  for (let i = 0; i < idx; i++) left += COL_PX[frozen[i]] ?? 0;
  return left;
}
function isLastFrozen(tab: "nurture" | "discovery", col: string): boolean {
  const frozen = (tab === "nurture" ? FROZEN_NURTURE : FROZEN_DISCOVERY) as readonly string[];
  return frozen[frozen.length - 1] === col;
}

const COL_META: Record<string, { label: string; w: string }> = {
  drag: { label: "", w: "w-8" },
  year: { label: "연도", w: "w-16" },
  displayCode: { label: "구분", w: "w-16" },
  title: { label: "업체·기관명", w: "w-72" },
  bizCategory: { label: "사업영역", w: "w-28" },
  agency: { label: "운영기관", w: "w-44" },
  serviceType: { label: "서비스", w: "w-28" },
  status: { label: "진행현황", w: "w-32" },
  serviceDetail: { label: "상세서비스", w: "w-40" },
  content: { label: "내용", w: "w-48" },
  region: { label: "지역", w: "w-20" },
  pmCode: { label: "PM", w: "w-20" },
  manager: { label: "담당자", w: "w-24" },
  selfFunding: { label: "자부담", w: "w-20" },
  expectedRevenue: { label: "예상매출", w: "w-28" },
  confirmedYn: { label: "확정", w: "w-14" },
  confirmedRevenue: { label: "확정매출", w: "w-32" },
  nurtureType: { label: "신규육성", w: "w-20" },
  requestStatus: { label: "요청수신", w: "w-20" },
  agreementYn: { label: "협약", w: "w-14" },
  advancePaidYn: { label: "선금", w: "w-14" },
  schedule: { label: "수행일자", w: "w-44" },
  midReportDate: { label: "중간보고일자", w: "w-28" },
  midReportYn: { label: "중간보고", w: "w-16" },
  finalReportDate: { label: "완료보고일자", w: "w-28" },
  finalReportYn: { label: "완료보고", w: "w-16" },
  revisionYn: { label: "보완", w: "w-14" },
  invDescription: { label: "품목", w: "w-40" },
  invIssuedYn: { label: "계산서발행", w: "w-16" },
  invIssueDate: { label: "발행일자", w: "w-28" },
  invVatReceivedYn: { label: "부가세입금", w: "w-16" },
  invSettlementDoneYn: { label: "정산완료", w: "w-16" },
  invPaymentDoneYn: { label: "입금완료", w: "w-16" },
  invPaymentDate: { label: "입금일자", w: "w-28" },
  invAmount: { label: "계산서발행금액", w: "w-32" },
  contactName: { label: "업체담당자", w: "w-24" },
  contactPhone: { label: "전화번호", w: "w-28" },
  contactEmail: { label: "이메일", w: "w-40" },
  keyword: { label: "키워드", w: "w-32" },
  notes: { label: "비고", w: "w-48" },
  deliverableAgg: { label: "산출물", w: "w-56" },
  deliverable1: { label: "산출물1", w: "w-40" },
  deliverable2: { label: "산출물2", w: "w-40" },
  deliverable3: { label: "산출물3", w: "w-40" },
  remarks: { label: "특이사항", w: "w-56" },
  delete: { label: "", w: "w-10" },
};

export default function ProjectsClient({
  initialProjects,
  companies,
  users,
}: {
  initialProjects: Project[];
  companies: Company[];
  users: User[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tab, setTab] = useState<"nurture" | "discovery">("nurture");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBiz, setFilterBiz] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterPM, setFilterPM] = useState<string>("");
  const [filterDetail, setFilterDetail] = useState<string>("");
  const [filterManager, setFilterManager] = useState<string>("");
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const years = useMemo(
    () => Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a),
    [projects]
  );
  const pmCodes = useMemo(
    () => Array.from(new Set(users.map((u) => u.pmCode).filter(Boolean) as string[])),
    [users]
  );

  // 현재 탭의 프로젝트에서 등장하는 상세서비스 / 담당자 목록 추출
  const detailOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of projects) {
      if (p.source !== tab) continue;
      if (p.serviceDetail) s.add(p.serviceDetail);
    }
    return Array.from(s).sort();
  }, [projects, tab]);

  const managerOptions = useMemo(() => {
    const m = new Map<string, string>(); // id -> name
    for (const p of projects) {
      if (p.source !== tab) continue;
      if (p.manager) m.set(p.manager.id, p.manager.name);
    }
    return Array.from(m.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects, tab]);

  // 탭 + 필터 적용
  const filtered = useMemo(() => {
    return projects
      .filter((p) => p.source === tab)
      .filter((p) => {
        if (filterStatus && p.status !== filterStatus) return false;
        if (filterBiz && p.bizCategory !== filterBiz) return false;
        if (filterYear && String(p.year) !== filterYear) return false;
        if (filterPM && p.pmCode !== filterPM) return false;
        if (filterDetail && p.serviceDetail !== filterDetail) return false;
        if (filterManager && p.managerId !== filterManager) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = [p.title, p.projectCode, p.displayCode, p.serviceDetail, p.keyword, p.company?.name, p.manager?.name, p.content]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [projects, tab, filterStatus, filterBiz, filterYear, filterPM, filterDetail, filterManager, search]);

  const tabCounts = {
    nurture: projects.filter((p) => p.source === "nurture").length,
    discovery: projects.filter((p) => p.source === "discovery").length,
  };

  const cols = tab === "nurture" ? NURTURE_COLS : DISCOVERY_COLS;

  async function patchProject(id: string, patch: Record<string, any>) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text();
        let err: any = {};
        try { err = JSON.parse(text); } catch {}
        alert(`수정 실패 (${res.status}): ${err.error ?? err.detail ?? text.slice(0, 200) ?? "알 수 없는 오류"}`);
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          // 안전한 머지: 응답에 없는 nested는 기존 값 유지
          return {
            ...p,
            ...updated,
            company: updated.company ?? p.company,
            agency: updated.agency ?? p.agency,
            manager: updated.manager ?? p.manager,
            taxInvoices: updated.taxInvoices ?? p.taxInvoices,
            deliverables: updated.deliverables ?? p.deliverables,
          };
        })
      );
      router.refresh();
    } catch (e: any) {
      alert(`네트워크 오류: ${e.message}`);
    }
  }

  async function patchInvoice(invoiceId: string, projectId: string, patch: Record<string, any>) {
    const res = await fetch(`/api/tax-invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, taxInvoices: p.taxInvoices.map((i) => (i.id === invoiceId ? { ...i, ...updated } : i)) }
          : p
      )
    );
    router.refresh();
  }

  async function upsertDeliverable(projectId: string, seq: number, patch: Record<string, any>) {
    const project = projects.find((p) => p.id === projectId);
    const existing = project?.deliverables.find((d) => d.seq === seq);
    if (existing) {
      const res = await fetch(`/api/project-deliverables/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, deliverables: p.deliverables.map((d) => (d.id === existing.id ? { ...d, ...updated } : d)) }
            : p
        )
      );
    } else {
      const res = await fetch(`/api/project-deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, seq, ...patch }),
      });
      if (!res.ok) return;
      const created = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, deliverables: [...p.deliverables, created] } : p))
      );
    }
    router.refresh();
  }

  async function createInvoice(projectId: string, patch: Record<string, any>) {
    const res = await fetch(`/api/tax-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...patch }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, taxInvoices: [...p.taxInvoices, created] } : p))
    );
    router.refresh();
  }

  async function addProject(insertAfterId?: string) {
    const body: any = {
      title: tab === "nurture" ? "새 프로젝트" : "(업체명)",
      bizCategory: "innovation",
      status: "request_received",
      source: tab,
      year: new Date().getFullYear(),
    };
    if (insertAfterId) body.insertAfterId = insertAfterId;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const created = await res.json();
    setProjects((prev) => [created, ...prev]);
    router.refresh();
  }

  async function deleteProject(id: string) {
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  async function reorderRows(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const tabProjects = projects.filter((p) => p.source === tab).sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = tabProjects.findIndex((p) => p.id === dragId);
    const toIdx = tabProjects.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = [...tabProjects];
    const [item] = moved.splice(fromIdx, 1);
    moved.splice(toIdx, 0, item);
    // 즉시 UI 반영
    const orderMap = new Map(moved.map((p, i) => [p.id, i + 1]));
    setProjects((prev) =>
      prev.map((p) => (orderMap.has(p.id) ? { ...p, sortOrder: orderMap.get(p.id)! } : p))
    );
    setDragId(null);
    setDragOverId(null);
    // 서버 동기화
    await fetch("/api/projects/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: tab, orderedIds: moved.map((p) => p.id) }),
    });
    router.refresh();
  }

  const totalRevenue = filtered.reduce((acc, p) => acc + Number(p.confirmedRevenue ?? 0), 0);

  return (
    <div className="px-6 py-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">프로젝트 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            노션 DB 기반 · 현재 탭 합계{" "}
            <span className="font-medium text-slate-700">₩{totalRevenue.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={() => addProject()}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 새 프로젝트
        </button>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        <TabBtn active={tab === "nurture"} onClick={() => setTab("nurture")} count={tabCounts.nurture}>
          육성
        </TabBtn>
        <TabBtn active={tab === "discovery"} onClick={() => setTab("discovery")} count={tabCounts.discovery}>
          발굴
        </TabBtn>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-48"
          />
        </div>
        <FilterSelect value={filterYear} onChange={setFilterYear} label="연도" options={years.map((y) => ({ value: String(y), label: `${y}년` }))} />
        <FilterSelect value={filterBiz} onChange={setFilterBiz} label="사업영역" options={BIZ_CATEGORY.map((b) => ({ value: b.value, label: b.label }))} />
        <FilterSelect value={filterStatus} onChange={setFilterStatus} label="진행현황" options={PROJECT_STATUS.map((b) => ({ value: b.value, label: b.label }))} />
        <FilterSelect value={filterPM} onChange={setFilterPM} label="PM" options={pmCodes.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={filterManager} onChange={setFilterManager} label="담당자" options={managerOptions} />
        <FilterSelect value={filterDetail} onChange={setFilterDetail} label="상세서비스" options={detailOptions.map((d) => ({ value: d, label: d }))} />
        {(filterYear || filterBiz || filterStatus || filterPM || filterManager || filterDetail || search) && (
          <button
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 h-7"
            onClick={() => {
              setFilterYear("");
              setFilterBiz("");
              setFilterStatus("");
              setFilterPM("");
              setFilterManager("");
              setFilterDetail("");
              setSearch("");
            }}
          >
            <X className="w-3 h-3" /> 초기화
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{filtered.length} / {tabCounts[tab]}건</span>
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="text-xs border-separate border-spacing-0 table-fixed w-max min-w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-500 text-[11px] font-medium">
                {cols.map((c) => {
                  const left = getStickyLeft(tab, c);
                  const isFrozen = left !== null;
                  const last = isFrozen && isLastFrozen(tab, c);
                  return (
                    <th
                      key={c}
                      className={clsx(
                        "text-left px-2.5 py-2 border-b border-slate-200 font-medium whitespace-nowrap bg-slate-50",
                        COL_META[c].w,
                        isFrozen && "sticky",
                        last && "border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.04)]"
                      )}
                      style={isFrozen ? { left: `${left}px`, zIndex: 20 } : undefined}
                    >
                      {COL_META[c].label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  cols={cols}
                  tab={tab}
                  users={users}
                  isDragOver={dragOverId === p.id}
                  onPatch={(patch) => startTransition(() => patchProject(p.id, patch))}
                  onPatchInvoice={(invId, patch) => startTransition(() => patchInvoice(invId, p.id, patch))}
                  onCreateInvoice={(patch) => startTransition(() => createInvoice(p.id, patch))}
                  onUpsertDeliverable={(seq, patch) => startTransition(() => upsertDeliverable(p.id, seq, patch))}
                  onDelete={() => deleteProject(p.id)}
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverId !== p.id) setDragOverId(p.id);
                  }}
                  onDrop={() => reorderRows(p.id)}
                  onInsertAfter={() => addProject(p.id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={cols.length} className="text-center py-12 text-slate-400 text-sm">
                    표시할 프로젝트가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => addProject()}
          className="w-full text-left text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-800 px-3 py-2 border-t border-slate-200 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> 새 프로젝트 추가
        </button>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5",
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-800"
      )}
    >
      {children}
      <span
        className={clsx(
          "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-medium",
          active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "h-7 text-xs px-2 pr-6 rounded border bg-white appearance-none cursor-pointer",
          value ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600 hover:border-slate-300"
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function ProjectRow({
  project,
  cols,
  tab,
  users,
  isDragOver,
  onPatch,
  onPatchInvoice,
  onCreateInvoice,
  onUpsertDeliverable,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onInsertAfter,
}: {
  project: Project;
  cols: readonly string[];
  tab: "nurture" | "discovery";
  users: User[];
  isDragOver: boolean;
  onPatch: (patch: any) => void;
  onPatchInvoice: (invoiceId: string, patch: any) => void;
  onCreateInvoice: (patch: any) => void;
  onUpsertDeliverable: (seq: number, patch: any) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onInsertAfter: () => void;
}) {
  const inv = project.taxInvoices[0] ?? null;
  const contact = project.company?.contacts?.[0] ?? null;

  const invUpdate = (patch: Record<string, any>) => {
    if (inv) onPatchInvoice(inv.id, patch);
    else onCreateInvoice(patch);
  };

  return (
    <tr
      className={clsx(
        "group border-b border-slate-100 relative",
        isDragOver && "outline outline-2 outline-brand-300 outline-offset-[-2px]"
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {cols.map((c) => {
        const left = getStickyLeft(tab, c);
        const isFrozen = left !== null;
        const last = isFrozen && isLastFrozen(tab, c);
        return (
          <td
            key={c}
            className={clsx(
              "px-2.5 py-1.5 align-middle whitespace-nowrap overflow-hidden",
              COL_META[c].w,
              isFrozen
                ? "sticky bg-white group-hover:bg-slate-50"
                : "group-hover:bg-slate-50",
              last && "border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.04)]"
            )}
            style={isFrozen ? { left: `${left}px`, zIndex: 5 } : undefined}
          >
            {renderCell(c, project, inv, contact, users, onPatch, invUpdate, onUpsertDeliverable, onDelete, onDragStart, onInsertAfter)}
          </td>
        );
      })}
    </tr>
  );
}

function renderCell(
  c: string,
  p: Project,
  inv: TaxInvoice | null,
  contact: CompanyContact | null,
  users: User[],
  onPatch: (patch: any) => void,
  invUpdate: (patch: Record<string, any>) => void,
  onUpsertDeliverable: (seq: number, patch: any) => void,
  onDelete: () => void,
  onDragStart: () => void,
  onInsertAfter: () => void
) {
  const getDeliverable = (seq: number) => p.deliverables.find((d) => d.seq === seq) ?? null;
  switch (c) {
    case "drag":
      return (
        <div className="relative">
          <button
            draggable
            onDragStart={onDragStart}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-0.5"
            title="드래그하여 순서 변경"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onInsertAfter}
            className="opacity-0 group-hover:opacity-100 absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center shadow z-20 hover:bg-brand-700 transition"
            title="아래에 새 행 삽입"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
      );
    case "year":
      return (
        <InlineText
          value={String(p.year)}
          onSave={(v) => onPatch({ year: Number(v) || p.year })}
          className="font-mono text-[11px] text-slate-500"
        />
      );
    case "displayCode":
      return (
        <InlineText
          value={p.displayCode ?? ""}
          onSave={(v) => onPatch({ displayCode: v })}
          className="font-mono text-[11px] text-slate-700 font-medium"
          placeholder="—"
        />
      );
    case "title":
      return (
        <InlineText
          value={p.title}
          onSave={(v) => onPatch({ title: v })}
          className="font-medium text-slate-800"
        />
      );
    case "bizCategory":
      return (
        <PillSelect
          value={p.bizCategory}
          options={BIZ_CATEGORY}
          onChange={(v) => onPatch({ bizCategory: v })}
          renderPill={(o) =>
            o ? (
              <span className={clsx("px-2 py-0.5 rounded text-[11px] ring-1 font-medium whitespace-nowrap", o.color)}>
                {o.label}
              </span>
            ) : null
          }
        />
      );
    case "agency":
      return (
        <InlineText
          value={p.agency?.name ?? ""}
          onSave={() => {}}
          placeholder="—"
          className="text-slate-600 whitespace-nowrap"
        />
      );
    case "serviceType":
      return (
        <PillSelect
          value={p.serviceType}
          options={SERVICE_TYPE}
          onChange={(v) => onPatch({ serviceType: v })}
          placeholder="서비스"
          renderPill={(o) => (o ? <span className="text-[11px] text-slate-700 whitespace-nowrap">{o.label}</span> : null)}
        />
      );
    case "status":
      return (
        <PillSelect
          value={p.status}
          options={PROJECT_STATUS}
          onChange={(v) => onPatch({ status: v })}
          renderPill={(o) =>
            o ? (
              <span className={clsx("px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap", o.color)}>
                {o.label}
              </span>
            ) : null
          }
        />
      );
    case "serviceDetail":
      return (
        <InlineText
          value={p.serviceDetail ?? ""}
          onSave={(v) => onPatch({ serviceDetail: v })}
          placeholder="—"
          className="text-slate-600 whitespace-nowrap"
        />
      );
    case "content":
      return (
        <InlineText
          value={p.content ?? ""}
          onSave={(v) => onPatch({ content: v })}
          placeholder="—"
          className="text-slate-600 whitespace-nowrap"
        />
      );
    case "region":
      return (
        <InlineText value={p.region ?? ""} onSave={(v) => onPatch({ region: v })} placeholder="—" />
      );
    case "pmCode": {
      const pmOptions = users
        .filter((u) => u.pmCode)
        .map((u) => ({ value: u.pmCode as string, label: u.pmCode as string }));
      return (
        <PillSelect
          value={p.pmCode}
          options={pmOptions}
          onChange={(v) => onPatch({ pmCode: v })}
          renderPill={(o) =>
            o ? (
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-medium text-slate-700">
                {o.label}
              </span>
            ) : null
          }
        />
      );
    }
    case "manager": {
      const opts = users.map((u) => ({ value: u.id, label: u.name }));
      return (
        <PillSelect
          value={p.managerId}
          options={opts}
          onChange={(v) => onPatch({ managerId: v })}
          renderPill={(o) =>
            o ? (
              <span className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap">
                <span className="w-4 h-4 rounded-full bg-slate-300 text-[9px] text-white flex items-center justify-center font-medium shrink-0">
                  {o.label.slice(0, 1)}
                </span>
                {o.label}
              </span>
            ) : null
          }
        />
      );
    }
    case "selfFunding":
      return <InlineDecimal value={p.selfFunding} onSave={(v) => onPatch({ selfFunding: v })} />;
    case "expectedRevenue":
      return (
        <InlineMoney
          value={Number(p.expectedRevenue ?? 0)}
          onSave={(v) => onPatch({ expectedRevenue: v })}
        />
      );
    case "confirmedYn":
      return <div className="text-center"><CheckCell value={p.confirmedYn} onChange={(v) => onPatch({ confirmedYn: v })} /></div>;
    case "confirmedRevenue":
      return (
        <InlineMoney
          value={Number(p.confirmedRevenue ?? 0)}
          onSave={(v) => onPatch({ confirmedRevenue: v })}
        />
      );
    case "nurtureType":
      return (
        <PillSelect
          value={p.nurtureType}
          options={NURTURE_TYPE}
          onChange={(v) => onPatch({ nurtureType: v })}
          renderPill={(o) =>
            o ? (
              <span className={clsx("px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium whitespace-nowrap", o.color)}>
                {o.label}
              </span>
            ) : null
          }
        />
      );
    case "requestStatus":
      return (
        <PillSelect
          value={p.requestStatus}
          options={REQUEST_STATUS}
          onChange={(v) => onPatch({ requestStatus: v })}
          renderPill={(o) => (o ? <span className="text-[11px] text-slate-700 whitespace-nowrap">{o.label}</span> : null)}
        />
      );
    case "agreementYn":
      return <div className="text-center"><CheckCell value={p.agreementYn} onChange={(v) => onPatch({ agreementYn: v })} /></div>;
    case "advancePaidYn":
      return <div className="text-center"><CheckCell value={p.advancePaidYn} onChange={(v) => onPatch({ advancePaidYn: v })} /></div>;
    case "schedule":
      return (
        <DateRange
          start={p.startDate}
          end={p.endDate}
          onChange={(start, end) => onPatch({ startDate: start, endDate: end })}
        />
      );
    case "midReportDate":
      return <InlineDate value={p.midReportDate} onSave={(v) => onPatch({ midReportDate: v })} />;
    case "midReportYn":
      return <div className="text-center"><CheckCell value={p.midReportYn} onChange={(v) => onPatch({ midReportYn: v })} /></div>;
    case "finalReportDate":
      return <InlineDate value={p.finalReportDate} onSave={(v) => onPatch({ finalReportDate: v })} />;
    case "finalReportYn":
      return <div className="text-center"><CheckCell value={p.finalReportYn} onChange={(v) => onPatch({ finalReportYn: v })} /></div>;
    case "revisionYn":
      return <div className="text-center"><CheckCell value={p.revisionYn} onChange={(v) => onPatch({ revisionYn: v })} /></div>;
    case "invDescription":
      return (
        <InlineText
          value={inv?.description ?? ""}
          onSave={(v) => invUpdate({ description: v })}
          placeholder="—"
          className="text-slate-600"
        />
      );
    case "invIssuedYn":
      return <div className="text-center"><CheckCell value={!!inv?.issuedYn} onChange={(v) => invUpdate({ issuedYn: v })} /></div>;
    case "invIssueDate":
      return <InlineDate value={inv?.issueDate ?? null} onSave={(v) => invUpdate({ issueDate: v })} />;
    case "invVatReceivedYn":
      return <div className="text-center"><CheckCell value={!!inv?.vatReceivedYn} onChange={(v) => invUpdate({ vatReceivedYn: v })} /></div>;
    case "invSettlementDoneYn":
      return <div className="text-center"><CheckCell value={!!inv?.settlementDoneYn} onChange={(v) => invUpdate({ settlementDoneYn: v })} /></div>;
    case "invPaymentDoneYn":
      return <div className="text-center"><CheckCell value={!!inv?.paymentDoneYn} onChange={(v) => invUpdate({ paymentDoneYn: v })} /></div>;
    case "invPaymentDate":
      return <InlineDate value={inv?.paymentDate ?? null} onSave={(v) => invUpdate({ paymentDate: v })} />;
    case "invAmount":
      return <InlineMoney value={Number(inv?.amount ?? 0)} onSave={(v) => invUpdate({ amount: v })} />;
    case "contactName":
      return <div className="text-[11px] text-slate-600">{contact?.name ?? <span className="text-slate-300">—</span>}</div>;
    case "contactPhone":
      return <div className="text-[11px] text-slate-600">{contact?.phone ?? <span className="text-slate-300">—</span>}</div>;
    case "contactEmail":
      return <div className="text-[11px] text-slate-600 truncate" title={contact?.email ?? undefined}>{contact?.email ?? <span className="text-slate-300">—</span>}</div>;
    case "keyword":
      return <InlineText value={p.keyword ?? ""} onSave={(v) => onPatch({ keyword: v })} placeholder="—" />;
    case "notes":
      return (
        <InlineText
          value={p.notes ?? ""}
          onSave={(v) => onPatch({ notes: v })}
          placeholder="—"
          className="text-slate-500"
        />
      );
    case "deliverableAgg": {
      const titles = [1, 2, 3]
        .map((s) => getDeliverable(s)?.title)
        .filter(Boolean) as string[];
      if (titles.length === 0) return <span className="text-slate-300">—</span>;
      return (
        <div className="text-[11px] text-slate-600 leading-tight" title={titles.join("\n")}>
          {titles.map((t, i) => (
            <div key={i} className="truncate">
              {t}
            </div>
          ))}
        </div>
      );
    }
    case "deliverable1":
    case "deliverable2":
    case "deliverable3": {
      const seq = Number(c.slice(-1));
      const d = getDeliverable(seq);
      const dateLabel = d?.completedDate ? (typeof d.completedDate === "string" ? d.completedDate.slice(0, 10) : "") : "";
      return (
        <div>
          <InlineText
            value={d?.title ?? ""}
            onSave={(v) => onUpsertDeliverable(seq, { title: v })}
            placeholder="—"
            className="text-slate-700 text-[11px]"
          />
          {dateLabel && (
            <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">{dateLabel}</div>
          )}
        </div>
      );
    }
    case "remarks":
      return (
        <InlineText
          value={p.remarks ?? ""}
          onSave={(v) => onPatch({ remarks: v })}
          placeholder="—"
          className="text-slate-500"
        />
      );
    case "delete":
      return (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
          title="삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      );
    default:
      return null;
  }
}
