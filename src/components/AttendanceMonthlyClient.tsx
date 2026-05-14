"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  Users as UsersIcon,
} from "lucide-react";
import clsx from "clsx";

type User = { id: string; name: string; dept: string; position: string; isInternal: boolean; role: string };
type Attendance = {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInDistance: number | null;
  notes: string | null;
  editedById: string | null;
  editedAt: string | null;
};
type LeaveRow = {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
};

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function fmtTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end) return "근무중";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  working: { label: "근무", color: "bg-emerald-100 text-emerald-800" },
  business_trip: { label: "출장", color: "bg-violet-100 text-violet-800" },
  off: { label: "휴무", color: "bg-slate-100 text-slate-600" },
  leave: { label: "휴가", color: "bg-blue-100 text-blue-800" },
  half_am: { label: "오전반차", color: "bg-amber-100 text-amber-800" },
  half_pm: { label: "오후반차", color: "bg-orange-100 text-orange-800" },
  absent: { label: "결근", color: "bg-rose-100 text-rose-800" },
  holiday: { label: "공휴일", color: "bg-purple-100 text-purple-800" },
};

const LEAVE_LABEL: Record<string, string> = {
  annual: "연차",
  monthly: "월차",
  half_am: "오전반차",
  half_pm: "오후반차",
  public: "공가",
  sick: "병가",
  maternity: "출산",
  summer: "하계",
  family_event: "경조",
  disaster: "재해",
  health: "보건",
  other: "기타",
};

