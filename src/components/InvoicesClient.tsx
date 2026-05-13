"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Search, Trash2, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, X, Loader2 } from "lucide-react";
import clsx from "clsx";

type Invoice = {
  id: string;
  type: "sales" | "purchase";
  approvalNo: string;
  writeDate: string;
  issueDate: string | null;
  supplierBizNo: string;
  supplierName: string;
  buyerBizNo: string;
  buyerName: string;
  totalAmount: string;
  supplyAmount: string;
  taxAmount: string;
  itemName: string | null;
  category: string | null;
  paymentType: string | null;
  note: string | null;
  sourceFile: string | null;
};

type Summary = { count: number; totalAmount: string; supplyAmount: string; taxAmount: string };

const OUR_BIZ = "8298801029";

function fmtBizNo(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/[^\d]/g, "");
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function fmtAmount(raw: string | null | undefined): string {
  if (!raw) return "0";
  return Number(raw).toLocaleString();
}

export default function InvoicesClient({
  initialItems,
  initialSummary,
  totalsByType,
  currentType,
  currentYear,
  years,
}: {
  initialItems: Invoice[];
  initialSummary: Summary;
  totalsByType: { type: string; count: number; totalAmount: string; supplyAmount: string; taxAmount: string }[];
  currentType: "sales" | "purchase";
  currentYear: string;
  years: number[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Invoice[]>(initialItems);
  const [summary, setSummary] = useState<Summary>(initialSummary);

  // 라우트 변경(연도/탭 전환) 시 server props가 갱신되면 state 동기화
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<"partner" | "item" | "amount">("partner");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const salesAgg = totalsByType.find((t) => t.type === "sales");
  const purchaseAgg = totalsByType.find((t) => t.type === "purchase");

  function navigate(type: string, year: string) {
    const q = new URLSearchParams();
    q.set("type", type);
    if (year) q.set("year", year);
    router.push(`/invoices?${q.toString()}`);
  }

  // 클라이언트측 추가 검색 (이미 서버에서 type/year로 필터됨)
  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((it) => {
      if (searchField === "amount") {
        // 숫자 파싱 + 비교 연산자 지원: "1000000", ">=1000000", ">1000000", "<1000000", "1000000-5000000"
        const raw = search.trim();
        const range = raw.match(/^(\d[\d,]*)\s*[-~]\s*(\d[\d,]*)$/);
        if (range) {
          const lo = Number(range[1].replace(/,/g, ""));
          const hi = Number(range[2].replace(/,/g, ""));
          const amt = Number(it.supplyAmount);
          return amt >= lo && amt <= hi;
        }
        const cmp = raw.match(/^(>=|<=|>|<)\s*(\d[\d,]*)$/);
        if (cmp) {
          const n = Number(cmp[2].replace(/,/g, ""));
          const amt = Number(it.supplyAmount);
          switch (cmp[1]) {
            case ">=": return amt >= n;
            case "<=": return amt <= n;
            case ">": return amt > n;
            case "<": return amt < n;
          }
        }
        const n = Number(raw.replace(/[^\d]/g, ""));
        if (!n) return true;
        // 단일 숫자 입력 → "n원 이상"으로 처리
        return Number(it.supplyAmount) >= n;
      }
      const q = search.toLowerCase();
      if (searchField === "partner") {
        // 우리(대동)가 아닌 쪽 = 거래처
        const partner = it.type === "sales" ? it.buyerName : it.supplierName;
        const partnerBiz = it.type === "sales" ? it.buyerBizNo : it.supplierBizNo;
        const qDigits = q.replace(/[^\d]/g, "");
        return (
          partner.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && partnerBiz.includes(qDigits))
        );
      }
      if (searchField === "item") {
        return (it.itemName ?? "").toLowerCase().includes(q);
      }
      return false;
    });
  }, [items, search, searchField]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch("/api/e-invoices", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadMsg(`업로드 실패: ${json.error ?? "알 수 없는 오류"}`);
      } else {
        setUploadMsg(
          `${files.length}개 파일 처리 · 파싱 ${json.parsed}건 / 적재 ${json.upserted}건${
            json.skipped ? ` / 스킵 ${json.skipped}건` : ""
          }${json.errors?.length ? ` · 오류 ${json.errors.length}건` : ""}`
        );
        router.refresh();
      }
    } catch (e: any) {
      setUploadMsg(`업로드 실패: ${e.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 세금계산서 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/e-invoices/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">세금계산서</h1>
          <p className="text-xs text-slate-500 mt-1">홈택스 전자세금계산서 목록조회 파일을 업로드해서 통합 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xls,.xlsx"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-9 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "업로드 중..." : "엑셀 업로드"}
          </button>
        </div>
      </div>

      {uploadMsg && (
        <div className="mb-3 text-xs px-3 py-2 rounded bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-between">
          <span>{uploadMsg}</span>
          <button onClick={() => setUploadMsg(null)} className="hover:text-brand-900">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 연도 버튼 */}
      <div className="mb-4 flex items-center gap-1.5 flex-wrap">
        <YearBtn active={!currentYear} onClick={() => navigate(currentType, "")}>
          전체
        </YearBtn>
        {years.map((y) => (
          <YearBtn key={y} active={currentYear === String(y)} onClick={() => navigate(currentType, String(y))}>
            {y}
          </YearBtn>
        ))}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <SummaryCard
          title="매출 (sales)"
          icon={<ArrowUpRight className="w-4 h-4" />}
          color="emerald"
          count={salesAgg?.count ?? 0}
          total={salesAgg?.totalAmount ?? "0"}
          supply={salesAgg?.supplyAmount ?? "0"}
          tax={salesAgg?.taxAmount ?? "0"}
          active={currentType === "sales"}
          onClick={() => navigate("sales", currentYear)}
        />
        <SummaryCard
          title="매입 (purchase)"
          icon={<ArrowDownLeft className="w-4 h-4" />}
          color="rose"
          count={purchaseAgg?.count ?? 0}
          total={purchaseAgg?.totalAmount ?? "0"}
          supply={purchaseAgg?.supplyAmount ?? "0"}
          tax={purchaseAgg?.taxAmount ?? "0"}
          active={currentType === "purchase"}
          onClick={() => navigate("purchase", currentYear)}
        />
      </div>

      {/* 필터/검색 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1">
          <TypeBtn active={currentType === "sales"} onClick={() => navigate("sales", currentYear)}>
            매출
          </TypeBtn>
          <TypeBtn active={currentType === "purchase"} onClick={() => navigate("purchase", currentYear)}>
            매입
          </TypeBtn>
        </div>
        <div className="ml-1 flex items-stretch h-7 rounded overflow-hidden border border-slate-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-200 bg-white">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as any)}
            className="text-xs bg-slate-50 hover:bg-slate-100 border-r border-slate-200 px-2 pr-6 cursor-pointer text-slate-700 font-medium outline-none appearance-none"
          >
            <option value="partner">거래처</option>
            <option value="item">품목명</option>
            <option value="amount">공급가액</option>
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                searchField === "partner"
                  ? "거래처명 또는 사업자번호..."
                  : searchField === "item"
                    ? "품목명 키워드..."
                    : "공급가액 (예: 1000000, >=500000, 100000-500000)"
              }
              className={clsx(
                "h-7 pl-7 pr-2 text-xs outline-none w-72",
                searchField === "amount" && "tabular-nums"
              )}
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="px-2 text-slate-400 hover:text-slate-700 border-l border-slate-100"
              title="검색어 지우기"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length.toLocaleString()} / {summary.count.toLocaleString()}건 표시
        </span>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
                <th className="text-left px-3 py-2.5 w-24">작성일자</th>
                <th className="text-left px-3 py-2.5 w-44">거래처</th>
                <th className="text-left px-3 py-2.5 w-28">사업자번호</th>
                <th className="text-left px-3 py-2.5">품목명</th>
                <th className="text-right px-3 py-2.5 w-32">공급가액</th>
                <th className="text-right px-3 py-2.5 w-28">세액</th>
                <th className="text-right px-3 py-2.5 w-32">합계</th>
                <th className="text-left px-3 py-2.5 w-20">분류</th>
                <th className="text-left px-3 py-2.5 w-20">영수/청구</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                // '거래처' = 우리(대동)가 아닌 쪽
                const isSales = it.type === "sales";
                const partnerName = isSales ? it.buyerName : it.supplierName;
                const partnerBiz = isSales ? it.buyerBizNo : it.supplierBizNo;
                return (
                  <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/70 group">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700 tabular-nums">
                      {fmtDate(it.writeDate)}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 truncate" title={partnerName}>
                      {partnerName}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 tabular-nums">
                      {fmtBizNo(partnerBiz)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 truncate" title={it.itemName ?? ""}>
                      {it.itemName ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      ₩{fmtAmount(it.supplyAmount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      ₩{fmtAmount(it.taxAmount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                      ₩{fmtAmount(it.totalAmount)}
                    </td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.category ?? "—"}</td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.paymentType ?? "—"}</td>
                    <td className="px-1 text-right">
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                    {summary.count === 0
                      ? "업로드된 세금계산서가 없습니다. 우측 상단의 「엑셀 업로드」로 .xls 파일을 추가하세요."
                      : "검색 조건에 해당하는 항목이 없습니다"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {summary.count > 200 && (
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50/50 text-[11px] text-slate-500">
            최신 200건만 표시됩니다. 더 좁히려면 연도·검색을 활용하세요. (전체 {summary.count.toLocaleString()}건)
          </div>
        )}
      </div>
    </div>
  );
}

function TypeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 h-7 text-xs font-medium rounded transition",
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function YearBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "min-w-[60px] px-3 h-8 text-xs font-semibold rounded-lg border transition-all tabular-nums",
        active
          ? "bg-brand-600 text-white border-brand-600 shadow-md scale-[1.02]"
          : "bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-700 hover:-translate-y-px"
      )}
    >
      {children}
    </button>
  );
}

function SummaryCard({
  title,
  icon,
  color,
  count,
  total,
  supply,
  tax,
  active,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  color: "emerald" | "rose";
  count: number;
  total: string;
  supply: string;
  tax: string;
  active: boolean;
  onClick: () => void;
}) {
  const palette = {
    emerald: { ring: "ring-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50", chip: "bg-emerald-100" },
    rose: { ring: "ring-rose-300", text: "text-rose-700", bg: "bg-rose-50", chip: "bg-rose-100" },
  }[color];
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-left bg-white rounded-2xl border shadow-card p-5 transition-all",
        active ? `border-transparent ring-2 ${palette.ring}` : "border-slate-200/70 hover:border-slate-300"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <span className={clsx("w-7 h-7 rounded-lg flex items-center justify-center", palette.bg, palette.text)}>
            {icon}
          </span>
          {title}
        </span>
        <span className={clsx("text-[10.5px] px-1.5 py-0.5 rounded font-medium", palette.chip, palette.text)}>
          {count.toLocaleString()}건
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums tracking-tight">
          ₩{Number(total).toLocaleString()}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
        공급가액 ₩{Number(supply).toLocaleString()} · 세액 ₩{Number(tax).toLocaleString()}
      </div>
    </button>
  );
}
