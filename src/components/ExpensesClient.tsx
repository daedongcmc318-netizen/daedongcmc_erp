"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, CheckCircle2, XCircle, FileText, Loader2, Receipt, Trash2 } from "lucide-react";
import clsx from "clsx";

type User = { id: string; name: string; empNo: string; dept: string; position: string; pmCode: string | null; role: string };
type Project = { id: string; title: string; displayCode: string | null; year: number };
type Expense = {
  id: string;
  expenseNo: string;
  title: string;
  category: string;
  amount: string;
  description: string | null;
  attachmentNote: string | null;
  paymentMethod: string | null;
  requestDate: string;
  status: string;
  rejectReason: string | null;
  approvedDate: string | null;
  taxInvoiceId: string | null;
  projectId: string | null;
  requester: { id: string; name: string; pmCode: string | null } | null;
  approver: { id: string; name: string; pmCode: string | null } | null;
  project: { id: string; title: string; displayCode: string | null; year: number } | null;
  // 결재 첨부 4종
  taxInvoiceImageUrl?: string | null;
  businessRegUrl?: string | null;
  bankAccountUrl?: string | null;
  quotationUrl?: string | null;
  approvalRoute?: string;
  createdAt: string;
};

const CATEGORIES = [
  "출장비",
  "재료비",
  "인쇄비",
  "도서구입비",
  "장비임차비",
  "외주용역비",
  "소모품비",
  "회의비",
  "교육훈련비",
  "기타",
];
const PAYMENT_METHODS = [
  { v: "card", l: "법인카드" },
  { v: "cash", l: "현금" },
  { v: "transfer", l: "계좌이체" },
];
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "결재대기", color: "bg-amber-100 text-amber-800" },
  approved: { label: "승인", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "반려", color: "bg-rose-100 text-rose-700" },
  cancelled: { label: "취소", color: "bg-slate-100 text-slate-500" },
};

type TripRow = {
  id: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  totalCost: string;
  status: string;
  approvalRoute: string;
  createdAt: string;
  user: { id: string; name: string; position: string };
};
type LeaveRow = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  approvalRoute: string;
  currentLevel: number;
  createdAt: string;
  user: { id: string; name: string; position: string };
  approvals: { level: number; status: string; approver: { name: string; position: string } }[];
};

