"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, X, Loader2, Check } from "lucide-react";
import clsx from "clsx";

type TripReport = {
  id: string;
  title: string;
  destination: string | null;
  purpose: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays: number | null;
  totalCost: string;
  content: string | null;
  result: string | null;
  status: string;
  approvalRoute: string;
  createdAt: string;
  user: { id: string; name: string; position: string };
};

function fmtKRW(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!n) return "—";
  return `₩${n.toLocaleString()}`;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "임시저장",
  pending: "결재중",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

export default function TripReportsClient({
  me,
  initialReports,
}: {
  me: { id: string; name: string };
  initialReports: TripReport[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState<TripReport[]>(initialReports);
  const [showForm, setShowForm] = useState(false);

  async function createReport(payload: any) {
    const res = await fetch("/api/trip-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert("작성 실패");
      return;
    }
    const created = await res.json();
    setReports((prev) => [created, ...prev]);
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">전자결재 ▸ 출장보고서</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">출장보고서</h1>
          <p className="text-sm text-slate-500 mt-1">{me.name} · 총 {reports.length}건</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 신규 작성
        </button>
      </div>

      {showForm && <TripForm onCancel={() => setShowForm(false)} onSubmit={createReport} />}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {reports.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">작성한 출장보고서가 없습니다</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px]">
              <tr>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-24">상태</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200">제목</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-32">출장지</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-44">기간</th>
                <th className="text-right px-3 py-2 border-b border-r border-slate-200 w-28">비용</th>
                <th className="text-left px-3 py-2 border-b border-slate-200 w-24">결재라인</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 border-r border-slate-100">
                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", STATUS_COLOR[r.status] ?? STATUS_COLOR.draft)}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 border-r border-slate-100 font-medium text-slate-800">
                    {r.title}
                    {r.purpose && <div className="text-[10px] text-slate-500 truncate">{r.purpose}</div>}
                  </td>
                  <td className="px-3 py-1.5 border-r border-slate-100 text-slate-600">{r.destination ?? "—"}</td>
                  <td className="px-3 py-1.5 border-r border-slate-100 tabular-nums text-[11px] text-slate-600">
                    {r.startDate?.slice(0, 10) ?? "—"}
                    {r.endDate && r.endDate !== r.startDate && ` ~ ${r.endDate.slice(0, 10)}`}
                    {r.totalDays && <span className="text-[10px] text-slate-400 ml-1">({r.totalDays}일)</span>}
                  </td>
                  <td className="px-3 py-1.5 border-r border-slate-100 text-right tabular-nums">{fmtKRW(r.totalCost)}</td>
                  <td className="px-3 py-1.5 text-[11px] text-slate-600">
                    {r.approvalRoute === "external" ? "외부 (2단계)" : "내부 (3단계)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TripForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [totalCost, setTotalCost] = useState("0");
  const [approvalRoute, setApprovalRoute] = useState<"internal" | "external">("internal");
  const [saving, setSaving] = useState(false);

  const totalDays =
    startDate && endDate
      ? Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
      : null;

  async function submit(asDraft: boolean) {
    if (!title.trim()) {
      alert("제목을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        destination: destination || null,
        purpose: purpose || null,
        startDate: startDate || null,
        endDate: endDate || null,
        totalDays,
        totalCost: Number(totalCost.replace(/[^\d]/g, "") || 0),
        content: content || null,
        result: result || null,
        approvalRoute,
        status: asDraft ? "draft" : "pending",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-brand-200 rounded-xl p-5 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">출장보고서 작성</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-400">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2026 부산 출장"
            autoFocus
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">출장지</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="부산 / 서울 / 해외 등"
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">출장 목적</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="현장 점검 / 회의 참석 등"
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">시작일</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300" />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">종료일</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300" />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">총 비용 (원)</label>
          <input
            inputMode="numeric"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full h-8 px-2 text-[12px] text-right tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
          <div className="text-[10px] text-slate-400 mt-0.5 text-right">{fmtKRW(Number(totalCost) || 0)}</div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">결재 라인</label>
          <div className="flex gap-2 mt-0.5">
            <label className={clsx("flex-1 h-8 px-2 border rounded flex items-center gap-1.5 cursor-pointer text-[12px]", approvalRoute === "internal" ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200")}>
              <input type="radio" value="internal" checked={approvalRoute === "internal"} onChange={() => setApprovalRoute("internal")} className="text-brand-600" />
              <span>내부 (3단계)</span>
            </label>
            <label className={clsx("flex-1 h-8 px-2 border rounded flex items-center gap-1.5 cursor-pointer text-[12px]", approvalRoute === "external" ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200")}>
              <input type="radio" value="external" checked={approvalRoute === "external"} onChange={() => setApprovalRoute("external")} className="text-brand-600" />
              <span>외부 (2단계)</span>
            </label>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-400">출장 내용</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 resize-none" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-400">출장 결과</label>
          <textarea value={result} onChange={(e) => setResult(e.target.value)} rows={3} className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300 resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-[12px] font-medium rounded">
          취소
        </button>
        <button onClick={() => submit(true)} disabled={saving} className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium rounded">
          임시저장
        </button>
        <button onClick={() => submit(false)} disabled={saving} className="h-8 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[12px] font-medium rounded flex items-center gap-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 결재 상신
        </button>
      </div>
    </div>
  );
}
