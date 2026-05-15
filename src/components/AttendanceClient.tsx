"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogIn, LogOut, AlertTriangle, Calendar, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import clsx from "clsx";

type Attendance = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  checkInIp: string | null;
  checkOutIp: string | null;
  notes: string | null;
};

function fmtTime(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return "—";
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  return "일월화수목금토"[d.getDay()];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  working: { label: "근무", color: "bg-emerald-100 text-emerald-800" },
  off: { label: "휴무", color: "bg-slate-100 text-slate-600" },
  leave: { label: "휴가", color: "bg-blue-100 text-blue-800" },
  half_am: { label: "오전반차", color: "bg-amber-100 text-amber-800" },
  half_pm: { label: "오후반차", color: "bg-orange-100 text-orange-800" },
  absent: { label: "결근", color: "bg-rose-100 text-rose-800" },
  holiday: { label: "공휴일", color: "bg-purple-100 text-purple-800" },
};

export default function AttendanceClient({
  me,
  today: initialToday,
  records: initialRecords,
}: {
  me: { id: string; name: string; dept: string; position: string; isInternal: boolean; role: string };
  today: Attendance | null;
  records: Attendance[];
}) {
  const router = useRouter();
  const [today, setToday] = useState<Attendance | null>(initialToday);
  const [records, setRecords] = useState<Attendance[]>(initialRecords);
  const [now, setNow] = useState(new Date());
  const [editing, setEditing] = useState<Attendance | null>(null);
  const isAdmin = me.role === "admin";

  async function deleteAttendance(id: string) {
    if (!confirm("이 근태 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "삭제 실패");
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (today && today.id === id) setToday(null);
    router.refresh();
  }

  async function saveEdit(patch: {
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
    notes?: string | null;
  }) {
    if (!editing) return;
    const res = await fetch(`/api/attendance/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "수정 실패");
      return;
    }
    const updated = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...updated } : r)));
    if (today && today.id === editing.id) setToday({ ...today, ...updated });
    setEditing(null);
    router.refresh();
  }

  // 실시간 시계
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!me.isInternal) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-900 mb-1">내부직원 전용 기능</h2>
          <p className="text-sm text-amber-800">근태는 내부직원만 사용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  async function checkAction(action: "check_in" | "check_out") {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "처리 실패");
      return;
    }
    const updated = await res.json();
    setToday(updated);
    setRecords((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      if (exists) return prev.map((r) => (r.id === updated.id ? updated : r));
      return [updated, ...prev];
    });
    router.refresh();
  }

  const todayDateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 최근 30일 통계
  const thisMonth = records.filter((r) => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const workDays = thisMonth.filter((r) => r.status === "working" && r.checkIn).length;
  const leaveDays = thisMonth.filter((r) => r.status === "leave" || r.status === "half_am" || r.status === "half_pm").length;
  const totalMinutes = thisMonth.reduce((acc, r) => {
    if (!r.checkIn || !r.checkOut) return acc;
    return acc + Math.floor((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000);
  }, 0);
  const avgMinutes = workDays > 0 ? Math.floor(totalMinutes / workDays) : 0;

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">인사관리 ▸ 근태</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{me.name} 근태</h1>
          <p className="text-sm text-slate-500 mt-1">
            {me.dept} · {me.position}
          </p>
        </div>
      </div>

      {/* 오늘 출퇴근 카드 */}
      <div className="bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-100 rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[12px] text-slate-500 mb-0.5">{todayDateStr}</div>
            <div className="text-4xl font-bold tabular-nums text-slate-800">
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => checkAction("check_in")}
              disabled={!!today?.checkIn}
              className={clsx(
                "h-14 px-6 text-base font-semibold rounded-xl shadow flex items-center gap-2 transition",
                today?.checkIn
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
              )}
            >
              <LogIn className="w-5 h-5" />
              {today?.checkIn ? `출근 ${fmtTime(today.checkIn)}` : "출근"}
            </button>
            <button
              onClick={() => checkAction("check_out")}
              disabled={!today?.checkIn || !!today?.checkOut}
              className={clsx(
                "h-14 px-6 text-base font-semibold rounded-xl shadow flex items-center gap-2 transition",
                !today?.checkIn || today?.checkOut
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
              )}
            >
              <LogOut className="w-5 h-5" />
              {today?.checkOut ? `퇴근 ${fmtTime(today.checkOut)}` : "퇴근"}
            </button>
          </div>
        </div>
        {today?.checkIn && (
          <div className="flex items-center gap-4 text-[12px] text-slate-600">
            <span>
              근무 시간: <strong className="text-slate-800">{fmtDuration(today.checkIn, today.checkOut)}</strong>
            </span>
            {today.checkInIp && (
              <span className="text-[10px] text-slate-400">IP: {today.checkInIp}</span>
            )}
          </div>
        )}
      </div>

      {/* 이번 달 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="이번 달 근무일" value={`${workDays}일`} icon={Calendar} color="emerald" />
        <StatCard label="이번 달 휴가" value={`${leaveDays}일`} icon={Calendar} color="blue" />
        <StatCard
          label="평균 근무시간"
          value={avgMinutes > 0 ? `${Math.floor(avgMinutes / 60)}시간 ${avgMinutes % 60}분` : "—"}
          icon={Clock}
          color="violet"
        />
        <StatCard
          label="총 근무시간"
          value={totalMinutes > 0 ? `${Math.floor(totalMinutes / 60)}h` : "—"}
          icon={Clock}
          color="slate"
        />
      </div>

      {/* 근태 내역 표 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">최근 30일 근태 내역</h2>
          {isAdmin && (
            <span className="text-[10.5px] bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-1.5 py-0.5 rounded">
              관리자 권한 — 수정/삭제 가능
            </span>
          )}
        </div>
        {records.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">근태 기록이 없습니다</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 text-[11px]">
              <tr>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-28">일자</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-20">상태</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-24">출근</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-24">퇴근</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-28">근무시간</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-32">출근 IP</th>
                <th className="text-left px-3 py-2 border-b border-r border-slate-200">메모</th>
                {isAdmin && <th className="text-center px-2 py-2 border-b border-slate-200 w-20">관리</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const sm = STATUS_META[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
                const weekend = ["일", "토"].includes(getWeekday(r.date));
                return (
                  <tr key={r.id} className={clsx("group hover:bg-slate-50/60", weekend && "bg-slate-50/30")}>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 tabular-nums">
                      <span className={clsx("font-mono", weekend && "text-rose-600")}>
                        {r.date.slice(0, 10)} ({getWeekday(r.date)})
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100">
                      <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", sm.color)}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 tabular-nums">{fmtTime(r.checkIn)}</td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 tabular-nums">{fmtTime(r.checkOut)}</td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 tabular-nums text-slate-600">
                      {r.checkIn ? fmtDuration(r.checkIn, r.checkOut) : "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 text-[10px] text-slate-400">
                      {r.checkInIp ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-slate-100 text-slate-500 text-[11px]">
                      {r.notes ?? "—"}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-1.5 border-b border-slate-100 text-center">
                        <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => setEditing(r)}
                            className="w-6 h-6 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 inline-flex items-center justify-center"
                            title="수정"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteAttendance(r.id)}
                            className="w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* admin 수정 모달 */}
      {editing && isAdmin && (
        <EditModal record={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}
    </div>
  );
}

function EditModal({
  record,
  onClose,
  onSave,
}: {
  record: Attendance;
  onClose: () => void;
  onSave: (patch: { checkIn?: string | null; checkOut?: string | null; status?: string; notes?: string | null }) => void;
}) {
  const [checkIn, setCheckIn] = useState(record.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(record.checkOut ?? "");
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState(record.notes ?? "");
  const [saving, setSaving] = useState(false);

  function toLocalDateTime(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function submit() {
    setSaving(true);
    try {
      await onSave({
        checkIn: checkIn ? new Date(checkIn).toISOString() : null,
        checkOut: checkOut ? new Date(checkOut).toISOString() : null,
        status,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5 text-brand-500" />
            근태 기록 수정 <span className="text-[10px] text-rose-600 ml-1">(admin)</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] text-slate-500 mb-3 font-mono">{record.date.slice(0, 10)}</div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-400">출근</label>
            <input
              type="datetime-local"
              value={toLocalDateTime(checkIn)}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">퇴근</label>
            <input
              type="datetime-local"
              value={toLocalDateTime(checkOut)}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded bg-white outline-none focus:border-brand-300"
            >
              <option value="working">근무</option>
              <option value="business_trip">출장</option>
              <option value="off">휴무</option>
              <option value="leave">휴가</option>
              <option value="half_am">오전반차</option>
              <option value="half_pm">오후반차</option>
              <option value="absent">결근</option>
              <option value="holiday">공휴일</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">메모</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-8 px-2 text-[12px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-[12px] font-medium rounded">
            취소
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 저장
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: "emerald" | "blue" | "violet" | "slate";
}) {
  const bg = {
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    violet: "bg-violet-50 border-violet-100 text-violet-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  }[color];
  return (
    <div className={clsx("border rounded-xl p-3", bg)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 opacity-60" />
        <span className="text-[11px] opacity-80">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
