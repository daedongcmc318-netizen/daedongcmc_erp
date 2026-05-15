"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Building2,
  Link as LinkIcon,
  AlertTriangle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import clsx from "clsx";
import { BIZ_CATEGORY, getBizMeta } from "@/lib/enums";

type Company = { id: string; name: string; type: string };
type Project = { id: string; title: string; displayCode: string | null; year: number; companyId: string | null };

type Expense = {
  id: string;
  budgetId: string;
  seq: number;
  vendorCompanyId: string | null;
  vendorName: string;
  taxInvoiceDate: string | null;
  amount: string;
  runningBalance: string | null;
  contractDone: boolean;
  paymentDate: string | null;
  settlementDone: boolean;
  filed: boolean;
  notes: string | null;
  vendorCompany: { id: string; name: string } | null;
};

type Budget = {
  id: string;
  year: number;
  seq: number;
  bizCategory: string | null;
  rawCode: string | null;
  clientCompanyId: string | null;
  clientName: string;
  projectId: string | null;
  subsidy: string;
  companyShare: string;
  totalAmount: string;
  mgmtFeeAmount: string;
  mgmtFeeRate: number | null;
  payableTotal: string;
  overBudget: string;
  notes: string | null;
  clientCompany: { id: string; name: string; repName: string | null } | null;
  project: { id: string; title: string; displayCode: string | null; year: number } | null;
  expenses: Expense[];
};

