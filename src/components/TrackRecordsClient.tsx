"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Search, X, Plus, Trash2, ChevronDown, Sparkles, Globe, Link as LinkIcon, FileSpreadsheet, Loader2, AlertTriangle, Check } from "lucide-react";
import clsx from "clsx";

type TrackRecord = {
  id: string;
  type: "innovation" | "export" | string;
  category: string | null;
  seqNo: number | null;
  serviceName: string;
  serviceFee: string;
  processedAmount: string | null;
  feeType: string | null;
  startDate: string | null;
  endDate: string | null;
  clientCompanyId: string | null;
  clientName: string;
  processedDate: string | null;
  status: string | null;
  supportProgram: string | null;
  year: number | null;
  round: number | null;
  bizPeriodStart: string | null;
  bizPeriodEnd: string | null;
  bizNoChanged: boolean;
  country: string | null;
  region: string | null;
  notes: string | null;
  clientCompany: { id: string; name: string } | null;
  electronicTaxInvoiceId: string | null;
  electronicTaxInvoice: {
    id: string;
    approvalNo: string;
    writeDate: string;
    supplierName: string;
    buyerName: string;
    totalAmount: string;
    itemName: string | null;
  } | null;
};

type InvoiceSearchResult = {
  id: string;
  type: string;
  approvalNo: string;
  writeDate: string;
  issueDate: string | null;
  supplierName: string;
  supplierBizNo: string;
  buyerName: string;
  buyerBizNo: string;
  totalAmount: string;
  supplyAmount: string;
  itemName: string | null;
};

function fmtKRW(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  return `₩${n.toLocaleString()}`;
}