export default function AttendanceMonthlyClient({
  me,
  year,
  month,
  users,
  records: initialRecords,
  leaves,
  filterUserId,
  isPriv,
}: {
  me: { id: string; name: string; role: string };
  year: number;
  month: number;
  users: User[];
  records: Attendance[];
  leaves: LeaveRow[];
  filterUserId: string | null;
  isPriv: boolean;
}) {
  const router = useRouter();
  const [records, setRecords] = useState<Attendance[]>(initialRecords);
  const [editing, setEditing] = useState<Attendance | null>(null);

  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  // user → date → record 인덱스
  const recordByCell = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const r of records) m.set(`${r.userId}::${r.date.slice(0, 10)}`, r);
    return m;
  }, [records]);

  // user → date → leave type
  const leaveByCell = useMemo(() => {
    const m = new Map<string, LeaveRow>();
    for (const l of leaves) {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const key = `${l.userId}::${yyyy}-${mm}-${dd}`;
        m.set(key, l);
      }
    }
    return m;
  }, [leaves]);

  // 사용자별 통계
  const userStats = useMemo(() => {
    const m = new Map<string, { workDays: number; leaveDays: number; tripDays: number; totalMinutes: number }>();
    for (const u of users) m.set(u.id, { workDays: 0, leaveDays: 0, tripDays: 0, totalMinutes: 0 });
    for (const r of records) {
      const s = m.get(r.userId);
      if (!s) continue;
      if (r.status === "business_trip") s.tripDays++;
      else if (r.checkIn) {
        s.workDays++;
        if (r.checkOut) {
          s.totalMinutes += Math.floor(
            (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000
          );
        }
      }
    }
    // leave days
    for (const l of leaves) {
      const s = m.get(l.userId);
      if (s) s.leaveDays += l.days;
    }
    return m;
  }, [records, leaves, users]);

  function navMonth(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 1) {
      y--;
      m = 12;
    } else if (m > 12) {
      y++;
      m = 1;
    }
    router.push(`/attendance/monthly?year=${y}&month=${m}${filterUserId ? `&userId=${filterUserId}` : ""}`);
  }

  function setUserFilter(id: string | null) {
    const url = `/attendance/monthly?year=${year}&month=${month}${id ? `&userId=${id}` : ""}`;
    router.push(url);
  }

  async function deleteAttendance(id: string) {
    if (!confirm("이 근태 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  async function saveEdit(patch: { checkIn?: string | null; checkOut?: string | null; status?: string; notes?: string | null }) {
    if (!editing) return;
    const res = await fetch(`/api/attendance/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      alert("수정 실패");
      return;
    }
    const updated = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
    setEditing(null);
  }

  return (
    <div className="px-6 py-6 max-w-[1700px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">근태관리 ▸ 근태현황</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">월별 근태 현황</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isPriv ? `${users.length}명 직원` : "본인 근태"} · {year}년 {month}월
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => navMonth(-1)} className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-base font-semibold tabular-nums px-4">
            {year}.{String(month).padStart(2, "0")}
          </div>
          <button onClick={() => navMonth(1)} className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 직원 필터 (admin/manager) */}
      {isPriv && (
        <div className="flex items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
          <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-500">직원:</span>
          <select
            value={filterUserId ?? ""}
            onChange={(e) => setUserFilter(e.target.value || null)}
            className="h-7 px-2 text-[12px] border border-slate-200 rounded bg-white outline-none focus:border-brand-300"
          >
            <option value="">전체 ({users.length}명)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.dept} {u.position})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 직원별 행 + 일자 컬럼 그리드 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="text-[11px] border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 bg-slate-50 z-30 w-44 text-left px-3 py-2 border-b border-r border-slate-200">
                  직원
                </th>
                <th className="w-16 text-right px-2 py-2 border-b border-r border-slate-200 text-[10px]">근무</th>
                <th className="w-16 text-right px-2 py-2 border-b border-r border-slate-200 text-[10px]">휴가</th>
                <th className="w-16 text-right px-2 py-2 border-b border-r border-slate-200 text-[10px]">출장</th>
                <th className="w-24 text-right px-2 py-2 border-b border-r border-slate-200 text-[10px]">총 근무시간</th>
                {days.map((d) => {
                  const date = new Date(year, month - 1, d);
                  const we = date.getDay() === 0 || date.getDay() === 6;
                  const dow = "일월화수목금토"[date.getDay()];
                  return (
                    <th
                      key={d}
                      className={clsx(
                        "w-9 text-center px-0 py-1 border-b border-r border-slate-200 font-medium tabular-nums",
                        we ? "bg-slate-200/60 text-slate-400" : "text-slate-600"
                      )}
                    >
                      <div className="text-[10px]">{d}</div>
                      <div className={clsx("text-[8px] mt-0.5", we ? "text-rose-400" : "text-slate-400")}>{dow}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const stat = userStats.get(u.id) ?? { workDays: 0, leaveDays: 0, tripDays: 0, totalMinutes: 0 };
                const hours = Math.floor(stat.totalMinutes / 60);
                const mins = stat.totalMinutes % 60;
                return (
                  <tr key={u.id} className="group/row border-b border-slate-100 hover:bg-slate-50/40">
                    <td className="sticky left-0 bg-white group-hover/row:bg-slate-50/40 px-3 py-1.5 border-r border-slate-200 z-10">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {u.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-slate-800 truncate">{u.name}</div>
                          <div className="text-[9px] text-slate-400 truncate">{u.dept} {u.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-200 text-right tabular-nums text-[11px] font-semibold text-emerald-700">
                      {stat.workDays}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-200 text-right tabular-nums text-[11px] font-semibold text-blue-700">
                      {stat.leaveDays}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-200 text-right tabular-nums text-[11px] font-semibold text-violet-700">
                      {stat.tripDays}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-200 text-right tabular-nums text-[10.5px] text-slate-700">
                      {hours}시간 {mins}분
                    </td>
                    {days.map((d) => {
                      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const key = `${u.id}::${dateStr}`;
                      const rec = recordByCell.get(key);
                      const leave = leaveByCell.get(key);
                      const date = new Date(year, month - 1, d);
                      const we = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <td
                          key={d}
                          className={clsx(
                            "w-9 h-7 border-r border-slate-100 text-center align-middle p-0 relative",
                            we && "bg-slate-100/40"
                          )}
                          title={
                            leave
                              ? `${LEAVE_LABEL[leave.type] ?? leave.type}`
                              : rec
                                ? `${fmtTime(rec.checkIn)} ~ ${fmtTime(rec.checkOut)} (${fmtDuration(rec.checkIn, rec.checkOut)})`
                                : ""
                          }
                        >
                          {leave ? (
                            <span className={clsx("text-[8px] font-semibold px-1 py-0.5 rounded", STATUS_META[leave.type]?.color ?? "bg-blue-100 text-blue-700")}>
                              {LEAVE_LABEL[leave.type]?.slice(0, 2) ?? "휴"}
                            </span>
                          ) : rec?.status === "business_trip" ? (
                            <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-violet-100 text-violet-700">
                              출장
                            </span>
                          ) : rec?.checkIn ? (
                            <button
                              onClick={() => me.role === "admin" && setEditing(rec)}
                              disabled={me.role !== "admin"}
                              className={clsx(
                                "w-full h-full leading-none flex items-center justify-center",
                                me.role === "admin" && "hover:bg-brand-50 cursor-pointer"
                              )}
                            >
                              <div className="flex flex-col gap-0">
                                <span className="text-[8.5px] font-medium text-emerald-700">
                                  {fmtTime(rec.checkIn).replace(":", "")}
                                </span>
                                {rec.checkOut && (
                                  <span className="text-[8.5px] text-rose-600">{fmtTime(rec.checkOut).replace(":", "")}</span>
                                )}
                              </div>
                            </button>
                          ) : null}
                          {rec && me.role === "admin" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAttendance(rec.id);
                              }}
                              className="absolute -top-0.5 -right-0.5 opacity-0 group-hover/row:opacity-100 text-rose-400 hover:text-rose-600"
                              title="삭제"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 모달 */}
      {editing && me.role === "admin" && (
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
          <h2 className="text-sm font-semibold">근태 기록 수정 (admin)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-[11px] text-slate-500 mb-3">{record.date.slice(0, 10)}</div>
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
