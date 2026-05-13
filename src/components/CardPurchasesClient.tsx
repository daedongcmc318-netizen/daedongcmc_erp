"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Search, Loader2, X, CreditCard, ArrowDownLeft } from "lucide-react";
import clsx from "clsx";

type Item = {
  id: string;
  approvalDate: string;
  cardName: string | null;
  merchantName: string;
  category: string | null;
  amount: string;
  supplyAmount: string;
  taxAmount: string;
  installment: string | null;
  note: string | null;
};

export default function CardPurchasesClient({
  initialItems,
  summary,
  currentYear,
  years,
}: {
  initialItems: Item[];
  summary: { count: number; amount: string; supplyAmount: string; taxAmount: string };
  currentYear: string;
  years: number[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => setItems(initialItems), [initialItems]);

  function navigate(year: string) {
    const q = new URLSearchParams();
    if (year) q.set("year", year);
    router.push(`/card-purchases${q.toString() ? `?${q}` : ""}`);
  }

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        it.merchantName.toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.cardName ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch("/api/card-purchases", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setUploadMsg(`업로드 실패: ${json.error ?? "오류"}`);
      else {
        setUploadMsg(
          `${files.length}개 파일 처리 · 파싱 ${json.parsed} / 적재 ${json.upserted}${
            json.errors?.length ? ` · 오류 ${json.errors.length}` : ""
          }`
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

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">카드매입</h1>
          <p className="text-xs text-slate-500 mt-1">법인카드 매입 내역. 엑셀 파일을 업로드해서 누적 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xls,.xlsx,.csv"
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
        <YearBtn active={!currentYear} onClick={() => navigate("")}>
          전체
        </YearBtn>
        {years.map((y) => (
          <YearBtn key={y} active={currentYear === String(y)} onClick={() => navigate(String(y))}>
            {y}
          </YearBtn>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard
          title="총 매입 건수"
          value={`${summary.count.toLocaleString()}건`}
          icon={<CreditCard className="w-4 h-4" />}
          color="violet"
        />
        <SummaryCard
          title="청구금액 합계"
          value={`₩${Number(summary.amount).toLocaleString()}`}
          icon={<ArrowDownLeft className="w-4 h-4" />}
          color="rose"
        />
        <SummaryCard
          title="공급가액 / 세액"
          value={`₩${Number(summary.supplyAmount).toLocaleString()}`}
          sub={`세액 ₩${Number(summary.taxAmount).toLocaleString()}`}
          icon={<CreditCard className="w-4 h-4" />}
          color="brand"
        />
      </div>

      {/* 검색 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="가맹점, 카드명, 업종..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-72"
          />
        </div>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length.toLocaleString()} / {summary.count.toLocaleString()}건 표시
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-420px)]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
                <th className="text-left px-3 py-2.5 w-28">승인일자</th>
                <th className="text-left px-3 py-2.5 w-28">카드명</th>
                <th className="text-left px-3 py-2.5">가맹점</th>
                <th className="text-left px-3 py-2.5 w-32">업종</th>
                <th className="text-right px-3 py-2.5 w-32">공급가액</th>
                <th className="text-right px-3 py-2.5 w-28">세액</th>
                <th className="text-right px-3 py-2.5 w-32">청구금액</th>
                <th className="text-left px-3 py-2.5 w-20">할부</th>
                <th className="text-left px-3 py-2.5 w-32">비고</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-slate-700">
                    {it.approvalDate.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{it.cardName ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 truncate">{it.merchantName}</td>
                  <td className="px-3 py-2 text-slate-500">{it.category ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    ₩{Number(it.supplyAmount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    ₩{Number(it.taxAmount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    ₩{Number(it.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[10.5px] text-slate-500">{it.installment ?? "—"}</td>
                  <td className="px-3 py-2 text-[10.5px] text-slate-500 truncate">{it.note ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">
                    {summary.count === 0
                      ? "업로드된 카드매입이 없습니다. 「엑셀 업로드」로 카드사 명세서를 추가하세요."
                      : "검색 조건에 해당하는 항목이 없습니다"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function YearBtn({ active, onClick, children }: any) {
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
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "violet" | "rose" | "brand";
}) {
  const palette = {
    violet: { bg: "bg-violet-50", text: "text-violet-700" },
    rose: { bg: "bg-rose-50", text: "text-rose-700" },
    brand: { bg: "bg-brand-50", text: "text-brand-700" },
  }[color];
  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{title}</span>
        <span className={clsx("w-7 h-7 rounded-lg flex items-center justify-center", palette.bg, palette.text)}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500 tabular-nums">{sub}</div>}
    </div>
  );
}