function fmtKRWShort(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return `₩${n.toLocaleString()}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

const STATUS_COLOR: Record<string, string> = {
  대금지급: "bg-emerald-100 text-emerald-800",
  입금완료: "bg-emerald-100 text-emerald-800",
  진행중: "bg-blue-100 text-blue-800",
  완료: "bg-slate-100 text-slate-600",
};

export default function TrackRecordsClient({
  initialRecords,
  usedYears,
  usedStatuses,
  usedPrograms,
}: {
  initialRecords: TrackRecord[];
  usedYears: number[];
  usedStatuses: string[];
  usedPrograms: string[];
}) {
  const router = useRouter();
  const [records, setRecords] = useState<TrackRecord[]>(initialRecords);
  const [tab, setTab] = useState<"innovation" | "export">("innovation");
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const tabRecords = useMemo(() => records.filter((r) => r.type === tab), [records, tab]);

  const filtered = useMemo(() => {
    return tabRecords.filter((r) => {
      if (filterYear && String(r.year) !== filterYear) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterProgram && r.supportProgram !== filterProgram) return false;
      if (filterCategory) {
        if (filterCategory === "_null" && r.category) return false;
        else if (filterCategory !== "_null" && r.category !== filterCategory) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          r.serviceName,
          r.clientName,
          r.clientCompany?.name,
          r.supportProgram,
          r.country,
          r.region,
          r.notes,
          r.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tabRecords, search, filterYear, filterStatus, filterProgram, filterCategory]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = { consulting: 0, tech_support: 0, marketing: 0, service: 0, certification: 0, etc: 0, _null: 0 };
    for (const r of tabRecords) {
      if (!r.category) c._null++;
      else if (c[r.category] !== undefined) c[r.category]++;
      else c.etc++;
    }
    return c;
  }, [tabRecords]);

  const totalFee = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.serviceFee ?? 0), 0),
    [filtered]
  );

  const counts = {
    innovation: records.filter((r) => r.type === "innovation").length,
    export: records.filter((r) => r.type === "export").length,
  };

  async function patchRecord(id: string, patch: Record<string, any>) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const res = await fetch(`/api/track-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("수정 실패");
      router.refresh();
      return;
    }
    const updated = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function linkInvoice(id: string, invoiceId: string | null) {
    const res = await fetch(`/api/track-records/${id}/link-invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electronicTaxInvoiceId: invoiceId }),
    });
    if (!res.ok) {
      alert("연결 실패");
      return;
    }
    const updated = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function createRecord() {
    const res = await fetch("/api/track-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: tab,
        serviceName: "(신규)",
        clientName: "(미지정)",
      }),
    });
    if (!res.ok) {
      alert("생성 실패");
      return;
    }
    const created = await res.json();
    setRecords((prev) => [created, ...prev]);
  }

  async function deleteRecord(id: string) {
    if (!confirm("이 실적을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/track-records/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="px-8 py-7 max-w-[1600px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">사업 ▸ 실적 관리</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">서비스 수행 실적</h1>
          <p className="text-sm text-slate-500 mt-1">
            현재 탭 <strong className="text-slate-700">{filtered.length}건</strong> / 전체{" "}
            {counts.innovation + counts.export}건 · 금액 합계{" "}
            <strong className="text-slate-700">{fmtKRW(totalFee)}</strong>
          </p>
        </div>
        <button
          onClick={createRecord}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 신규 실적
        </button>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        <TabBtn active={tab === "innovation"} onClick={() => setTab("innovation")} count={counts.innovation}>
          <Sparkles className="w-3.5 h-3.5" /> 혁신
        </TabBtn>
        <TabBtn active={tab === "export"} onClick={() => setTab("export")} count={counts.export}>
          <Globe className="w-3.5 h-3.5" /> 수출
        </TabBtn>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="서비스/기업/지원사업 검색..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-56"
          />
        </div>
        {tab === "export" && (
          <>
            <FilterSelect value={filterYear} onChange={setFilterYear} label="연도" options={usedYears.map((y) => ({ value: String(y), label: `${y}년` }))} />
            <FilterSelect value={filterProgram} onChange={setFilterProgram} label="지원사업" options={usedPrograms.map((p) => ({ value: p, label: p }))} />
          </>
        )}
        <FilterSelect value={filterStatus} onChange={setFilterStatus} label="진행상태" options={usedStatuses.map((s) => ({ value: s, label: s }))} />
        <FilterSelect
          value={filterCategory}
          onChange={setFilterCategory}
          label="카테고리"
          options={[
            { value: "consulting", label: `컨설팅 (${categoryCounts.consulting})` },
            { value: "tech_support", label: `기술지원 (${categoryCounts.tech_support})` },
            { value: "marketing", label: `마케팅 (${categoryCounts.marketing})` },
            { value: "service", label: `용역 (${categoryCounts.service})` },
            { value: "certification", label: `인증 (${categoryCounts.certification})` },
            { value: "etc", label: `기타 (${categoryCounts.etc})` },
            { value: "_null", label: `미분류 (${categoryCounts._null})` },
          ]}
        />
        {(search || filterYear || filterStatus || filterProgram || filterCategory) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterYear("");
              setFilterStatus("");
              setFilterProgram("");
              setFilterCategory("");
            }}
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 h-7"
          >
            <X className="w-3 h-3" /> 초기화
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length} / {tabRecords.length}건
        </span>
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)]">
          {tab === "innovation" ? (
            <InnovationTable
              records={filtered}
              onPatch={patchRecord}
              onDelete={deleteRecord}
              onPickInvoice={(id) => setPickerFor(id)}
              onUnlinkInvoice={(id) => linkInvoice(id, null)}
            />
          ) : (
            <ExportTable
              records={filtered}
              onPatch={patchRecord}
              onDelete={deleteRecord}
              onPickInvoice={(id) => setPickerFor(id)}
              onUnlinkInvoice={(id) => linkInvoice(id, null)}
            />
          )}
        </div>
      </div>

      {/* 세금계산서 매칭 picker */}
      {pickerFor && (() => {
        const target = records.find((r) => r.id === pickerFor);
        if (!target) return null;
        return (
          <InvoicePickerModal
            record={target}
            onClose={() => setPickerFor(null)}
            onSelect={async (invoiceId) => {
              await linkInvoice(target.id, invoiceId);
              setPickerFor(null);
            }}
          />
        );
      })()}
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
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
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
          "h-7 text-xs px-2 pr-6 rounded border bg-white appearance-none cursor-pointer max-w-[220px] truncate",
          value
            ? "border-brand-300 text-brand-700 bg-brand-50"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
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

/* ─────────── 혁신 테이블 ─────────── */
function ExportTable({
  records,
  onPatch,
  onDelete,
  onPickInvoice,
  onUnlinkInvoice,
}: {
  records: TrackRecord[];
  onPatch: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
  onPickInvoice: (id: string) => void;
  onUnlinkInvoice: (id: string) => void;
}) {
  return (
    <table className="text-[11.5px] w-full table-auto">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr className="text-slate-500 text-[10.5px] font-medium">
          <Th className="w-12">#</Th>
          <Th className="w-20">카테고리</Th>
          <Th className="w-44">서비스명</Th>
          <Th className="w-28">서비스요금</Th>
          <Th className="w-28">처리금액</Th>
          <Th className="w-24">시작일</Th>
          <Th className="w-24">종료일</Th>
          <Th className="w-52">지원사업명</Th>
          <Th className="w-14">연도</Th>
          <Th className="w-12">차수</Th>
          <Th className="w-40">참여기업</Th>
          <Th className="w-24">처리일자</Th>
          <Th className="w-20">진행상태</Th>
          <Th className="w-20">국가</Th>
          <Th className="w-24">지역</Th>
          <Th className="w-32">세금계산서</Th>
          <Th className="w-10"></Th>
        </tr>
      </thead>
      <tbody>
        {records.length === 0 ? (
          <tr>
            <td colSpan={17} className="text-center py-12 text-sm text-slate-400">
              표시할 실적이 없습니다
            </td>
          </tr>
        ) : (
          records.map((r) => (
            <tr key={r.id} className="group hover:bg-slate-50/60 border-b border-slate-100">
              <Td className="font-mono text-[10px] text-slate-400 tabular-nums">{r.seqNo ?? "—"}</Td>
              <Td>
                <CategorySelect value={r.category} onChange={(v) => onPatch(r.id, { category: v })} />
              </Td>
              <Td>
                <InlineText value={r.serviceName} onSave={(v) => onPatch(r.id, { serviceName: v })} />
              </Td>
              <Td className="text-right">
                <InlineMoney value={r.serviceFee} onSave={(v) => onPatch(r.id, { serviceFee: v })} />
              </Td>
              <Td className="text-right">
                <InlineMoney
                  value={r.processedAmount ?? "0"}
                  onSave={(v) => onPatch(r.id, { processedAmount: v })}
                />
              </Td>
              <Td>
                <InlineDate value={r.startDate} onSave={(v) => onPatch(r.id, { startDate: v })} />
              </Td>
              <Td>
                <InlineDate value={r.endDate} onSave={(v) => onPatch(r.id, { endDate: v })} />
              </Td>
              <Td>
                <InlineText
                  value={r.supportProgram ?? ""}
                  onSave={(v) => onPatch(r.id, { supportProgram: v })}
                  placeholder="—"
                  className="text-[11px] text-slate-600 truncate"
                />
              </Td>
              <Td className="tabular-nums">
                <InlineText
                  value={r.year != null ? String(r.year) : ""}
                  onSave={(v) => onPatch(r.id, { year: v ? Number(v) : null })}
                  placeholder="—"
                />
              </Td>
              <Td className="tabular-nums">
                <InlineText
                  value={r.round != null ? String(r.round) : ""}
                  onSave={(v) => onPatch(r.id, { round: v ? Number(v) : null })}
                  placeholder="—"
                />
              </Td>
              <Td>
                <div>
                  <InlineText
                    value={r.clientName}
                    onSave={(v) => onPatch(r.id, { clientName: v })}
                    className="font-medium text-slate-800"
                  />
                  {r.clientCompany ? (
                    <span className="text-[9px] text-emerald-600 inline-flex items-center gap-0.5 mt-0.5">
                      <LinkIcon className="w-2.5 h-2.5" /> 거래처 매칭
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-300">미매칭</span>
                  )}
                </div>
              </Td>
              <Td>
                <InlineDate value={r.processedDate} onSave={(v) => onPatch(r.id, { processedDate: v })} />
              </Td>
              <Td>
                <StatusBadge value={r.status} onSave={(v) => onPatch(r.id, { status: v })} />
              </Td>
              <Td>
                <InlineText
                  value={r.country ?? ""}
                  onSave={(v) => onPatch(r.id, { country: v })}
                  placeholder="—"
                  className="text-slate-600"
                />
              </Td>
              <Td>
                <InlineText
                  value={r.region ?? ""}
                  onSave={(v) => onPatch(r.id, { region: v })}
                  placeholder="—"
                  className="text-slate-600"
                />
              </Td>
              <Td>
                <InvoiceBadge record={r} onPick={() => onPickInvoice(r.id)} onUnlink={() => onUnlinkInvoice(r.id)} />
              </Td>
              <Td>
                <button
                  onClick={() => onDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/* ─────────── 수출 테이블 ─────────── */
function InnovationTable({
  records,
  onPatch,
  onDelete,
  onPickInvoice,
  onUnlinkInvoice,
}: {
  records: TrackRecord[];
  onPatch: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
  onPickInvoice: (id: string) => void;
  onUnlinkInvoice: (id: string) => void;
}) {
  return (
    <table className="text-[11.5px] w-full table-auto">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr className="text-slate-500 text-[10.5px] font-medium">
          <Th className="w-12">#</Th>
          <Th className="w-20">카테고리</Th>
          <Th>서비스명</Th>
          <Th className="w-32">서비스이용금액</Th>
          <Th className="w-24">요금형태</Th>
          <Th className="w-24">시작일</Th>
          <Th className="w-24">종료일</Th>
          <Th className="w-48">수요기업명</Th>
          <Th className="w-24">처리일자</Th>
          <Th className="w-24">진행상태</Th>
          <Th className="w-32">세금계산서</Th>
          <Th className="w-10"></Th>
        </tr>
      </thead>
      <tbody>
        {records.length === 0 ? (
          <tr>
            <td colSpan={12} className="text-center py-12 text-sm text-slate-400">
              표시할 실적이 없습니다
            </td>
          </tr>
        ) : (
          records.map((r) => (
            <tr key={r.id} className="group hover:bg-slate-50/60 border-b border-slate-100">
              <Td className="font-mono text-[10px] text-slate-400 tabular-nums">{r.seqNo ?? "—"}</Td>
              <Td>
                <CategorySelect value={r.category} onChange={(v) => onPatch(r.id, { category: v })} />
              </Td>
              <Td>
                <InlineText value={r.serviceName} onSave={(v) => onPatch(r.id, { serviceName: v })} />
              </Td>
              <Td className="text-right">
                <InlineMoney value={r.serviceFee} onSave={(v) => onPatch(r.id, { serviceFee: v })} />
              </Td>
              <Td>
                <InlineText
                  value={r.feeType ?? ""}
                  onSave={(v) => onPatch(r.id, { feeType: v })}
                  placeholder="—"
                  className="text-slate-600"
                />
              </Td>
              <Td>
                <InlineDate value={r.startDate} onSave={(v) => onPatch(r.id, { startDate: v })} />
              </Td>
              <Td>
                <InlineDate value={r.endDate} onSave={(v) => onPatch(r.id, { endDate: v })} />
              </Td>
              <Td>
                <div>
                  <InlineText
                    value={r.clientName}
                    onSave={(v) => onPatch(r.id, { clientName: v })}
                    className="font-medium text-slate-800"
                  />
                  {r.clientCompany ? (
                    <span className="text-[9px] text-emerald-600 inline-flex items-center gap-0.5 mt-0.5">
                      <LinkIcon className="w-2.5 h-2.5" /> 거래처 매칭
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-300">미매칭</span>
                  )}
                </div>
              </Td>
              <Td>
                <InlineDate value={r.processedDate} onSave={(v) => onPatch(r.id, { processedDate: v })} />
              </Td>
              <Td>
                <StatusBadge value={r.status} onSave={(v) => onPatch(r.id, { status: v })} />
              </Td>
              <Td>
                <InvoiceBadge record={r} onPick={() => onPickInvoice(r.id)} onUnlink={() => onUnlinkInvoice(r.id)} />
              </Td>
              <Td>
                <button
                  onClick={() => onDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      className={clsx(
        "text-left px-2.5 py-2 border-b-2 border-slate-300 border-r border-slate-200 font-medium whitespace-nowrap bg-slate-50",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <td className={clsx("px-2.5 py-1.5 align-middle whitespace-nowrap border-r border-slate-100 overflow-hidden", className)}>
      {children}
    </td>
  );
}

/* ─────────── 인라인 편집 ─────────── */

function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className={clsx("cursor-text min-h-[18px] truncate", className, !value && "text-slate-300")}
        title={value}
      >
        {value || placeholder || "—"}
      </div>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (draft !== value) onSave(draft);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1.5 text-[11.5px] border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white"
    />
  );
}

function InlineMoney({ value, onSave }: { value: string; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const n = Number(value ?? 0);
  const [draft, setDraft] = useState(String(n));
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(String(n));
          setEditing(true);
        }}
        className="cursor-text min-h-[18px] tabular-nums text-right text-slate-700"
      >
        {n ? `₩${n.toLocaleString()}` : <span className="text-slate-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const v = Number(draft || 0);
        if (v !== n) onSave(v);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const v = Number(draft || 0);
          if (v !== n) onSave(v);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1.5 text-[11.5px] text-right border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white tabular-nums"
    />
  );
}

function InlineDate({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const display = value ? value.slice(0, 10) : "";
  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer min-h-[18px] text-[11px] text-slate-600 tabular-nums"
      >
        {display || <span className="text-slate-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="date"
      value={display}
      onChange={(e) => onSave(e.target.value || null)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") setEditing(false);
      }}
      className="h-6 px-1 text-[10px] border border-brand-300 rounded outline-none bg-white"
    />
  );
}

function StatusBadge({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const color = (value && STATUS_COLOR[value]) ?? "bg-slate-100 text-slate-600";
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", color)}
      >
        {value ?? "—"}
      </button>
    );
  }
  return (
    <input
      autoFocus
      defaultValue={value ?? ""}
      onBlur={(e) => {
        if (e.target.value !== (value ?? "")) onSave(e.target.value);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const v = (e.target as HTMLInputElement).value;
          if (v !== (value ?? "")) onSave(v);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="h-6 px-1.5 text-[11px] border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white w-20"
    />
  );
}

/* ─────────── 세금계산서 매칭 배지 + picker ─────────── */

function InvoiceBadge({
  record,
  onPick,
  onUnlink,
}: {
  record: TrackRecord;
  onPick: () => void;
  onUnlink: () => void;
}) {
  const inv = record.electronicTaxInvoice;
  if (inv) {
    return (
      <div className="flex items-center gap-1 group/inv">
        <button
          onClick={onPick}
          className="flex-1 text-left text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium hover:bg-emerald-200 truncate flex items-center gap-1"
          title={`${inv.approvalNo} · ${inv.writeDate.slice(0, 10)} · ${inv.supplierName} → ${inv.buyerName} · ₩${Number(inv.totalAmount).toLocaleString()}`}
        >
          <FileSpreadsheet className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{inv.writeDate.slice(0, 10).replace(/-/g, "")}</span>
        </button>
        <button
          onClick={onUnlink}
          className="opacity-0 group-hover/inv:opacity-100 text-slate-300 hover:text-rose-500"
          title="연결 해제"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-700 font-medium flex items-center gap-1"
    >
      <AlertTriangle className="w-2.5 h-2.5" /> 미연결
    </button>
  );
}

function InvoicePickerModal({
  record,
  onClose,
  onSelect,
}: {
  record: TrackRecord;
  onClose: () => void;
  onSelect: (invoiceId: string | null) => void | Promise<void>;
}) {
  const [q, setQ] = useState(record.clientCompany?.name ?? record.clientName ?? "");
  const [useAmount, setUseAmount] = useState(true);
  const [useDate, setUseDate] = useState(true);
  const [items, setItems] = useState<InvoiceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const amount = String(record.processedAmount ?? record.serviceFee ?? "0");
  const refDate = record.processedDate ?? record.endDate ?? record.startDate;

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (useAmount && Number(amount) > 0) params.set("amount", amount);
        if (useDate && refDate) params.set("date", refDate);
        params.set("limit", "30");
        const res = await fetch(`/api/electronic-tax-invoices/search?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } catch {
        // ignore aborts
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, useAmount, useDate, amount, refDate]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-brand-500" />
              <h2 className="text-sm font-semibold truncate">세금계산서 연결 — {record.serviceName}</h2>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              실적 정보: {record.clientName} · ₩{Number(amount).toLocaleString()} ·{" "}
              {refDate ? refDate.slice(0, 10) : "—"}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 검색 + 필터 */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="기업명/사업자번호/승인번호/품목 검색..."
              className="w-full h-8 pl-8 pr-3 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200 bg-white"
            />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={useAmount}
                onChange={(e) => setUseAmount(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-slate-600">금액 ±2% 일치</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={useDate}
                onChange={(e) => setUseDate(e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              <span className="text-slate-600">처리일자 근접도 정렬</span>
            </label>
            {record.electronicTaxInvoiceId && (
              <button
                onClick={() => onSelect(null)}
                className="ml-auto text-rose-600 hover:text-rose-700 font-medium"
              >
                연결 해제
              </button>
            )}
          </div>
        </div>

        {/* 결과 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-12 text-[12px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> 검색 중...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-slate-400">결과 없음</div>
          ) : (
            <table className="w-full text-[11.5px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 text-[10.5px]">
                  <Th className="w-20">구분</Th>
                  <Th className="w-24">작성일</Th>
                  <Th>공급자 → 공급받는자</Th>
                  <Th className="w-32">금액</Th>
                  <Th className="w-32">승인번호</Th>
                  <Th className="w-16"></Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isSelected = it.id === record.electronicTaxInvoiceId;
                  return (
                    <tr
                      key={it.id}
                      className={clsx(
                        "border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer",
                        isSelected && "bg-emerald-50"
                      )}
                      onClick={() => onSelect(it.id)}
                    >
                      <Td>
                        <span
                          className={clsx(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            it.type === "sales"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          )}
                        >
                          {it.type === "sales" ? "매출" : "매입"}
                        </span>
                      </Td>
                      <Td className="tabular-nums text-slate-600">{it.writeDate.slice(0, 10)}</Td>
                      <Td>
                        <div className="text-[11px] truncate text-slate-700">
                          {it.supplierName}
                          <span className="text-slate-400 mx-1">→</span>
                          {it.buyerName}
                        </div>
                        {it.itemName && (
                          <div className="text-[9.5px] text-slate-400 truncate">{it.itemName}</div>
                        )}
                      </Td>
                      <Td className="tabular-nums text-right font-medium text-slate-800">
                        ₩{Number(it.totalAmount).toLocaleString()}
                      </Td>
                      <Td className="font-mono text-[10px] text-slate-500">{it.approvalNo}</Td>
                      <Td>
                        {isSelected ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-300" />
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40 flex justify-end">
          <button
            onClick={onClose}
            className="h-7 px-3 text-[11px] text-slate-600 hover:text-slate-800 font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 카테고리 셀렉트 (인라인) ─────────── */
const CATEGORY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "consulting", label: "컨설팅", color: "bg-violet-100 text-violet-700 ring-violet-200" },
  { value: "tech_support", label: "기술지원", color: "bg-blue-100 text-blue-700 ring-blue-200" },
  { value: "marketing", label: "마케팅", color: "bg-rose-100 text-rose-700 ring-rose-200" },
  { value: "service", label: "용역", color: "bg-amber-100 text-amber-700 ring-amber-200" },
  { value: "certification", label: "인증", color: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  { value: "etc", label: "기타", color: "bg-slate-100 text-slate-600 ring-slate-200" },
];

function CategorySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === value);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={`text-[10.5px] px-1.5 py-0.5 rounded ring-1 cursor-pointer outline-none focus:ring-2 focus:ring-brand-300 appearance-none w-full ${
        opt ? opt.color : "bg-slate-50 text-slate-400 ring-slate-200"
      }`}
    >
      <option value="">—</option>
      {CATEGORY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
