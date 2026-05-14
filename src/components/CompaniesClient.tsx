"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, Trash2, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileText, FileScan } from "lucide-react";
import clsx from "clsx";
import { InlineText, PillSelect, InlineDate } from "@/components/projects/cells";
import CompanyInvoicesModal from "@/components/CompanyInvoicesModal";
import CompanyOcrModal from "@/components/CompanyOcrModal";

type Contact = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
};

type Company = {
  id: string;
  name: string;
  bizNo: string | null;
  repName: string | null;
  address: string | null;
  region: string | null;
  type: string;
  website: string | null;
  industry: string | null;
  corpType: string | null;
  foundedAt: string | null;
  rating: string | null;
  internalPmCode: string | null;
  items: string | null;
  notes: string | null;
  contacts: Contact[];
  _count: { clientProjects: number; agencyProjects: number };
  invoiceCount: number;
};

const TYPE_OPTIONS = [
  { value: "client", label: "수혜기업", color: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "agency", label: "운영기관", color: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "partner", label: "협력사", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "etc", label: "기타", color: "bg-slate-50 text-slate-700 ring-slate-200" },
] as const;

const RATING_OPTIONS = [
  { value: "P", label: "P (우수)", color: "bg-amber-100 text-amber-800 ring-amber-200" },
  { value: "A", label: "A", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "B", label: "B", color: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "C", label: "C", color: "bg-slate-50 text-slate-600 ring-slate-200" },
] as const;

const COLS = [
  { key: "name", label: "거래처명", w: 240 },
  { key: "type", label: "유형", w: 96 },
  { key: "rating", label: "등급", w: 72 },
  { key: "bizNo", label: "사업자번호", w: 120 },
  { key: "repName", label: "대표자", w: 96 },
  { key: "contactName", label: "키맨", w: 112 },
  { key: "contactPos", label: "직위/전문분야", w: 160 },
  { key: "contactPhone", label: "연락처", w: 128 },
  { key: "contactEmail", label: "이메일", w: 200 },
  { key: "industry", label: "업종", w: 160 },
  { key: "region", label: "지역", w: 72 },
  { key: "address", label: "주소", w: 280 },
  { key: "website", label: "홈페이지", w: 200 },
  { key: "internalPmCode", label: "담당 PM", w: 96 },
  { key: "foundedAt", label: "설립일자", w: 112 },
  { key: "projectsCount", label: "프로젝트", w: 88 },
  { key: "invoicesCount", label: "세금계산서", w: 100 },
  { key: "notes", label: "비고", w: 240 },
  { key: "delete", label: "", w: 40 },
];

const FROZEN_COLS = ["name"];

function getStickyLeft(col: string): number | null {
  const idx = FROZEN_COLS.indexOf(col);
  if (idx === -1) return null;
  return 0;
}

const PAGE_SIZE = 100;