export default function ExpensesClient({
  initialExpenses,
  users,
  projects,
  me,
  tripReports = [],
  leaveRequests = [],
}: {
  initialExpenses: Expense[];
  users: User[];
  projects: Project[];
  me: { id: string; name: string; role: string } | null;
  tripReports?: TripRow[];
  leaveRequests?: LeaveRow[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>(initialExpenses);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [typeTab, setTypeTab] = useState<"all" | "expense" | "trip" | "leave">("all");
  const [editing, setEditing] = useState<Expense | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const k of Object.keys(STATUS_META)) c[k] = 0;
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter && it.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          it.title,
          it.expenseNo,
          it.requester?.name,
          it.approver?.name,
          it.project?.title,
          it.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, search]);

  return (
    <div className="px-6 py-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">전자결재함</h1>
          <p className="text-xs text-slate-500 mt-1">
            지출결의서 · 출장신청서 · 휴가신청서 통합 현황
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 신규 지출결의
        </button>
      </div>

      {/* 결재 유형 탭 */}
      <div className="flex items-center gap-1 mb-2 border-b border-slate-200">
        <TypeTab active={typeTab === "all"} onClick={() => setTypeTab("all")} count={items.length + tripReports.length + leaveRequests.length}>
          전체
        </TypeTab>
        <TypeTab active={typeTab === "expense"} onClick={() => setTypeTab("expense")} count={items.length}>
          지출결의서
        </TypeTab>
        <TypeTab active={typeTab === "trip"} onClick={() => setTypeTab("trip")} count={tripReports.length}>
          출장신청서
        </TypeTab>
        <TypeTab active={typeTab === "leave"} onClick={() => setTypeTab("leave")} count={leaveRequests.length}>
          휴가신청서
        </TypeTab>
        <span className="ml-auto text-[10px] text-slate-400 pr-2">
          출장/휴가 신규 작성은 사이드바 메뉴에서
        </span>
      </div>

      {/* 상태 탭 (지출결의서일 때만) */}
      {typeTab === "expense" && <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        <StatusTab active={statusFilter === ""} onClick={() => setStatusFilter("")} count={counts.all}>
          전체
        </StatusTab>
        {Object.entries(STATUS_META).map(([k, m]) => (
          <StatusTab
            key={k}
            active={statusFilter === k}
            onClick={() => setStatusFilter(k)}
            count={counts[k] ?? 0}
          >
            {m.label}
          </StatusTab>
        ))}
      </div>}

      {/* 검색 (지출결의서 + 전체) */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 결의번호, 기안자, 결재자, 프로젝트..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-72"
          />
        </div>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length} / {items.length}건
        </span>
      </div>

      {/* 전체 통합 뷰 (3종 합쳐서 보기) */}
      {typeTab === "all" && (
        <UnifiedApprovalList
          expenses={filtered}
          trips={tripReports}
          leaves={leaveRequests}
          onClickExpense={(e) => setEditing(e)}
        />
      )}

      {/* 출장신청서 */}
      {typeTab === "trip" && <TripList items={tripReports} />}

      {/* 휴가신청서 */}
      {typeTab === "leave" && <LeaveList items={leaveRequests} />}

      {/* 지출결의서 전용 표 */}
      {typeTab === "expense" && <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
              <th className="text-left px-3 py-2.5 w-32">결의번호</th>
              <th className="text-left px-3 py-2.5 w-24">신청일자</th>
              <th className="text-left px-3 py-2.5">제목</th>
              <th className="text-left px-3 py-2.5 w-44">프로젝트</th>
              <th className="text-left px-3 py-2.5 w-24">기안자</th>
              <th className="text-left px-3 py-2.5 w-24">결재자</th>
              <th className="text-right px-3 py-2.5 w-32">금액</th>
              <th className="text-left px-3 py-2.5 w-24">상태</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const sm = STATUS_META[it.status] ?? { label: it.status, color: "bg-slate-100 text-slate-600" };
              return (
                <tr
                  key={it.id}
                  onClick={() => setEditing(it)}
                  className="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer group"
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-brand-700 font-medium">{it.expenseNo}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{it.requestDate.slice(0, 10)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 truncate">{it.title}</td>
                  <td className="px-3 py-2 text-slate-600 text-[11px] truncate">
                    {it.project ? (
                      <>
                        <span className="font-mono text-[10px] text-slate-400 mr-1">{it.project.displayCode ?? ""}</span>
                        {it.project.title}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{it.requester?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{it.approver?.name ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    ₩{Number(it.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={clsx("px-2 py-0.5 rounded text-[10.5px] font-medium whitespace-nowrap", sm.color)}>
                      {sm.label}
                    </span>
                  </td>
                  <td className="px-1 text-right">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("삭제하시겠습니까?")) return;
                        const res = await fetch(`/api/expenses/${it.id}`, { method: "DELETE" });
                        if (res.ok) {
                          setItems((prev) => prev.filter((x) => x.id !== it.id));
                          router.refresh();
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                  표시할 기안이 없습니다. 「+ 신규 지출결의」으로 시작하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>}

      {creating && (
        <ExpenseFormModal
          isCreating
          users={users}
          projects={projects}
          me={me}
          onClose={() => setCreating(false)}
          onSaved={(e) => {
            setItems((prev) => [e, ...prev]);
            setCreating(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <ExpenseFormModal
          isCreating={false}
          expense={editing}
          users={users}
          projects={projects}
          me={me}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            setItems((prev) => prev.map((x) => (x.id === e.id ? e : x)));
            setEditing(e);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StatusTab({
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

/* ──────── 기안/수정/결재 모달 ──────── */

function ExpenseFormModal({
  isCreating,
  expense,
  users,
  projects,
  me,
  onClose,
  onSaved,
}: {
  isCreating: boolean;
  expense?: Expense;
  users: User[];
  projects: Project[];
  me: { id: string; name: string; role: string } | null;
  onClose: () => void;
  onSaved: (e: Expense) => void;
}) {
  const [draft, setDraft] = useState<any>(
    expense ?? {
      title: "",
      category: "기타",
      amount: 0,
      requestDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "card",
      approvalRoute: "internal",
      taxInvoiceImageUrl: null,
      businessRegUrl: null,
      bankAccountUrl: null,
      quotationUrl: null,
    }
  );
  const [saving, setSaving] = useState(false);

  // 세금계산서 매칭 검색
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState<any>(null);

  // 프로젝트 변경 시 세금계산서 자동 검색
  async function searchInvoices(q: string) {
    if (!q || q.length < 2) {
      setInvoiceResults([]);
      return;
    }
    setInvoiceLoading(true);
    try {
      const r = await fetch(`/api/e-invoices?q=${encodeURIComponent(q)}&type=purchase`);
      const j = await r.json();
      setInvoiceResults(j.items?.slice(0, 8) ?? []);
    } finally {
      setInvoiceLoading(false);
    }
  }

  function set(k: string, v: any) {
    setDraft((d: any) => ({ ...d, [k]: v }));
  }

  async function save() {
    if (!draft.title) {
      alert("제목을 입력하세요.");
      return;
    }
    if (!draft.amount || Number(draft.amount) <= 0) {
      alert("금액을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const url = isCreating ? "/api/expenses" : `/api/expenses/${expense!.id}`;
      const method = isCreating ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("저장 실패: " + (json.error ?? "오류"));
      } else {
        onSaved(json);
      }
    } finally {
      setSaving(false);
    }
  }

  async function approve(action: "approve" | "reject") {
    let reason: string | null = null;
    if (action === "reject") {
      reason = prompt("반려 사유를 입력하세요.") ?? null;
      if (!reason) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${expense!.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (res.ok) onSaved(json);
      else alert("처리 실패");
    } finally {
      setSaving(false);
    }
  }

  const canApprove =
    !isCreating &&
    expense?.status === "pending" &&
    me &&
    (me.role === "admin" || me.role === "manager") &&
    me.id !== expense?.requester?.id;

  const approverOptions = users.filter((u) => u.role === "admin" || u.role === "manager");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            지출결의서 {isCreating ? "기안" : "상세"}
            {expense && (
              <>
                <span className="opacity-50">·</span>
                <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded font-mono">{expense.expenseNo}</span>
                <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", STATUS_META[expense.status]?.color)}>
                  {STATUS_META[expense.status]?.label}
                </span>
              </>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <Field label="제목" required>
            <input
              value={draft.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="예: 통번역 서비스 외주용역비"
              className="form-input"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="신청일자" required>
              <input
                type="date"
                value={(draft.requestDate ?? "").slice(0, 10)}
                onChange={(e) => set("requestDate", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="비목" required>
              <select value={draft.category ?? "기타"} onChange={(e) => set("category", e.target.value)} className="form-input">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="프로젝트 매칭">
            <select
              value={draft.projectId ?? ""}
              onChange={(e) => set("projectId", e.target.value || null)}
              className="form-input"
            >
              <option value="">— 미연결 —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.year} · {p.displayCode ?? ""} {p.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="세금계산서 매칭">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={invoiceSearch}
                  onChange={(e) => {
                    setInvoiceSearch(e.target.value);
                    searchInvoices(e.target.value);
                  }}
                  placeholder="공급자명, 품목명으로 매입 세금계산서 검색..."
                  className="form-input pl-8"
                />
                {invoiceLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
                )}
              </div>
              {invoiceResults.length > 0 && (
                <div className="border border-slate-200 rounded max-h-48 overflow-auto">
                  {invoiceResults.map((inv: any) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        set("taxInvoiceId", inv.id);
                        setMatchedInvoice(inv);
                        set("amount", Number(inv.totalAmount));
                        setInvoiceResults([]);
                        setInvoiceSearch("");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-800 truncate">{inv.supplierName}</span>
                        <span className="text-[11px] tabular-nums text-slate-700 shrink-0">
                          ₩{Number(inv.totalAmount).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 truncate">
                        {inv.writeDate?.slice(0, 10)} · {inv.itemName ?? ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {(matchedInvoice || draft.taxInvoiceId) && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] flex items-center justify-between">
                  <span className="text-emerald-800">
                    <FileText className="w-3 h-3 inline mr-1" />
                    매칭됨: <span className="font-medium">{matchedInvoice?.supplierName ?? "(기존 매칭)"}</span>
                  </span>
                  <button
                    onClick={() => {
                      set("taxInvoiceId", null);
                      setMatchedInvoice(null);
                    }}
                    className="text-emerald-600 hover:text-emerald-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="금액" required>
              <input
                type="text"
                inputMode="numeric"
                value={Number(draft.amount ?? 0).toLocaleString()}
                onChange={(e) => set("amount", Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
                className="form-input tabular-nums text-right"
              />
            </Field>
            <Field label="결제수단">
              <select
                value={draft.paymentMethod ?? "card"}
                onChange={(e) => set("paymentMethod", e.target.value)}
                className="form-input"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="결재자" required>
            <select
              value={draft.approverId ?? ""}
              onChange={(e) => set("approverId", e.target.value || null)}
              className="form-input"
            >
              <option value="">— 선택 —</option>
              {approverOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.position}) · {u.dept}
                </option>
              ))}
            </select>
          </Field>

          <Field label="상세 내용">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="form-input min-h-[80px] py-2 resize-none"
              placeholder="아래와 같이 사용 내역을 품의하오니 결재하여 주시기 바랍니다"
            />
          </Field>

          {/* 첨부 4종 (세금계산서/사업자등록증/통장사본/거래명세서) */}
          <Field label="첨부 서류 (이미지 또는 PDF)">
            <div className="grid grid-cols-2 gap-3 mt-1">
              <AttachmentInput
                label="세금계산서"
                value={draft.taxInvoiceImageUrl ?? null}
                onChange={(url) => set("taxInvoiceImageUrl" as any, url as any)}
              />
              <AttachmentInput
                label="사업자등록증"
                value={draft.businessRegUrl ?? null}
                onChange={(url) => set("businessRegUrl" as any, url as any)}
              />
              <AttachmentInput
                label="통장사본"
                value={draft.bankAccountUrl ?? null}
                onChange={(url) => set("bankAccountUrl" as any, url as any)}
              />
              <AttachmentInput
                label="거래명세서 (견적서)"
                value={draft.quotationUrl ?? null}
                onChange={(url) => set("quotationUrl" as any, url as any)}
              />
            </div>
          </Field>

          <Field label="결재 라인">
            <div className="flex gap-2">
              <label className={clsx("flex-1 h-9 px-3 border rounded flex items-center gap-1.5 cursor-pointer text-[12px]", (draft.approvalRoute ?? "internal") === "internal" ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200")}>
                <input type="radio" checked={(draft.approvalRoute ?? "internal") === "internal"} onChange={() => set("approvalRoute" as any, "internal" as any)} className="text-brand-600" />
                <span>내부 (3단계)</span>
              </label>
              <label className={clsx("flex-1 h-9 px-3 border rounded flex items-center gap-1.5 cursor-pointer text-[12px]", (draft.approvalRoute ?? "internal") === "external" ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200")}>
                <input type="radio" checked={draft.approvalRoute === "external"} onChange={() => set("approvalRoute" as any, "external" as any)} className="text-brand-600" />
                <span>외부 (2단계)</span>
              </label>
            </div>
          </Field>

          {expense?.rejectReason && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700">
              <strong>반려 사유:</strong> {expense.rejectReason}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            {(isCreating || expense?.status === "pending") && (
              <button
                onClick={save}
                disabled={saving}
                className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isCreating ? "기안 상신" : "저장"}
              </button>
            )}
            {canApprove && (
              <>
                <button
                  onClick={() => approve("approve")}
                  disabled={saving}
                  className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> 승인
                </button>
                <button
                  onClick={() => approve("reject")}
                  disabled={saving}
                  className="h-9 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> 반려
                </button>
              </>
            )}
          </div>
          <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
            닫기
          </button>
        </div>
      </div>

      <style jsx global>{`
        .form-input {
          height: 36px;
          width: 100%;
          padding: 0 10px;
          font-size: 12.5px;
          border: 1px solid rgb(226 232 240);
          border-radius: 6px;
          background: white;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.15s;
        }
        .form-input:focus {
          border-color: rgb(63 99 245);
          box-shadow: 0 0 0 3px rgba(63, 99, 245, 0.12);
        }
        select.form-input { padding-right: 24px; cursor: pointer; }
        textarea.form-input { height: auto; }
      `}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-600 mb-1.5 flex items-center gap-0.5">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─────────── 첨부 파일 입력 (이미지/PDF) ─────────── */

function AttachmentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        alert("업로드 실패");
        return;
      }
      const json = await res.json();
      onChange(json.url ?? json.path ?? null);
    } finally {
      setUploading(false);
    }
  }

  const isImage = value && /\.(png|jpe?g|gif|webp|bmp)$/i.test(value);
  return (
    <div className="border border-slate-200 rounded p-2">
      <div className="text-[11px] font-medium text-slate-700 mb-1.5 text-center bg-slate-100 -mx-2 -mt-2 px-2 py-1 rounded-t">
        {label}
      </div>
      {value ? (
        <div className="space-y-1">
          {isImage ? (
            <a href={value} target="_blank" rel="noopener" className="block">
              <img
                src={value}
                alt={label}
                className="w-full h-24 object-contain bg-slate-50 border border-slate-100 rounded"
              />
            </a>
          ) : (
            <a
              href={value}
              target="_blank"
              rel="noopener"
              className="block h-24 bg-slate-50 border border-slate-100 rounded flex items-center justify-center text-[11px] text-brand-600 hover:underline"
            >
              📎 파일 보기
            </a>
          )}
          <div className="flex gap-1">
            <label className="flex-1 h-7 px-2 text-[10.5px] bg-white hover:bg-slate-50 border border-slate-200 rounded cursor-pointer flex items-center justify-center text-slate-600">
              <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
              교체
            </label>
            <button
              onClick={() => onChange(null)}
              className="h-7 px-2 text-[10.5px] bg-rose-50 hover:bg-rose-100 text-rose-700 rounded"
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <label className="block h-24 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:border-brand-300 hover:bg-brand-50/50 flex items-center justify-center text-[11px] text-slate-400">
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "+ 파일 선택"}
        </label>
      )}
    </div>
  );
}

/* ─────────── 결재 유형 탭 ─────────── */
function TypeTab({
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

const LEAVE_LABEL: Record<string, string> = {
  annual: "연차",
  monthly: "월차",
  half_am: "오전반차",
  half_pm: "오후반차",
  public: "공가",
  sick: "병가",
  maternity: "출산휴가",
  summer: "하계휴가",
  family_event: "경조휴가",
  disaster: "재해휴가",
  health: "보건휴가",
  other: "기타",
};

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  expense: { label: "지출결의", color: "bg-blue-100 text-blue-800" },
  trip: { label: "출장", color: "bg-violet-100 text-violet-800" },
  leave: { label: "휴가", color: "bg-emerald-100 text-emerald-800" },
};

const APPROVAL_STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600",
};

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "결재대기",
    approved: "승인",
    rejected: "반려",
    cancelled: "취소",
    draft: "임시저장",
  };
  return map[s] ?? s;
}

/* ─────────── 통합 결재 목록 ─────────── */
function UnifiedApprovalList({
  expenses,
  trips,
  leaves,
  onClickExpense,
}: {
  expenses: Expense[];
  trips: TripRow[];
  leaves: LeaveRow[];
  onClickExpense: (e: Expense) => void;
}) {
  // 모두 합쳐서 createdAt 내림차순
  const rows: { kind: "expense" | "trip" | "leave"; date: string; row: any }[] = [
    ...expenses.map((e) => ({ kind: "expense" as const, date: e.createdAt, row: e })),
    ...trips.map((t) => ({ kind: "trip" as const, date: t.createdAt, row: t })),
    ...leaves.map((l) => ({ kind: "leave" as const, date: l.createdAt, row: l })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg py-16 text-center text-sm text-slate-400">
        결재 기안이 없습니다. 좌측 사이드바의 지출결의서 / 출장신청서 / 휴가신청서에서 작성하세요.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
            <th className="text-left px-3 py-2.5 w-20">유형</th>
            <th className="text-left px-3 py-2.5 w-24">신청일자</th>
            <th className="text-left px-3 py-2.5">제목/내용</th>
            <th className="text-left px-3 py-2.5 w-24">기안자</th>
            <th className="text-right px-3 py-2.5 w-28">금액/일수</th>
            <th className="text-left px-3 py-2.5 w-24">결재라인</th>
            <th className="text-left px-3 py-2.5 w-24">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ kind, row }) => {
            const meta = TYPE_BADGE[kind];
            if (kind === "expense") {
              const it = row as Expense;
              return (
                <tr key={`e-${it.id}`} onClick={() => onClickExpense(it)} className="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer">
                  <td className="px-3 py-2"><span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", meta.color)}>{meta.label}</span></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{it.requestDate.slice(0, 10)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 truncate">{it.title}</td>
                  <td className="px-3 py-2 text-slate-700">{it.requester?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">₩{Number(it.amount).toLocaleString()}</td>
                  <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.approvalRoute === "external" ? "외부" : "내부"}</td>
                  <td className="px-3 py-2">
                    <span className={clsx("text-[10.5px] px-2 py-0.5 rounded font-medium", APPROVAL_STATUS_COLOR[it.status] ?? "bg-slate-100")}>
                      {statusLabel(it.status)}
                    </span>
                  </td>
                </tr>
              );
            }
            if (kind === "trip") {
              const it = row as TripRow;
              return (
                <tr key={`t-${it.id}`} className="border-b border-slate-100 hover:bg-violet-50/30">
                  <td className="px-3 py-2"><span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", meta.color)}>{meta.label}</span></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{it.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2 truncate">
                    <span className="font-medium text-slate-800">{it.title}</span>
                    {it.destination && <span className="text-[10px] text-slate-500 ml-2">@{it.destination}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{it.user?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">₩{Number(it.totalCost).toLocaleString()}</td>
                  <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.approvalRoute === "external" ? "외부" : "내부"}</td>
                  <td className="px-3 py-2">
                    <span className={clsx("text-[10.5px] px-2 py-0.5 rounded font-medium", APPROVAL_STATUS_COLOR[it.status] ?? "bg-slate-100")}>
                      {statusLabel(it.status)}
                    </span>
                  </td>
                </tr>
              );
            }
            // leave
            const it = row as LeaveRow;
            return (
              <tr key={`l-${it.id}`} className="border-b border-slate-100 hover:bg-emerald-50/30">
                <td className="px-3 py-2"><span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", meta.color)}>{meta.label}</span></td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{it.createdAt.slice(0, 10)}</td>
                <td className="px-3 py-2 truncate">
                  <span className="font-medium text-slate-800">{LEAVE_LABEL[it.type] ?? it.type}</span>
                  <span className="text-[10.5px] text-slate-500 ml-2">
                    {it.startDate.slice(0, 10)}{it.endDate !== it.startDate && ` ~ ${it.endDate.slice(0, 10)}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{it.user?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{it.days}일</td>
                <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.approvalRoute === "external" ? "외부" : "내부"}</td>
                <td className="px-3 py-2">
                  <span className={clsx("text-[10.5px] px-2 py-0.5 rounded font-medium", APPROVAL_STATUS_COLOR[it.status] ?? "bg-slate-100")}>
                    {statusLabel(it.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── 출장신청서 목록 ─────────── */
function TripList({ items }: { items: TripRow[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg py-16 text-center text-sm text-slate-400">
        출장신청서가 없습니다. 사이드바 ▸ 전자결재 ▸ 출장신청서에서 작성하세요.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
            <th className="text-left px-3 py-2.5 w-24">신청일자</th>
            <th className="text-left px-3 py-2.5">제목</th>
            <th className="text-left px-3 py-2.5 w-28">출장지</th>
            <th className="text-left px-3 py-2.5 w-44">출장기간</th>
            <th className="text-left px-3 py-2.5 w-24">기안자</th>
            <th className="text-right px-3 py-2.5 w-28">예상비용</th>
            <th className="text-left px-3 py-2.5 w-24">상태</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b border-slate-100 hover:bg-violet-50/30">
              <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{t.createdAt.slice(0, 10)}</td>
              <td className="px-3 py-2 font-medium text-slate-800">{t.title}</td>
              <td className="px-3 py-2 text-slate-600">{t.destination ?? "—"}</td>
              <td className="px-3 py-2 text-[11px] text-slate-600 tabular-nums">
                {t.startDate?.slice(0, 10) ?? "—"}
                {t.endDate && t.endDate !== t.startDate && ` ~ ${t.endDate.slice(0, 10)}`}
              </td>
              <td className="px-3 py-2 text-slate-700">{t.user?.name ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">₩{Number(t.totalCost).toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={clsx("text-[10.5px] px-2 py-0.5 rounded font-medium", APPROVAL_STATUS_COLOR[t.status] ?? "bg-slate-100")}>
                  {statusLabel(t.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── 휴가신청서 목록 ─────────── */
function LeaveList({ items }: { items: LeaveRow[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg py-16 text-center text-sm text-slate-400">
        휴가신청서가 없습니다. 사이드바 ▸ 전자결재 ▸ 휴가신청서에서 작성하세요.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
            <th className="text-left px-3 py-2.5 w-24">신청일자</th>
            <th className="text-left px-3 py-2.5 w-20">종류</th>
            <th className="text-left px-3 py-2.5 w-44">기간</th>
            <th className="text-right px-3 py-2.5 w-16">일수</th>
            <th className="text-left px-3 py-2.5 w-24">기안자</th>
            <th className="text-left px-3 py-2.5">결재 진행</th>
            <th className="text-left px-3 py-2.5 w-24">상태</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 hover:bg-emerald-50/30">
              <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">{l.createdAt.slice(0, 10)}</td>
              <td className="px-3 py-2">
                <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800">
                  {LEAVE_LABEL[l.type] ?? l.type}
                </span>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-600 tabular-nums">
                {l.startDate.slice(0, 10)}
                {l.endDate !== l.startDate && ` ~ ${l.endDate.slice(0, 10)}`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{l.days}</td>
              <td className="px-3 py-2 text-slate-700">{l.user?.name ?? "—"}</td>
              <td className="px-3 py-2 text-[10.5px] text-slate-600">
                {l.approvals.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 mr-1.5">
                    <span className={clsx("w-1.5 h-1.5 rounded-full", a.status === "approved" ? "bg-emerald-500" : a.status === "rejected" ? "bg-rose-500" : a.status === "auto_passed" ? "bg-slate-400" : "bg-amber-500")} />
                    <span className="text-slate-600">{a.approver?.name}</span>
                  </span>
                ))}
              </td>
              <td className="px-3 py-2">
                <span className={clsx("text-[10.5px] px-2 py-0.5 rounded font-medium", APPROVAL_STATUS_COLOR[l.status] ?? "bg-slate-100")}>
                  {statusLabel(l.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
