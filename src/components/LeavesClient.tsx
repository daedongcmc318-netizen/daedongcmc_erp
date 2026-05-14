"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Check,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

type ApprovalStep = {
  id: string;
  level: number;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  approver: { id: string; name: string; position: string };
};

type LeaveRequest = {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  currentLevel: number;
  finalApprovedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; dept: string; position: string };
  approvals: ApprovalStep[];
};

type Balance = {
  isInternal: boolean;
  tenure: string;
  annualTotal: number;
  annualUsed: number;
  annualRemaining: number;
  monthlyTotal: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  totalUsedThisYear: number;
} | null;

const TYPE_META: Record<string, { label: string; color: string; days: number }> = {
  annual: { label: "연차", color: "bg-blue-100 text-blue-800", days: 1 },
  monthly: { label: "월차", color: "bg-violet-100 text-violet-800", days: 1 },
  half_am: { label: "오전반차", color: "bg-amber-100 text-amber-800", days: 0.5 },
  half_pm: { label: "오후반차", color: "bg-orange-100 text-orange-800", days: 0.5 },
};

const LEVEL_LABEL: Record<number, string> = { 1: "본부장", 2: "부대표", 3: "대표이사" };

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

export default function LeavesClient({
  me,
  balance,
  approvalLine,
  myRequests: initialMy,
  toApprove: initialApprove,
}: {
  me: { id: string; name: string; dept: string; position: string; isInternal: boolean; joinDate: string | null };
  balance: Balance;
  approvalLine: { level: number; userId: string; name: string }[];
  myRequests: LeaveRequest[];
  toApprove: LeaveRequest[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "approve">(initialApprove.length > 0 ? "approve" : "mine");
  const [myRequests, setMy] = useState<LeaveRequest[]>(initialMy);
  const [toApprove, setToApprove] = useState<LeaveRequest[]>(initialApprove);
  const [showForm, setShowForm] = useState(false);

  async function submitRequest(payload: { type: string; startDate: string; endDate: string; reason: string }) {
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "신청 실패");
      return;
    }
    const created = await res.json();
    setMy((prev) => [created, ...prev]);
    setShowForm(false);
    router.refresh();
  }

  async function actOnRequest(id: string, action: "approve" | "reject" | "cancel", comment?: string) {
    const res = await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "처리 실패");
      return;
    }
    setToApprove((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  if (!me.isInternal) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-900 mb-1">내부직원 전용 기능</h2>
          <p className="text-sm text-amber-800">
            연차/휴가는 내부직원으로 등록된 사용자만 사용할 수 있습니다. 관리자에게 내부직원 표기를 요청하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">인사관리 ▸ 연차/휴가</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{me.name} 연차 현황</h1>
          <p className="text-sm text-slate-500 mt-1">
            {me.dept} · {me.position} · 입사 {fmtDate(me.joinDate)} · 근속 {balance?.tenure ?? "—"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 휴가 신청
        </button>
      </div>

      {/* 잔여일수 카드 */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {balance.annualTotal > 0 ? (
            <BalanceCard
              label="연차"
              used={balance.annualUsed}
              total={balance.annualTotal}
              remaining={balance.annualRemaining}
              color="blue"
            />
          ) : (
            <BalanceCard
              label="월차"
              used={balance.monthlyUsed}
              total={balance.monthlyTotal}
              remaining={balance.monthlyRemaining}
              color="violet"
              hint="1년 미만"
            />
          )}
          <BalanceCard
            label="이번 해 사용"
            used={balance.totalUsedThisYear}
            total={balance.annualTotal + balance.monthlyTotal}
            remaining={null}
            color="slate"
          />
          <div className="bg-white border border-slate-200 rounded-xl p-3 col-span-2 md:col-span-2">
            <div className="text-[10px] text-slate-400 mb-1">결재 라인</div>
            <div className="flex items-center gap-2 text-[12px]">
              {approvalLine.length === 0 && (
                <span className="text-slate-400">결재자 미지정</span>
              )}
              {approvalLine.map((a, i) => (
                <span key={a.userId} className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-500">L{a.level}</span>
                  <span className="font-medium text-slate-700">{a.name}</span>
                  <span className="text-[10px] text-slate-400">{LEVEL_LABEL[a.level] ?? ""}</span>
                  {i < approvalLine.length - 1 && <span className="text-slate-300">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")} count={myRequests.length}>
          내 신청
        </TabBtn>
        <TabBtn
          active={tab === "approve"}
          onClick={() => setTab("approve")}
          count={toApprove.length}
          highlight={toApprove.length > 0}
        >
          결재 대기
        </TabBtn>
      </div>

      {/* 신청 폼 */}
      {showForm && (
        <RequestForm onCancel={() => setShowForm(false)} onSubmit={submitRequest} />
      )}

      {/* 목록 */}
      {tab === "mine" ? (
        <RequestList
          items={myRequests}
          emptyMsg="신청한 휴가가 없습니다"
          canCancel={(r) => r.userId === me.id && r.status === "pending"}
          onCancel={(id) => actOnRequest(id, "cancel")}
        />
      ) : (
        <RequestList
          items={toApprove}
          emptyMsg="결재 대기중인 휴가 신청이 없습니다 🎉"
          canApprove
          onApprove={(id, c) => actOnRequest(id, "approve", c)}
          onReject={(id, c) => actOnRequest(id, "reject", c)}
        />
      )}
    </div>
  );
}

function BalanceCard({
  label,
  used,
  total,
  remaining,
  color,
  hint,
}: {
  label: string;
  used: number;
  total: number;
  remaining: number | null;
  color: "blue" | "violet" | "slate";
  hint?: string;
}) {
  const colorClass = {
    blue: "bg-blue-50 border-blue-100",
    violet: "bg-violet-50 border-violet-100",
    slate: "bg-slate-50 border-slate-100",
  }[color];
  const accent = {
    blue: "text-blue-700",
    violet: "text-violet-700",
    slate: "text-slate-700",
  }[color];
  return (
    <div className={clsx("border rounded-xl p-3", colorClass)}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] text-slate-500">{label}</div>
        {hint && <span className="text-[9px] px-1 py-0.5 bg-white rounded text-slate-400">{hint}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        {remaining != null ? (
          <>
            <span className={clsx("text-2xl font-bold tabular-nums", accent)}>{remaining}</span>
            <span className="text-xs text-slate-400">/ {total}일</span>
          </>
        ) : (
          <>
            <span className={clsx("text-2xl font-bold tabular-nums", accent)}>{used}</span>
            <span className="text-xs text-slate-400">일</span>
          </>
        )}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">사용 {used}일</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  count,
  highlight,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  highlight?: boolean;
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
          active
            ? "bg-brand-100 text-brand-700"
            : highlight
              ? "bg-rose-100 text-rose-700"
              : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function RequestForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (p: { type: string; startDate: string; endDate: string; reason: string }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState("annual");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isHalf = type === "half_am" || type === "half_pm";

  async function submit() {
    if (!startDate || !endDate) {
      alert("날짜를 입력하세요");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ type, startDate, endDate: isHalf ? startDate : endDate, reason });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-brand-200 rounded-xl p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">휴가 신청</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-slate-400">종류</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
          >
            <option value="annual">연차 (1일)</option>
            <option value="monthly">월차 (1일)</option>
            <option value="half_am">오전반차 (0.5일)</option>
            <option value="half_pm">오후반차 (0.5일)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-400">{isHalf ? "날짜" : "시작일"}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (isHalf) setEndDate(e.target.value);
            }}
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        {!isHalf && (
          <div>
            <label className="text-[10px] text-slate-400">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
        )}
        <div className={isHalf ? "col-span-2" : ""}>
          <label className="text-[10px] text-slate-400">사유 (선택)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="개인 사유 / 병원 등"
            className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onCancel}
          className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-[12px] font-medium rounded"
        >
          취소
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="h-8 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[12px] font-medium rounded flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 신청
        </button>
      </div>
    </div>
  );
}

function RequestList({
  items,
  emptyMsg,
  canCancel,
  onCancel,
  canApprove,
  onApprove,
  onReject,
}: {
  items: LeaveRequest[];
  emptyMsg: string;
  canCancel?: (r: LeaveRequest) => boolean;
  onCancel?: (id: string) => void;
  canApprove?: boolean;
  onApprove?: (id: string, comment: string) => void;
  onReject?: (id: string, comment: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-sm text-slate-400">
        {emptyMsg}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((r) => {
        const meta = TYPE_META[r.type] ?? { label: r.type, color: "bg-slate-100 text-slate-800", days: 1 };
        const isOpen = openId === r.id;
        return (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(isOpen ? null : r.id)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center gap-3"
            >
              <span className={clsx("text-[10px] px-2 py-0.5 rounded font-medium", meta.color)}>{meta.label}</span>
              <span className="font-semibold text-[13px] text-slate-800">{r.user.name}</span>
              <span className="text-[11px] text-slate-500">{r.user.position}</span>
              <span className="text-slate-300">·</span>
              <span className="text-[12px] text-slate-700">
                {fmtDate(r.startDate)} {r.startDate !== r.endDate && `~ ${fmtDate(r.endDate)}`}
              </span>
              <span className="text-[10px] text-slate-400">({r.days}일)</span>
              <StatusBadge status={r.status} currentLevel={r.currentLevel} approvals={r.approvals} />
              {r.reason && (
                <span className="text-[11px] text-slate-500 truncate ml-2 max-w-[200px]" title={r.reason}>
                  💬 {r.reason}
                </span>
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-2 bg-slate-50/40 border-t border-slate-100 space-y-3">
                {/* 결재 진행 라인 */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1.5">결재 진행</div>
                  <div className="flex items-center gap-2">
                    {r.approvals.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-1">
                        <StepIcon status={a.status} />
                        <div className="text-[11px]">
                          <div className="font-medium text-slate-700">{a.approver.name}</div>
                          <div className="text-[9px] text-slate-400">{LEVEL_LABEL[a.level]}</div>
                        </div>
                        {i < r.approvals.length - 1 && <span className="text-slate-300 ml-1">→</span>}
                      </div>
                    ))}
                  </div>
                  {/* 코멘트 */}
                  {r.approvals.some((a) => a.comment) && (
                    <div className="mt-2 space-y-1">
                      {r.approvals
                        .filter((a) => a.comment)
                        .map((a) => (
                          <div key={a.id} className="text-[11px] text-slate-600 flex items-start gap-1">
                            <MessageSquare className="w-3 h-3 mt-0.5 text-slate-400" />
                            <span className="font-medium">{a.approver.name}:</span>
                            <span>{a.comment}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 액션 */}
                {canCancel?.(r) && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => onCancel?.(r.id)}
                      className="h-7 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium rounded"
                    >
                      신청 취소
                    </button>
                  </div>
                )}
                {canApprove && r.status === "pending" && (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={openId === r.id ? comment : ""}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="결재 코멘트 (선택)"
                      rows={2}
                      className="w-full text-[12px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-brand-300 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          onReject?.(r.id, comment);
                          setComment("");
                        }}
                        className="h-7 px-3 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-medium rounded flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> 반려
                      </button>
                      <button
                        onClick={() => {
                          onApprove?.(r.id, comment);
                          setComment("");
                        }}
                        className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium rounded flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> 승인
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({
  status,
  currentLevel,
  approvals,
}: {
  status: string;
  currentLevel: number;
  approvals: ApprovalStep[];
}) {
  if (status === "approved")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium ml-auto">
        ✓ 최종승인
      </span>
    );
  if (status === "rejected")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-medium ml-auto">
        ✗ 반려
      </span>
    );
  if (status === "cancelled")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium ml-auto">
        취소
      </span>
    );
  // pending
  const cur = approvals.find((a) => a.level === currentLevel);
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium ml-auto">
      ⏳ {cur?.approver.name ?? "결재"} 대기 (L{currentLevel})
    </span>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "approved")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "rejected") return <XCircle className="w-4 h-4 text-rose-500" />;
  if (status === "auto_passed") return <Check className="w-4 h-4 text-slate-400" />;
  return <Clock className="w-4 h-4 text-amber-500" />;
}
