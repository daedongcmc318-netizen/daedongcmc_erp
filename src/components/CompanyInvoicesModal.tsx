"use client";
import { useEffect, useState } from "react";
import { X, ArrowUpRight, ArrowDownLeft, Loader2, FileText } from "lucide-react";
import clsx from "clsx";

type Invoice = {
  id: string;
  type: "sales" | "purchase";
  writeDate: string;
  supplierName: string;
  buyerName: string;
  supplierBizNo: string;
  buyerBizNo: string;
  totalAmount: string;
  supplyAmount: string;
  taxAmount: string;
  itemName: string | null;
  category: string | null;
  paymentType: string | null;
};

type Response = {
  company: { id: string; name: string; bizNo: string | null };
  items: Invoice[];
  summary: {
    sales: { count: number; total: number; supply: number };
    purchase: { count: number; total: number; supply: number };
  };
};

const OUR_BIZ = "8298801029";

function fmtAmount(n: number | string): string {
  return Number(n).toLocaleString();
}
function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}
function fmtBiz(b: string | null | undefined): string {
  if (!b) return "";
  const d = b.replace(/[^\d]/g, "");
  if (d.length !== 10) return b;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function CompanyInvoicesModal({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "sales" | "purchase">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/companies/${companyId}/invoices`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  const filtered = data?.items.filter((it) => filter === "all" || it.type === filter) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            세금계산서 거래이력
            {data && (
              <>
                <span className="opacity-60">·</span>
                <span>{data.company.name}</span>
                {data.company.bizNo && !data.company.bizNo.startsWith("temp-") && (
                  <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                    {fmtBiz(data.company.bizNo)}
                  </span>
                )}
              </>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center py-20 text-sm text-slate-400">
            데이터를 불러올 수 없습니다.
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/40">
              <SummaryCard
                color="emerald"
                title="매출"
                icon={<ArrowUpRight className="w-4 h-4" />}
                count={data.summary.sales.count}
                total={data.summary.sales.total}
                supply={data.summary.sales.supply}
                active={filter === "sales"}
                onClick={() => setFilter(filter === "sales" ? "all" : "sales")}
              />
              <SummaryCard
                color="rose"
                title="매입"
                icon={<ArrowDownLeft className="w-4 h-4" />}
                count={data.summary.purchase.count}
                total={data.summary.purchase.total}
                supply={data.summary.purchase.supply}
                active={filter === "purchase"}
                onClick={() => setFilter(filter === "purchase" ? "all" : "purchase")}
              />
            </div>

            {/* 거래 목록 */}
            <div className="flex-1 overflow-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">
                  {filter !== "all"
                    ? "해당 구분의 거래 이력이 없습니다."
                    : "세금계산서 발행 이력이 없습니다."}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
                      <th className="text-left px-3 py-2.5 w-20">구분</th>
                      <th className="text-left px-3 py-2.5 w-24">작성일자</th>
                      <th className="text-left px-3 py-2.5">품목명</th>
                      <th className="text-right px-3 py-2.5 w-32">공급가액</th>
                      <th className="text-right px-3 py-2.5 w-28">세액</th>
                      <th className="text-right px-3 py-2.5 w-32">합계</th>
                      <th className="text-left px-3 py-2.5 w-20">분류</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="px-3 py-2">
                          <span
                            className={clsx(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 whitespace-nowrap",
                              it.type === "sales"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-rose-50 text-rose-700 ring-rose-200"
                            )}
                          >
                            {it.type === "sales" ? "매출" : "매입"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-700 tabular-nums">
                          {fmtDate(it.writeDate)}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 푸터 */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
              <span>전체 {data.items.length}건</span>
              <button
                onClick={onClose}
                className="h-8 px-3 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  color,
  title,
  icon,
  count,
  total,
  supply,
  active,
  onClick,
}: {
  color: "emerald" | "rose";
  title: string;
  icon: React.ReactNode;
  count: number;
  total: number;
  supply: number;
  active: boolean;
  onClick: () => void;
}) {
  const p = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-300" },
  }[color];
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-left bg-white rounded-lg border p-3 transition-all",
        active ? `border-transparent ring-2 ${p.ring}` : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5">
          <span className={clsx("w-6 h-6 rounded flex items-center justify-center", p.bg, p.text)}>
            {icon}
          </span>
          {title}
        </span>
        <span className={clsx("text-[10.5px] px-1.5 py-0.5 rounded font-medium", p.bg, p.text)}>
          {count}건
        </span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums tracking-tight">
        ₩{total.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[10.5px] text-slate-500 tabular-nums">
        공급가액 ₩{supply.toLocaleString()}
      </div>
    </button>
  );
}