function fmtKRW(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  return `₩${n.toLocaleString()}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

function fmtPercent(r: number | null): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

export default function MgmtFeesClient({
  initialBudgets,
  companies,
  projects,
  years,
  currentYear,
}: {
  initialBudgets: Budget[];
  companies: Company[];
  projects: Project[];
  years: number[];
  currentYear: number | null; // null = 전체보기
}) {
  const isAll = currentYear == null;
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterBiz, setFilterBiz] = useState<string>("");

  const filtered = useMemo(() => {
    return budgets.filter((b) => {
      if (filterBiz) {
        if (filterBiz === "_none") {
          if (b.bizCategory) return false;
        } else if (b.bizCategory !== filterBiz) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          b.clientName,
          b.clientCompany?.name,
          b.project?.title,
          b.notes,
          ...b.expenses.map((e) => e.vendorName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [budgets, search, filterBiz]);

  const bizCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of budgets) {
      const k = b.bizCategory ?? "_none";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [budgets]);

  const totals = useMemo(() => {
    let mgmt = 0;
    let spent = 0;
    for (const b of filtered) {
      mgmt += Number(b.mgmtFeeAmount ?? 0);
      for (const e of b.expenses) spent += Number(e.amount ?? 0);
    }
    return { mgmt, spent, balance: mgmt - spent };
  }, [filtered]);

  async function createBudget() {
    const clientName = prompt("새 사업의 업체명을 입력하세요 (예: 제이오토26)");
    if (!clientName) return;
    // 전체보기 모드에서는 올해 기준으로 생성
    const targetYear = currentYear ?? new Date().getFullYear();
    const res = await fetch("/api/mgmt-fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: targetYear, clientName }),
    });
    if (!res.ok) {
      alert("생성 실패");
      return;
    }
    const created = await res.json();
    setBudgets((prev) => [...prev, created]);
    setOpenId(created.id);
    router.refresh();
  }

  async function updateBudget(id: string, patch: Record<string, any>) {
    // optimistic
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const res = await fetch(`/api/mgmt-fees/${id}`, {
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
    setBudgets((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }

  async function deleteBudget(id: string) {
    if (!confirm("이 사업과 모든 지출 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/mgmt-fees/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  async function addExpense(budgetId: string) {
    const vendorName = prompt("지불업체명을 입력하세요");
    if (!vendorName) return;
    const res = await fetch("/api/mgmt-fee-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetId, vendorName, amount: 0 }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setBudgets((prev) =>
      prev.map((b) => (b.id === budgetId ? { ...b, expenses: [...b.expenses, created] } : b))
    );
  }

  async function updateExpense(id: string, budgetId: string, patch: Record<string, any>) {
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId
          ? { ...b, expenses: b.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
          : b
      )
    );
    const res = await fetch(`/api/mgmt-fee-expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("지출 수정 실패");
      router.refresh();
      return;
    }
    const updated = await res.json();
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId
          ? { ...b, expenses: b.expenses.map((e) => (e.id === id ? updated : e)) }
          : b
      )
    );
  }

  async function deleteExpense(id: string, budgetId: string) {
    if (!confirm("이 지출 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/mgmt-fee-expenses/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId ? { ...b, expenses: b.expenses.filter((e) => e.id !== id) } : b
      )
    );
  }

  return (
    <div className="px-8 py-7 max-w-[1600px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">업체/거래처 ▸</span>
            <span className="text-xs font-semibold text-brand-700">업체별 관리비</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium">
              관리자 전용
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{currentYear}년 업체별 관리비</h1>
          <p className="text-sm text-slate-500 mt-1">
            총 사업 <span className="font-semibold text-slate-700">{filtered.length}건</span> · 관리비 합계{" "}
            <span className="font-semibold text-slate-700">{fmtKRW(totals.mgmt)}</span> · 집행{" "}
            <span className="font-semibold text-rose-600">{fmtKRW(totals.spent)}</span> · 잔액{" "}
            <span className={clsx("font-semibold", totals.balance < 0 ? "text-rose-600" : "text-emerald-600")}>
              {fmtKRW(totals.balance)}
            </span>
          </p>
        </div>
        <button
          onClick={createBudget}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 신규 사업
        </button>
      </div>

      {/* 연도 + 검색 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => router.push(`/mgmt-fees`)}
          className={clsx(
            "min-w-[80px] px-3 h-8 text-xs font-semibold rounded-lg border transition",
            isAll
              ? "bg-slate-800 text-white border-slate-800 shadow-md"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
          )}
        >
          전체보기
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => router.push(`/mgmt-fees?year=${y}`)}
            className={clsx(
              "min-w-[60px] px-3 h-8 text-xs font-semibold rounded-lg border transition tabular-nums",
              currentYear === y
                ? "bg-brand-600 text-white border-brand-600 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-700"
            )}
          >
            {y}년
          </button>
        ))}
        {currentYear != null && !years.includes(currentYear) && (
          <span className="text-[11px] text-slate-400 ml-2">※ {currentYear}년 데이터 없음</span>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="업체/지불처/메모 검색..."
          className="ml-auto h-8 px-3 text-xs bg-white border border-slate-200 rounded focus:border-brand-300 focus:ring-2 focus:ring-brand-200 outline-none w-64"
        />
      </div>

      {/* 사업영역 필터 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setFilterBiz("")}
          className={clsx(
            "px-2.5 h-7 text-[11px] font-medium rounded-full border transition",
            !filterBiz
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          )}
        >
          전체 <span className="ml-1 tabular-nums opacity-70">{budgets.length}</span>
        </button>
        {BIZ_CATEGORY.filter((b) => bizCounts[b.value]).map((b) => {
          const active = filterBiz === b.value;
          return (
            <button
              key={b.value}
              onClick={() => setFilterBiz(b.value)}
              className={clsx(
                "px-2.5 h-7 text-[11px] font-medium rounded-full border transition flex items-center gap-1",
                active ? "ring-2 ring-offset-1 ring-brand-300" : "",
                b.color
              )}
            >
              {b.label}
              <span className="tabular-nums opacity-70">{bizCounts[b.value]}</span>
            </button>
          );
        })}
        {bizCounts["_none"] > 0 && (
          <button
            onClick={() => setFilterBiz("_none")}
            className={clsx(
              "px-2.5 h-7 text-[11px] font-medium rounded-full border transition",
              filterBiz === "_none"
                ? "bg-amber-100 text-amber-800 border-amber-200 ring-2 ring-offset-1 ring-amber-300"
                : "bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300"
            )}
          >
            미분류 <span className="ml-1 tabular-nums opacity-70">{bizCounts["_none"]}</span>
          </button>
        )}
      </div>

      {/* 사업 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg py-12 text-center text-sm text-slate-400">
            {currentYear}년 사업이 없습니다. <button onClick={createBudget} className="text-brand-600 hover:underline">신규 사업 추가</button>
          </div>
        ) : (
          filtered.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              companies={companies}
              projects={projects}
              isOpen={openId === b.id}
              onToggle={() => setOpenId(openId === b.id ? null : b.id)}
              onUpdate={(patch) => updateBudget(b.id, patch)}
              onDelete={() => deleteBudget(b.id)}
              onAddExpense={() => addExpense(b.id)}
              onUpdateExpense={(eid, patch) => updateExpense(eid, b.id, patch)}
              onDeleteExpense={(eid) => deleteExpense(eid, b.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BudgetCard({
  budget: b,
  companies,
  projects,
  isOpen,
  onToggle,
  onUpdate,
  onDelete,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: {
  budget: Budget;
  companies: Company[];
  projects: Project[];
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (patch: any) => void;
  onDelete: () => void;
  onAddExpense: () => void;
  onUpdateExpense: (id: string, patch: any) => void;
  onDeleteExpense: (id: string) => void;
}) {
  const totalSpent = b.expenses.reduce((acc, e) => acc + Number(e.amount ?? 0), 0);
  const mgmtFee = Number(b.mgmtFeeAmount ?? 0);
  const remaining = mgmtFee - totalSpent;
  const projectOptions = projects.filter((p) => !b.clientCompanyId || p.companyId === b.clientCompanyId);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3"
      >
        <div className="text-slate-400">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
        <span className="font-mono text-[11px] text-slate-500 tabular-nums w-10">#{String(b.seq).padStart(3, "0")}</span>
        {b.bizCategory ? (
          <span
            className={clsx(
              "text-[10px] px-2 py-0.5 rounded ring-1 font-medium whitespace-nowrap shrink-0",
              getBizMeta(b.bizCategory).color
            )}
          >
            {getBizMeta(b.bizCategory).label}
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-amber-200 font-medium shrink-0">
            미분류
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {b.clientName}
            </span>
            {b.clientCompany ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium" title={b.clientCompany.name}>
                <LinkIcon className="w-3 h-3 inline mr-0.5" />
                {b.clientCompany.name}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500" title="거래처 미매칭">
                <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                미매칭
              </span>
            )}
            {b.project && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium" title={b.project.title}>
                📋 {b.project.displayCode ?? b.project.title.slice(0, 12)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>관리비 <strong className="text-slate-700">{fmtKRW(b.mgmtFeeAmount)}</strong></span>
            <span>·</span>
            <span>집행 <strong className="text-rose-600">{fmtKRW(totalSpent)}</strong></span>
            <span>·</span>
            <span>
              잔액{" "}
              <strong className={clsx(remaining < 0 ? "text-rose-600" : "text-emerald-600")}>
                {fmtKRW(remaining)}
              </strong>
            </span>
            <span>·</span>
            <span>{b.expenses.length}건</span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/30">
          {/* 매칭 정보 */}
          <div className="px-4 pt-4 pb-2">
            <SectionTitle>매칭 정보</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <BizCategorySelect
                value={b.bizCategory}
                onChange={(v) => onUpdate({ bizCategory: v })}
              />
              <FieldRow label="업체명 (시트)" value={b.clientName} onSave={(v) => onUpdate({ clientName: v })} />
              <CompanyPicker
                label="거래처 매칭"
                value={b.clientCompanyId}
                displayName={b.clientCompany?.name ?? null}
                companies={companies}
                onChange={(id) => onUpdate({ clientCompanyId: id })}
              />
              <ProjectPicker
                label="연결 프로젝트"
                value={b.projectId}
                displayName={b.project?.title ?? null}
                projects={projectOptions}
                onChange={(id) => onUpdate({ projectId: id })}
              />
            </div>
          </div>

          {/* 예산 패널 — 카드 3장 (과제 총예산 / 관리비 / 지출 현황) */}
          <div className="px-4 py-3">
            <SectionTitle>예산 구성</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 카드 1: 과제 총예산 (정부보조금 + 기업분담금) */}
              <BudgetSummaryCard
                title="과제 총예산"
                tone="indigo"
                main={{ label: "과제총액", value: b.totalAmount, onSave: (v) => onUpdate({ totalAmount: v }) }}
                breakdown={[
                  {
                    label: "정부보조금",
                    value: b.subsidy,
                    onSave: (v) => onUpdate({ subsidy: v }),
                    barColor: "bg-sky-500",
                  },
                  {
                    label: "기업분담금",
                    value: b.companyShare,
                    onSave: (v) => onUpdate({ companyShare: v }),
                    barColor: "bg-violet-500",
                  },
                ]}
                totalRef={Number(b.totalAmount) || 0}
              />

              {/* 카드 2: 관리비 (예산) — 강조 */}
              <BudgetSummaryCard
                title="관리비 (예산)"
                tone="brand"
                highlight
                main={{
                  label: "관리비 예산",
                  value: b.mgmtFeeAmount,
                  onSave: (v) => onUpdate({ mgmtFeeAmount: v }),
                }}
                meta={[
                  { label: "관리비율", value: fmtPercent(b.mgmtFeeRate) },
                ]}
              />

              {/* 카드 3: 지출/잔액 */}
              <BudgetSummaryCard
                title="지출 현황"
                tone="emerald"
                main={{
                  label: "지급총액",
                  value: b.payableTotal,
                  onSave: (v) => onUpdate({ payableTotal: v }),
                }}
                progressOf={{
                  used: Number(b.payableTotal) || 0,
                  total: Number(b.mgmtFeeAmount) || 0,
                }}
                meta={[
                  {
                    label: "예산초과금",
                    value: Number(b.overBudget) > 0 ? fmtKRW(b.overBudget) : "—",
                    danger: Number(b.overBudget) > 0,
                  },
                  {
                    label: "잔액",
                    value:
                      (() => {
                        const rem = (Number(b.mgmtFeeAmount) || 0) - (Number(b.payableTotal) || 0);
                        return rem === 0 ? "—" : fmtKRW(rem);
                      })(),
                    danger: (Number(b.mgmtFeeAmount) || 0) - (Number(b.payableTotal) || 0) < 0,
                    accent: (Number(b.mgmtFeeAmount) || 0) - (Number(b.payableTotal) || 0) > 0,
                  },
                ]}
                editableMeta={{
                  label: "예산초과금 (수동)",
                  value: b.overBudget,
                  onSave: (v) => onUpdate({ overBudget: v }),
                }}
              />
            </div>

            {/* 비고 */}
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">비고</div>
              <EditableText
                value={b.notes ?? ""}
                onSave={(v) => onUpdate({ notes: v })}
                placeholder="메모를 입력하세요 (예: 정산 일정, 특이사항)"
              />
            </div>
          </div>

          {/* 지출 표 */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-slate-700">지출 내역 ({b.expenses.length}건)</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onAddExpense}
                  className="text-[11px] px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> 지출 추가
                </button>
                <button
                  onClick={onDelete}
                  className="text-[11px] px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 사업 삭제
                </button>
              </div>
            </div>
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-[11.5px] table-fixed">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5 border-b border-r border-slate-200 w-8">#</th>
                    <th className="text-left px-2 py-1.5 border-b border-r border-slate-200 w-44">지불업체</th>
                    <th className="text-left px-2 py-1.5 border-b border-r border-slate-200 w-28">계산서일</th>
                    <th className="text-right px-2 py-1.5 border-b border-r border-slate-200 w-28">지급액</th>
                    <th className="text-center px-2 py-1.5 border-b border-r border-slate-200 w-12">계약</th>
                    <th className="text-center px-2 py-1.5 border-b border-r border-slate-200 w-28">입금완료</th>
                    <th className="text-center px-2 py-1.5 border-b border-r border-slate-200 w-12">정산</th>
                    <th className="text-center px-2 py-1.5 border-b border-r border-slate-200 w-12">보관</th>
                    <th className="text-left px-2 py-1.5 border-b border-r border-slate-200">비고</th>
                    <th className="px-2 py-1.5 border-b border-slate-200 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {b.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-slate-400">
                        지출 내역이 없습니다
                      </td>
                    </tr>
                  ) : (
                    b.expenses.map((e) => (
                      <ExpenseRow
                        key={e.id}
                        expense={e}
                        companies={companies}
                        onUpdate={(patch) => onUpdateExpense(e.id, patch)}
                        onDelete={() => onDeleteExpense(e.id)}
                      />
                    ))
                  )}
                </tbody>
                {b.expenses.length > 0 && (
                  <tfoot className="bg-slate-50/70">
                    <tr>
                      <td colSpan={3} className="text-right px-2 py-1.5 border-t border-slate-200 font-semibold text-slate-700">
                        합계
                      </td>
                      <td className="text-right px-2 py-1.5 border-t border-slate-200 font-semibold text-rose-600 tabular-nums">
                        {fmtKRW(totalSpent)}
                      </td>
                      <td colSpan={6} className="border-t border-slate-200"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseRow({
  expense: e,
  companies,
  onUpdate,
  onDelete,
}: {
  expense: Expense;
  companies: Company[];
  onUpdate: (patch: any) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-2 py-1 border-b border-r border-slate-100 font-mono text-[10.5px] text-slate-400 tabular-nums">
        {e.seq}
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100">
        <VendorPicker
          value={e.vendorCompanyId}
          name={e.vendorName}
          companies={companies}
          onChange={(id, name) => onUpdate({ vendorCompanyId: id, vendorName: name })}
        />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100">
        <EditableDate value={e.taxInvoiceDate} onSave={(v) => onUpdate({ taxInvoiceDate: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100 text-right">
        <EditableMoney value={e.amount} onSave={(v) => onUpdate({ amount: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100 text-center">
        <CheckBox value={e.contractDone} onChange={(v) => onUpdate({ contractDone: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100">
        <EditableDate value={e.paymentDate} onSave={(v) => onUpdate({ paymentDate: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100 text-center">
        <CheckBox value={e.settlementDone} onChange={(v) => onUpdate({ settlementDone: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100 text-center">
        <CheckBox value={e.filed} onChange={(v) => onUpdate({ filed: v })} />
      </td>
      <td className="px-2 py-1 border-b border-r border-slate-100">
        <EditableText value={e.notes ?? ""} onSave={(v) => onUpdate({ notes: v })} placeholder="—" />
      </td>
      <td className="px-2 py-1 border-b border-slate-100 text-center">
        <button onClick={onDelete} className="text-slate-300 hover:text-rose-500" title="지출 삭제">
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

/* ──────── 인라인 편집 부품 ──────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
      {children}
    </div>
  );
}

function BudgetSummaryCard({
  title,
  tone,
  highlight,
  main,
  breakdown,
  totalRef,
  progressOf,
  meta,
  editableMeta,
}: {
  title: string;
  tone: "indigo" | "brand" | "emerald";
  highlight?: boolean;
  main: { label: string; value: string; onSave?: (v: number) => void };
  breakdown?: { label: string; value: string; onSave: (v: number) => void; barColor: string }[];
  totalRef?: number;
  progressOf?: { used: number; total: number };
  meta?: { label: string; value: string; danger?: boolean; accent?: boolean }[];
  editableMeta?: { label: string; value: string; onSave: (v: number) => void };
}) {
  const palette = {
    indigo: { ring: "ring-indigo-100", title: "text-indigo-700", num: "text-indigo-900" },
    brand: { ring: "ring-brand-200", title: "text-brand-700", num: "text-brand-700" },
    emerald: { ring: "ring-emerald-100", title: "text-emerald-700", num: "text-emerald-900" },
  }[tone];

  const usedPct =
    progressOf && progressOf.total > 0
      ? Math.min(150, (progressOf.used / progressOf.total) * 100)
      : 0;
  const isOver = progressOf && progressOf.used > progressOf.total && progressOf.total > 0;

  return (
    <div
      className={clsx(
        "bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2.5 ring-1",
        palette.ring,
        highlight && "shadow-sm"
      )}
    >
      <div className={clsx("text-[10.5px] font-semibold uppercase tracking-wider", palette.title)}>
        {title}
      </div>
      {/* 메인 금액 */}
      <div>
        <div className="text-[10px] text-slate-400 mb-0.5">{main.label}</div>
        {main.onSave ? (
          <EditableMoney
            value={main.value}
            onSave={main.onSave}
            highlight={highlight}
            big
          />
        ) : (
          <div className={clsx("text-xl font-bold tabular-nums", palette.num)}>
            {fmtKRW(main.value)}
          </div>
        )}
      </div>

      {/* breakdown: stacked bar + 항목별 */}
      {breakdown && totalRef !== undefined && (
        <div className="space-y-1.5">
          <div className="h-2 flex rounded-full overflow-hidden bg-slate-100">
            {breakdown.map((b, i) => {
              const v = Number(b.value) || 0;
              const pct = totalRef > 0 ? (v / totalRef) * 100 : 0;
              return <div key={i} className={b.barColor} style={{ width: `${pct}%` }} title={`${b.label}: ${fmtKRW(b.value)}`} />;
            })}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className={clsx("w-1.5 h-1.5 rounded-sm", b.barColor)} />
                  {b.label}
                </span>
                <EditableMoney value={b.value} onSave={b.onSave} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* progress bar (지출 / 예산) */}
      {progressOf && (
        <div className="space-y-1">
          <div className={clsx("h-2 rounded-full overflow-hidden", isOver ? "bg-rose-100" : "bg-slate-100")}>
            <div
              className={clsx("h-full transition-all", isOver ? "bg-rose-500" : "bg-emerald-500")}
              style={{ width: `${Math.min(100, usedPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
            <span>예산 대비</span>
            <span className={clsx(isOver && "text-rose-600 font-semibold")}>
              {progressOf.total > 0 ? `${usedPct.toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>
      )}

      {/* meta 키/값 */}
      {meta && meta.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          {meta.map((m, i) => (
            <div key={i}>
              <div className="text-[10px] text-slate-400 mb-0.5">{m.label}</div>
              <div
                className={clsx(
                  "text-[12.5px] font-semibold tabular-nums",
                  m.danger && "text-rose-600",
                  m.accent && "text-emerald-700",
                  !m.danger && !m.accent && "text-slate-700"
                )}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 편집 가능 meta (예산초과금 수동) */}
      {editableMeta && (
        <details className="text-[10.5px]">
          <summary className="text-slate-400 cursor-pointer hover:text-slate-600 select-none">
            {editableMeta.label} 직접 수정
          </summary>
          <div className="mt-1">
            <EditableMoney value={editableMeta.value} onSave={editableMeta.onSave} />
          </div>
        </details>
      )}
    </div>
  );
}

function FieldRow({
  label,
  value,
  onSave,
  readOnly,
  colSpan,
}: {
  label: string;
  value: string;
  onSave?: (v: string) => void;
  readOnly?: boolean;
  colSpan?: number;
}) {
  return (
    <div className={clsx(colSpan === 2 ? "col-span-2" : "")}>
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      {readOnly ? (
        <div className="text-[12px] text-slate-700">{value || "—"}</div>
      ) : (
        <EditableText value={value} onSave={onSave!} placeholder="—" />
      )}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  onSave,
  highlight,
}: {
  label: string;
  value: string;
  onSave: (v: number) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className={clsx("text-[10px] mb-0.5", highlight ? "text-brand-600 font-semibold" : "text-slate-400")}>
        {label}
      </div>
      <EditableMoney value={value} onSave={onSave} highlight={highlight} />
    </div>
  );
}

function EditableText({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="cursor-text min-h-[20px] text-[12px] text-slate-700 truncate"
      >
        {value || <span className="text-slate-300">{placeholder ?? "—"}</span>}
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
      className="w-full h-6 px-1.5 text-[12px] border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white"
    />
  );
}

function EditableMoney({
  value,
  onSave,
  highlight,
  big,
}: {
  value: string;
  onSave: (v: number) => void;
  highlight?: boolean;
  big?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? "0"));
  const n = Number(value ?? 0);
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(String(value ?? "0"));
          setEditing(true);
        }}
        className={clsx(
          "cursor-text min-h-[20px] tabular-nums",
          big ? "text-xl font-bold text-left" : "text-right text-[12px]",
          highlight ? "text-brand-700 font-bold" : !big && "text-slate-700"
        )}
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
      className="w-full h-6 px-1.5 text-[12px] text-right border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white tabular-nums"
    />
  );
}

function EditableDate({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const display = value ? value.slice(0, 10) : "";
  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer min-h-[20px] text-[11px] text-slate-600 text-center"
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

function CheckBox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        "inline-flex w-4 h-4 items-center justify-center rounded transition",
        value ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200 text-transparent"
      )}
    >
      <Check className="w-2.5 h-2.5" />
    </button>
  );
}

/* ──────── 거래처/프로젝트 픽커 ──────── */

function CompanyPicker({
  label,
  value,
  displayName,
  companies,
  onChange,
}: {
  label: string;
  value: string | null;
  displayName: string | null;
  companies: Company[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? companies.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 20) : companies.slice(0, 20);
  return (
    <div className="relative">
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-full text-left h-7 px-2 text-[12px] border rounded flex items-center justify-between",
          value ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"
        )}
      >
        <span className="truncate">{displayName ?? <span className="text-slate-400">미매칭</span>}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg max-h-72 overflow-auto p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="거래처 검색..."
              className="w-full mb-2 h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 rounded"
            >
              <X className="w-3 h-3 inline mr-1" /> 매칭 해제
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-2 py-1 text-[12px] hover:bg-brand-50 rounded flex items-center justify-between",
                  c.id === value && "bg-brand-50 text-brand-700"
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-slate-400 ml-1">{c.type}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-[11px] text-slate-400 px-2 py-2">결과 없음</div>}
          </div>
        </>
      )}
    </div>
  );
}

function VendorPicker({
  value,
  name,
  companies,
  onChange,
}: {
  value: string | null;
  name: string;
  companies: Company[];
  onChange: (id: string | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q
    ? companies.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30)
    : companies.slice(0, 30);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-full text-left text-[12px] truncate min-h-[20px] flex items-center gap-1",
          value ? "text-emerald-700" : "text-slate-700"
        )}
        title={name}
      >
        {value && <LinkIcon className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
        <span className="truncate">{name}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-40 w-72 bg-white border border-slate-200 rounded shadow-lg max-h-72 overflow-auto p-2">
            <input
              autoFocus
              value={q || name}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // 텍스트만 변경 (매칭 없이)
                  onChange(value, q || name);
                  setOpen(false);
                }
              }}
              placeholder="지불업체 검색 / 이름 수정..."
              className="w-full mb-2 h-7 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
            <button
              onClick={() => {
                onChange(null, q || name);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 rounded"
            >
              <X className="w-3 h-3 inline mr-1" /> 매칭 해제 / 텍스트만 저장
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id, c.name);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-2 py-1 text-[12px] hover:bg-brand-50 rounded flex items-center justify-between",
                  c.id === value && "bg-brand-50 text-brand-700"
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-slate-400 ml-1">{c.type}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-[11px] text-slate-400 px-2 py-2">결과 없음</div>}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectPicker({
  label,
  value,
  displayName,
  projects,
  onChange,
}: {
  label: string;
  value: string | null;
  displayName: string | null;
  projects: Project[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-full text-left h-7 px-2 text-[12px] border rounded flex items-center justify-between",
          value ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-500"
        )}
      >
        <span className="truncate">{displayName ?? <span className="text-slate-400">미연결</span>}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg max-h-72 overflow-auto p-2">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 rounded"
            >
              <X className="w-3 h-3 inline mr-1" /> 연결 해제
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-2 py-1 text-[12px] hover:bg-brand-50 rounded flex items-center gap-1",
                  p.id === value && "bg-brand-50 text-brand-700"
                )}
              >
                {p.displayCode && (
                  <span className="font-mono text-[10px] text-slate-400 w-10 shrink-0">{p.displayCode}</span>
                )}
                <span className="truncate">{p.title}</span>
              </button>
            ))}
            {projects.length === 0 && <div className="text-[11px] text-slate-400 px-2 py-2">{`해당 거래처 ${''}프로젝트 없음`}</div>}
          </div>
        </>
      )}
    </div>
  );
}

function BizCategorySelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? getBizMeta(value) : null;
  return (
    <div className="relative">
      <div className="text-[10px] text-slate-400 mb-0.5">사업영역</div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-full text-left h-7 px-2 text-[12px] border rounded flex items-center justify-between",
          current
            ? "border-slate-200 bg-white text-slate-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        )}
      >
        {current ? (
          <span className={clsx("px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium", current.color)}>
            {current.label}
          </span>
        ) : (
          <span>미분류</span>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400 ml-1 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-48 bg-white border border-slate-200 rounded shadow-lg p-1">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 rounded"
            >
              미분류 (해제)
            </button>
            {BIZ_CATEGORY.map((b) => (
              <button
                key={b.value}
                onClick={() => {
                  onChange(b.value);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-2 py-1 text-[12px] hover:bg-slate-50 rounded flex items-center",
                  b.value === value && "bg-slate-50"
                )}
              >
                <span className={clsx("px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium", b.color)}>
                  {b.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