export default function CompaniesClient({ initialCompanies }: { initialCompanies: Company[] }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [filterPM, setFilterPM] = useState("");
  const [filterHasProject, setFilterHasProject] = useState(false);
  const [filterHasInvoice, setFilterHasInvoice] = useState(false);
  const [page, setPage] = useState(0);
  const [invoiceModalId, setInvoiceModalId] = useState<string | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);

  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const c of companies) if (c.region) s.add(c.region);
    return Array.from(s).sort();
  }, [companies]);

  const pms = useMemo(() => {
    const s = new Set<string>();
    for (const c of companies) if (c.internalPmCode) s.add(c.internalPmCode);
    return Array.from(s).sort();
  }, [companies]);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (filterType && c.type !== filterType) return false;
      if (filterRegion && c.region !== filterRegion) return false;
      if (filterRating && c.rating !== filterRating) return false;
      if (filterPM && c.internalPmCode !== filterPM) return false;
      if (filterHasProject && c._count.clientProjects + c._count.agencyProjects === 0) return false;
      if (filterHasInvoice && (!c.invoiceCount || c.invoiceCount === 0)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          c.name,
          c.bizNo,
          c.repName,
          c.industry,
          c.address,
          c.notes,
          c.items,
          ...c.contacts.map((x) => `${x.name} ${x.phone ?? ""} ${x.email ?? ""}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [companies, filterType, filterRegion, filterRating, filterPM, filterHasProject, filterHasInvoice, search]);

  // 필터 변경 시 페이지 0으로 리셋
  useEffect(() => {
    setPage(0);
  }, [filterType, filterRegion, filterRating, filterPM, filterHasProject, filterHasInvoice, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function patchCompany(id: string, patch: Record<string, any>) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    router.refresh();
  }

  async function patchContact(companyId: string, contactId: string, patch: Record<string, any>) {
    const res = await fetch(`/api/company-contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId
          ? { ...c, contacts: c.contacts.map((x) => (x.id === contactId ? { ...x, ...updated } : x)) }
          : c
      )
    );
    router.refresh();
  }

  async function createContact(companyId: string, patch: Record<string, any>) {
    const res = await fetch(`/api/company-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...patch }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, contacts: [...c.contacts, created] } : c))
    );
    router.refresh();
  }

  async function addCompany() {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "(새 거래처)", type: "client" }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setCompanies((prev) => [created, ...prev]);
    setPage(0);
    router.refresh();
  }

  async function deleteCompany(id: string) {
    if (!confirm("이 거래처를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "삭제 실패");
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  const withProj = filtered.filter((c) => c._count.clientProjects + c._count.agencyProjects > 0).length;
  const withBiz = filtered.filter((c) => c.bizNo && !c.bizNo.startsWith("temp-")).length;

  return (
    <div className="px-6 py-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">업체/거래처</h1>
          <p className="text-xs text-slate-500 mt-1">
            총 <span className="font-medium text-slate-700">{companies.length.toLocaleString()}</span>개사 ·
            사업자번호 확보 <span className="font-medium text-slate-700">{withBiz.toLocaleString()}</span>개사 ·
            프로젝트 연결 <span className="font-medium text-slate-700">{withProj.toLocaleString()}</span>개사
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOcrOpen(true)}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-brand-700 border border-brand-300 text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            <FileScan className="w-4 h-4" /> 사업자등록증으로 등록
          </button>
          <button
            onClick={addCompany}
            className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> 새 거래처
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처명, 사업자번호, 키맨, 업종, 주소..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-64"
          />
        </div>
        <FilterSelect
          value={filterType}
          onChange={setFilterType}
          label="유형"
          options={TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
        />
        <FilterSelect
          value={filterRegion}
          onChange={setFilterRegion}
          label="지역"
          options={regions.map((r) => ({ value: r, label: r }))}
        />
        <FilterSelect
          value={filterRating}
          onChange={setFilterRating}
          label="등급"
          options={RATING_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
        />
        <FilterSelect
          value={filterPM}
          onChange={setFilterPM}
          label="담당 PM"
          options={pms.map((p) => ({ value: p, label: p }))}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 ml-1 cursor-pointer">
          <input
            type="checkbox"
            checked={filterHasProject}
            onChange={(e) => setFilterHasProject(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-300 cursor-pointer"
          />
          프로젝트 있는 거래처만
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterHasInvoice}
            onChange={(e) => setFilterHasInvoice(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-300 cursor-pointer"
          />
          세금계산서 발행 이력만
        </label>
        {(filterType || filterRegion || filterRating || filterPM || filterHasProject || filterHasInvoice || search) && (
          <button
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 h-7"
            onClick={() => {
              setFilterType("");
              setFilterRegion("");
              setFilterRating("");
              setFilterPM("");
              setFilterHasProject(false);
              setFilterHasInvoice(false);
              setSearch("");
            }}
          >
            <X className="w-3 h-3" /> 초기화
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{filtered.length.toLocaleString()} / {companies.length.toLocaleString()}건</span>
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          <table className="text-xs border-separate border-spacing-0 table-fixed w-max min-w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-500 text-[11px] font-medium">
                {COLS.map((c) => {
                  const left = getStickyLeft(c.key);
                  const isFrozen = left !== null;
                  return (
                    <th
                      key={c.key}
                      style={{
                        width: c.w,
                        ...(isFrozen ? { left: `${left}px`, zIndex: 20 } : {}),
                      }}
                      className={clsx(
                        "text-left px-2.5 py-2 border-b border-slate-200 font-medium whitespace-nowrap bg-slate-50",
                        isFrozen && "sticky border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.04)]"
                      )}
                    >
                      {c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <CompanyRow
                  key={c.id}
                  company={c}
                  onPatch={(patch) => startTransition(() => patchCompany(c.id, patch))}
                  onPatchContact={(cid, patch) => startTransition(() => patchContact(c.id, cid, patch))}
                  onCreateContact={(patch) => startTransition(() => createContact(c.id, patch))}
                  onDelete={() => deleteCompany(c.id)}
                  onOpenInvoices={() => setInvoiceModalId(c.id)}
                />
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="text-center py-12 text-slate-400 text-sm">
                    표시할 거래처가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* 세금계산서 거래이력 모달 */}
        {invoiceModalId && (
          <CompanyInvoicesModal companyId={invoiceModalId} onClose={() => setInvoiceModalId(null)} />
        )}

        {/* 사업자등록증 OCR 모달 */}
        {ocrOpen && (
          <CompanyOcrModal
            onClose={() => setOcrOpen(false)}
            onCreated={(c) => {
              setCompanies((prev) => [{ ...c, invoiceCount: 0 } as any, ...prev]);
              setOcrOpen(false);
              setPage(0);
              router.refresh();
            }}
          />
        )}

        {/* 페이지네이션 */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50/50">
            <span className="text-[11px] text-slate-500 tabular-nums">
              {(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} / {filtered.length.toLocaleString()}건
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="h-7 px-2 rounded text-xs border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> 이전
              </button>
              <span className="text-[11px] tabular-nums text-slate-600 px-2">
                {page + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                disabled={page === pageCount - 1}
                className="h-7 px-2 rounded text-xs border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                다음 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
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

function CompanyRow({
  company,
  onPatch,
  onPatchContact,
  onCreateContact,
  onDelete,
  onOpenInvoices,
}: {
  company: Company;
  onPatch: (patch: any) => void;
  onPatchContact: (contactId: string, patch: any) => void;
  onCreateContact: (patch: any) => void;
  onDelete: () => void;
  onOpenInvoices: () => void;
}) {
  const contact = company.contacts[0] ?? null;
  const contactPatch = (patch: Record<string, any>) => {
    if (contact) onPatchContact(contact.id, patch);
    else onCreateContact(patch);
  };
  const totalProjects = company._count.clientProjects + company._count.agencyProjects;

  return (
    <tr className="group border-b border-slate-100">
      {COLS.map((col) => {
        const left = getStickyLeft(col.key);
        const isFrozen = left !== null;
        return (
          <td
            key={col.key}
            style={{
              width: col.w,
              ...(isFrozen ? { left: `${left}px`, zIndex: 5 } : {}),
            }}
            className={clsx(
              "px-2.5 py-1.5 align-middle whitespace-nowrap overflow-hidden",
              isFrozen
                ? "sticky bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[1px_0_0_rgba(0,0,0,0.04)]"
                : "group-hover:bg-slate-50"
            )}
          >
            {renderCell(col.key, company, contact, totalProjects, onPatch, contactPatch, onDelete, onOpenInvoices)}
          </td>
        );
      })}
    </tr>
  );
}

function renderCell(
  key: string,
  c: Company,
  contact: Contact | null,
  totalProjects: number,
  onPatch: (patch: any) => void,
  contactPatch: (patch: any) => void,
  onDelete: () => void,
  onOpenInvoices: () => void
) {
  switch (key) {
    case "name":
      // 세금계산서 이력이 있으면 클릭하여 모달 오픈 가능
      if (c.invoiceCount > 0) {
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenInvoices}
              className="font-medium text-slate-800 hover:text-brand-700 hover:underline truncate text-left"
              title="세금계산서 거래이력 보기"
            >
              {c.name}
            </button>
          </div>
        );
      }
      return (
        <InlineText
          value={c.name}
          onSave={(v) => onPatch({ name: v })}
          className="font-medium text-slate-800"
        />
      );
    case "type":
      return (
        <PillSelect
          value={c.type}
          options={TYPE_OPTIONS}
          onChange={(v) => onPatch({ type: v })}
          renderPill={(o) =>
            o ? (
              <span className={clsx("px-2 py-0.5 rounded text-[11px] ring-1 font-medium whitespace-nowrap", o.color)}>
                {o.label}
              </span>
            ) : null
          }
        />
      );
    case "rating":
      return (
        <PillSelect
          value={c.rating}
          options={RATING_OPTIONS}
          onChange={(v) => onPatch({ rating: v })}
          placeholder="—"
          renderPill={(o) =>
            o ? (
              <span className={clsx("px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium whitespace-nowrap", o.color)}>
                {o.value}
              </span>
            ) : null
          }
        />
      );
    case "bizNo": {
      const isPlaceholder = c.bizNo?.startsWith("temp-");
      return (
        <InlineText
          value={isPlaceholder ? "" : c.bizNo ?? ""}
          onSave={(v) => onPatch({ bizNo: v.replace(/[^\d]/g, "") || null })}
          placeholder="—"
          className="font-mono text-[11px] text-slate-600"
        />
      );
    }
    case "repName":
      return (
        <InlineText
          value={c.repName ?? ""}
          onSave={(v) => onPatch({ repName: v })}
          placeholder="—"
          className="text-slate-700"
        />
      );
    case "contactName":
      return (
        <InlineText
          value={contact?.name ?? ""}
          onSave={(v) => contactPatch({ name: v })}
          placeholder="—"
          className="text-slate-700"
        />
      );
    case "contactPos":
      return (
        <InlineText
          value={contact?.position ?? ""}
          onSave={(v) => contactPatch({ position: v })}
          placeholder="—"
          className="text-slate-500 text-[11px]"
        />
      );
    case "contactPhone":
      return (
        <InlineText
          value={contact?.phone ?? ""}
          onSave={(v) => contactPatch({ phone: v })}
          placeholder="—"
          className="text-slate-600 font-mono text-[11px]"
        />
      );
    case "contactEmail":
      return (
        <InlineText
          value={contact?.email ?? ""}
          onSave={(v) => contactPatch({ email: v })}
          placeholder="—"
          className="text-slate-600 text-[11px]"
        />
      );
    case "industry":
      return (
        <InlineText
          value={c.industry ?? ""}
          onSave={(v) => onPatch({ industry: v })}
          placeholder="—"
          className="text-slate-600"
        />
      );
    case "region":
      return (
        <InlineText
          value={c.region ?? ""}
          onSave={(v) => onPatch({ region: v })}
          placeholder="—"
          className="text-slate-600"
        />
      );
    case "address":
      return (
        <InlineText
          value={c.address ?? ""}
          onSave={(v) => onPatch({ address: v })}
          placeholder="—"
          className="text-slate-500 text-[11px]"
        />
      );
    case "website":
      return c.website ? (
        <a
          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 max-w-full"
          title={c.website}
        >
          <span className="truncate">{c.website.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ) : (
        <InlineText
          value=""
          onSave={(v) => onPatch({ website: v })}
          placeholder="—"
          className="text-slate-400 text-[11px]"
        />
      );
    case "internalPmCode":
      return (
        <InlineText
          value={c.internalPmCode ?? ""}
          onSave={(v) => onPatch({ internalPmCode: v })}
          placeholder="—"
          className="font-mono text-[11px] text-slate-700"
        />
      );
    case "foundedAt":
      return <InlineDate value={c.foundedAt} onSave={(v) => onPatch({ foundedAt: v })} />;
    case "projectsCount":
      return totalProjects > 0 ? (
        <a
          href={`/projects?company=${encodeURIComponent(c.name)}`}
          className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
        >
          {totalProjects}건
        </a>
      ) : (
        <span className="text-slate-300 text-[11px]">—</span>
      );
    case "invoicesCount":
      return c.invoiceCount > 0 ? (
        <button
          onClick={onOpenInvoices}
          className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
          title="세금계산서 거래이력 보기"
        >
          <FileText className="w-3 h-3" />
          {c.invoiceCount}건
        </button>
      ) : (
        <span className="text-slate-300 text-[11px]">—</span>
      );
    case "notes":
      return (
        <InlineText
          value={c.notes ?? ""}
          onSave={(v) => onPatch({ notes: v })}
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
