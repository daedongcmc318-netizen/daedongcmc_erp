"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, ExternalLink, Loader2, MessageSquare, CheckCircle2, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import clsx from "clsx";
import { BIZ_CATEGORY, getBizMeta, getStatusMeta, getServiceLabel } from "@/lib/enums";

type Deliverable = {
  id: string;
  seq: number;
  title: string;
  reviewStatus: string;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewFeedback: string | null;
  isCompleted: boolean;
  completedDate: string | null;
  project: {
    id: string;
    title: string;
    displayCode: string | null;
    year: number;
    bizCategory: string;
    serviceType: string | null;
    serviceDetail: string | null;
    status: string;
    manager: { id: string; name: string; pmCode: string | null } | null;
  };
};

type RecentDel = Omit<Deliverable, "project"> & {
  project: { id: string; title: string; displayCode: string | null; year: number; manager: { id: string; name: string } | null };
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function elapsed(d: string | null): string {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}일 ${hours}시간 전`;
  if (hours > 0) return `${hours}시간 전`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${mins}분 전`;
}

export default function ReviewsClient({
  me,
  pending: initialPending,
  recent: initialRecent,
}: {
  me: { id: string; name: string; role: string };
  pending: Deliverable[];
  recent: RecentDel[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Deliverable[]>(initialPending);
  const [recent, setRecent] = useState<RecentDel[]>(initialRecent);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">산출물 검토</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{me.name} 검토 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            검토 대기 <span className="font-semibold text-rose-600">{pending.length}건</span> · 최근 처리 {recent.length}건
          </p>
        </div>
      </div>

      {/* 검토 대기 */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 mb-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          검토 대기 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            검토 대기중인 산출물이 없습니다 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <ReviewCard
                key={d.id}
                deliverable={d}
                open={openId === d.id}
                onToggle={() => setOpenId(openId === d.id ? null : d.id)}
                onApproved={(updated) => {
                  setPending((prev) => prev.filter((x) => x.id !== d.id));
                  setRecent((prev) => [{ ...d, ...updated, project: { ...d.project } } as any, ...prev]);
                  setOpenId(null);
                  router.refresh();
                }}
                onRevised={(updated) => {
                  setPending((prev) => prev.filter((x) => x.id !== d.id));
                  setRecent((prev) => [{ ...d, ...updated, project: { ...d.project } } as any, ...prev]);
                  setOpenId(null);
                  router.refresh();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 최근 처리 */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          최근 처리 ({recent.length})
        </h2>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">처리 이력이 없습니다</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="text-[11px] text-slate-500 font-medium">
                  <th className="text-left px-3 py-2 w-24">처리일자</th>
                  <th className="text-left px-3 py-2 w-20">결과</th>
                  <th className="text-left px-3 py-2 w-16">코드</th>
                  <th className="text-left px-3 py-2">프로젝트 / 산출물</th>
                  <th className="text-left px-3 py-2 w-24">담당자</th>
                  <th className="text-left px-3 py-2">피드백</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-mono text-[10.5px] text-slate-500 tabular-nums">{fmtDate(r.reviewedAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          r.reviewStatus === "approved" ? "bg-pink-100 text-pink-800" : "bg-rose-100 text-rose-800"
                        )}
                      >
                        {r.reviewStatus === "approved" ? "✓ 완료" : "↺ 보완"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-slate-500">{r.project.displayCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="text-[11px] text-slate-700 font-medium truncate">{r.project.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">산출물{r.seq} · {r.title}</div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{r.project.manager?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-[10.5px] text-slate-500 truncate" title={r.reviewFeedback ?? ""}>
                      {r.reviewFeedback ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  deliverable,
  open,
  onToggle,
  onApproved,
  onRevised,
}: {
  deliverable: Deliverable;
  open: boolean;
  onToggle: () => void;
  onApproved: (updated: Partial<Deliverable>) => void;
  onRevised: (updated: Partial<Deliverable>) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const biz = getBizMeta(deliverable.project.bizCategory);
  const status = getStatusMeta(deliverable.project.status);

  async function act(action: "approve" | "revise") {
    if (action === "revise" && !feedback.trim()) {
      alert("보완 사유를 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/project-deliverables/${deliverable.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback: feedback || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "처리 실패");
        return;
      }
      if (action === "approve") onApproved(json);
      else onRevised(json);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
            검토중
          </span>
          <span className={clsx("text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium", biz.color)}>
            {biz.label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400">{deliverable.project.displayCode ?? ""}</span>
            <span className="text-sm font-medium text-slate-800 truncate">{deliverable.project.title}</span>
            <ArrowRight className="w-3 h-3 text-slate-300" />
            <span className="text-[11px] text-brand-700 font-medium">산출물{deliverable.seq}</span>
            <span className="text-[11px] text-slate-700 truncate">— {deliverable.title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10.5px] text-slate-500">
            <span>담당자: {deliverable.project.manager?.name ?? "—"}</span>
            <span>·</span>
            <span>요청: {elapsed(deliverable.reviewSubmittedAt)}</span>
            <span>·</span>
            <span>{getServiceLabel(deliverable.project.serviceType)}</span>
            {deliverable.project.serviceDetail && <span className="truncate">· {deliverable.project.serviceDetail}</span>}
          </div>
        </div>
        <Link
          href={`/projects?year=${deliverable.project.year}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-brand-600 hover:underline shrink-0 inline-flex items-center gap-0.5"
        >
          프로젝트 <ExternalLink className="w-3 h-3" />
        </Link>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/30">
          <label className="text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> 피드백 (보완 시 필수)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="검토 의견 / 보완 요청 사항"
            className="w-full text-[12px] px-3 py-2 border border-slate-200 rounded focus:border-brand-300 focus:ring-2 focus:ring-brand-200 outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={() => act("revise")}
              disabled={saving}
              className="h-9 px-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> 보완 요청
            </button>
            <button
              onClick={() => act("approve")}
              disabled={saving}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              완료 (검토 통과)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
