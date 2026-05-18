"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  Calendar,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  MapPin,
  Building2,
  Star,
  Navigation,
  Users as UsersIcon,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";

type Attendance = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  checkInIp: string | null;
  checkOutIp: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  notes: string | null;
};

type Office = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
  isPrimary?: boolean;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

type AdminData = {
  allTodayAttendance: (Attendance & {
    user: { id: string; name: string; dept: string; position: string };
    checkInDistance?: number | null;
  })[];
  internalUsers: { id: string; name: string; dept: string; position: string }[];
};

export default function AttendanceClient({
  me,
  today: initialToday,
  records: initialRecords,
  offices,
  adminData,
}: {
  me: { id: string; name: string; dept: string; position: string; isInternal: boolean; role: string };
  today: Attendance | null;
  records: Attendance[];
  offices: Office[];
  adminData: AdminData | null;
}) {
  const router = useRouter();
  const [today, setToday] = useState<Attendance | null>(initialToday);
  const [records, setRecords] = useState<Attendance[]>(initialRecords);
  const [now, setNow] = useState(new Date());
  const [editing, setEditing] = useState<Attendance | null>(null);
  const isAdmin = me.role === "admin";

  // 관리자: 워크/관리자 모드 토글 (localStorage 기억)
  //   - HJK 처럼 본인이 출퇴근도 하는 admin 은 기본 'worker' 시작
  //   - JHC/JYP 처럼 내부직원 아닌 admin 은 기본 'admin'
  const [viewMode, setViewMode] = useState<"worker" | "admin">(() => {
    if (typeof window === "undefined") return "worker";
    const saved = window.localStorage.getItem("attendance_view_mode");
    if (saved === "worker" || saved === "admin") return saved;
    return me.isInternal ? "worker" : "admin";
  });
  function changeViewMode(m: "worker" | "admin") {
    setViewMode(m);
    if (typeof window !== "undefined") window.localStorage.setItem("attendance_view_mode", m);
  }

  // GPS 추적
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    offices.find((o) => o.isPrimary)?.id ?? offices[0]?.id ?? ""
  );
  const [autoPick, setAutoPick] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    setGeoLoading(true);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setGeoError(null);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message ?? "위치 가져오기 실패");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // 각 지사 거리
  const distances = useMemo(() => {
    if (!pos) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const o of offices) m.set(o.id, haversineMeters(pos.lat, pos.lng, o.lat, o.lng));
    return m;
  }, [pos, offices]);

  // 자동 선택: GPS 잡히면 가장 가까운 지사로
  useEffect(() => {
    if (!autoPick || !pos || offices.length === 0) return;
    let bestId = offices[0].id;
    let bestDist = Infinity;
    for (const o of offices) {
      const d = haversineMeters(pos.lat, pos.lng, o.lat, o.lng);
      if (d < bestDist) {
        bestDist = d;
        bestId = o.id;
      }
    }
    setSelectedBranchId(bestId);
  }, [pos, offices, autoPick]);

  const selected = offices.find((o) => o.id === selectedBranchId) ?? null;
  const selectedDistance = selected && pos ? distances.get(selected.id) ?? null : null;
  const inRange = selected && selectedDistance != null ? selectedDistance <= selected.radiusM : false;

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
    if (!pos) {
      alert("위치 정보를 가져올 수 없습니다. GPS/위치 권한을 허용해주세요.");
      return;
    }
    if (!selected) {
      alert("출퇴근할 지사를 선택해주세요.");
      return;
    }
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        branchId: selected.id,
      }),
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
          <h1 className="text-2xl font-semibold tracking-tight">
            {viewMode === "admin" ? "오늘 근무 현황" : `${me.name} 근태`}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {viewMode === "admin"
              ? "관리자 모드 — 전체 내부직원 출퇴근 상황"
              : `${me.dept} · ${me.position}`}
          </p>
        </div>
        {/* 워크/관리자 토글 (admin 전용) */}
        {isAdmin && adminData && (
          <div className="inline-flex rounded-full bg-slate-100 p-0.5 shadow-sm">
            <button
              onClick={() => changeViewMode("worker")}
              className={clsx(
                "h-9 px-5 text-[13px] font-semibold rounded-full transition flex items-center gap-1.5",
                viewMode === "worker"
                  ? "bg-white text-brand-700 shadow"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Briefcase className="w-3.5 h-3.5" /> 워크
            </button>
            <button
              onClick={() => changeViewMode("admin")}
              className={clsx(
                "h-9 px-5 text-[13px] font-semibold rounded-full transition flex items-center gap-1.5",
                viewMode === "admin"
                  ? "bg-white text-brand-700 shadow"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UsersIcon className="w-3.5 h-3.5" /> 관리자
            </button>
          </div>
        )}
      </div>

      {/* 관리자 모드 뷰 */}
      {viewMode === "admin" && adminData && (
        <AdminTodayView
          data={adminData}
          onRefresh={() => router.refresh()}
        />
      )}

      {viewMode === "worker" && (
      <>
      {/* 출퇴근 지사 선택 + 위치 상태 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-slate-700 font-medium flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-500" /> 출퇴근 지사 선택
          </span>
          {!autoPick && pos && (
            <button
              onClick={() => setAutoPick(true)}
              className="text-[11px] text-brand-600 hover:underline inline-flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" /> 현재 위치로 자동 선택
            </button>
          )}
        </div>
        {offices.length === 0 ? (
          <div className="text-center py-4 text-xs text-amber-700 bg-amber-50 rounded">
            등록된 지사가 없습니다. 시스템 설정에서 추가해 주세요.
          </div>
        ) : (
          <div
            className={clsx(
              "grid gap-2",
              offices.length === 1 ? "grid-cols-1" : offices.length === 2 ? "grid-cols-2" : "grid-cols-3"
            )}
          >
            {offices.map((o) => {
              const d = distances.get(o.id);
              const within = d != null && d <= o.radiusM;
              const active = o.id === selectedBranchId;
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedBranchId(o.id);
                    setAutoPick(false);
                  }}
                  className={clsx(
                    "p-2.5 rounded-lg border text-left transition",
                    active
                      ? within
                        ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200"
                        : "bg-amber-50 border-amber-400 ring-2 ring-amber-200"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {o.isPrimary && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                    )}
                    <span className="text-[13px] font-semibold text-slate-800 truncate">
                      {o.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin
                      className={clsx(
                        "w-3 h-3 shrink-0",
                        within ? "text-emerald-600" : d == null ? "text-slate-300" : "text-amber-600"
                      )}
                    />
                    <span
                      className={clsx(
                        "text-[11px] font-mono tabular-nums",
                        d == null
                          ? "text-slate-400"
                          : within
                            ? "text-emerald-700 font-semibold"
                            : "text-amber-700"
                      )}
                    >
                      {d == null ? "--m" : d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`}
                      <span className="text-[10px] text-slate-400 ml-1">/ 허용 {o.radiusM}m</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {geoLoading && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" /> GPS 위치 확인 중...
          </div>
        )}
        {geoError && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{geoError}</span>
          </div>
        )}
        {pos && (
          <div className="mt-2 text-[9.5px] text-slate-400 font-mono">
            내 위치: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} (±{Math.round(pos.accuracy)}m)
          </div>
        )}
      </div>

      {/* 오늘 출퇴근 카드 */}
      <div className="bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-100 rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[12px] text-slate-500 mb-0.5">{todayDateStr}</div>
            <div className="text-4xl font-bold tabular-nums text-slate-800">
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </div>
            {selected && (
              <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <MapPin className={clsx("w-3 h-3", inRange ? "text-emerald-600" : "text-amber-600")} />
                <span className="font-medium">{selected.name}</span>
                <span
                  className={clsx(
                    "font-mono tabular-nums",
                    inRange ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  ({selectedDistance != null ? `${Math.round(selectedDistance)}m` : "--m"})
                </span>
                {inRange ? (
                  <span className="text-emerald-700 font-semibold ml-1">✓ 반경 안</span>
                ) : (
                  <span className="text-amber-700 ml-1">⚠ 반경 밖 — 출퇴근 불가</span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => checkAction("check_in")}
              disabled={!!today?.checkIn || !inRange || !pos}
              className={clsx(
                "h-14 px-6 text-base font-semibold rounded-xl shadow flex items-center gap-2 transition",
                today?.checkIn
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : inRange && pos
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              <LogIn className="w-5 h-5" />
              {today?.checkIn ? `출근 ${fmtTime(today.checkIn)}` : "출근"}
            </button>
            <button
              onClick={() => checkAction("check_out")}
              disabled={!today?.checkIn || !!today?.checkOut || !inRange || !pos}
              className={clsx(
                "h-14 px-6 text-base font-semibold rounded-xl shadow flex items-center gap-2 transition",
                !today?.checkIn || today?.checkOut
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : inRange && pos
                    ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
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
            {selected && (
              <span className="text-[10px] text-slate-400">
                위치: <strong className="text-slate-600">{selected.name}</strong>
              </span>
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
                <th className="text-left px-3 py-2 border-b border-r border-slate-200 w-28">위치</th>
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
                    <td className="px-3 py-1.5 border-b border-r border-slate-100">
                      <BranchBadge lat={r.checkInLat ?? null} lng={r.checkInLng ?? null} offices={offices} />
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

      </>
      )}

      {/* admin 수정 모달 */}
      {editing && isAdmin && (
        <EditModal record={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
      )}
    </div>
  );
}

/* ─────────── 관리자: 오늘 근무 현황 (워크/관리자 모드의 관리자) ─────────── */
function AdminTodayView({
  data,
  onRefresh,
}: {
  data: AdminData;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  // 자동 새로고침 (30초)
  useEffect(() => {
    const t = setInterval(() => onRefresh(), 30000);
    return () => clearInterval(t);
  }, [onRefresh]);

  const fmt = (d: string | null) => {
    if (!d) return "--:--";
    return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // 분류: 근무중(체크인만) / 퇴근완료(체크아웃까지) / 미체크
  const checkedInIds = new Set(data.allTodayAttendance.filter((a) => a.checkIn).map((a) => a.user.id));
  const working = data.allTodayAttendance.filter((a) => a.checkIn && !a.checkOut);
  const done = data.allTodayAttendance.filter((a) => a.checkIn && a.checkOut);
  const noCheckin = data.internalUsers.filter((u) => !checkedInIds.has(u.id));

  function handleRefresh() {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 700);
  }

  const todayStr = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="전체 내부직원" value={data.internalUsers.length} suffix="명" tone="slate" />
        <StatBox label="근무 중" value={working.length} suffix="명" tone="emerald" />
        <StatBox label="퇴근 완료" value={done.length} suffix="명" tone="violet" />
        <StatBox label="미체크" value={noCheckin.length} suffix="명" tone="rose" />
      </div>

      {/* 오늘 근무 카드 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5 text-brand-500" /> 오늘 근무
            </h2>
            <span className="text-[10.5px] text-slate-500">{todayStr}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="h-7 px-2.5 text-[11px] text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded inline-flex items-center gap-1"
            title="30초마다 자동 새로고침"
          >
            <RefreshCw className={clsx("w-3 h-3", refreshing && "animate-spin")} /> 새로고침
          </button>
        </div>

        {/* 근무 중 */}
        <Section title="근무 중인 직원" count={working.length} tone="emerald">
          {working.length === 0 ? (
            <EmptyRow text="현재 근무 중인 직원이 없습니다" />
          ) : (
            working.map((a) => (
              <PersonRow
                key={a.id}
                name={a.user.name}
                dept={a.user.dept}
                position={a.user.position}
                checkIn={fmt(a.checkIn)}
                checkOut={fmt(a.checkOut)}
                status="working"
                distance={a.checkInDistance}
              />
            ))
          )}
        </Section>

        {/* 퇴근 완료 */}
        <Section title="퇴근한 직원" count={done.length} tone="violet">
          {done.length === 0 ? (
            <EmptyRow text="아직 퇴근 기록이 없습니다" />
          ) : (
            done.map((a) => (
              <PersonRow
                key={a.id}
                name={a.user.name}
                dept={a.user.dept}
                position={a.user.position}
                checkIn={fmt(a.checkIn)}
                checkOut={fmt(a.checkOut)}
                status="done"
              />
            ))
          )}
        </Section>

        {/* 미체크 */}
        {noCheckin.length > 0 && (
          <Section title="아직 출근 안 한 직원" count={noCheckin.length} tone="rose">
            {noCheckin.map((u) => (
              <div key={u.id} className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 text-xs font-semibold flex items-center justify-center">
                    {u.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-700">{u.name}</div>
                    <div className="text-[10.5px] text-slate-400">
                      {u.dept} · {u.position}
                    </div>
                  </div>
                  <div className="text-[11px] text-rose-600 font-medium">미출근</div>
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>

      <div className="text-center text-[10.5px] text-slate-400">
        30초마다 자동 새로고침됩니다 · 직원이 출퇴근을 찍으면 곧 반영됩니다
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "slate" | "emerald" | "violet" | "rose";
}) {
  const c = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
  }[tone];
  return (
    <div className={clsx("border rounded-xl p-3", c)}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">
        {value}
        <span className="text-[12px] ml-0.5 opacity-70">{suffix}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "emerald" | "violet" | "rose";
  children: React.ReactNode;
}) {
  const badge = {
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    rose: "bg-rose-100 text-rose-700",
  }[tone];
  return (
    <div>
      <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center gap-1.5">
        <span className="text-[12px] font-semibold text-slate-700">{title}</span>
        <span className={clsx("text-[10.5px] px-1.5 py-0.5 rounded font-semibold tabular-nums", badge)}>
          {count}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function PersonRow({
  name,
  dept,
  position,
  checkIn,
  checkOut,
  status,
  distance,
}: {
  name: string;
  dept: string;
  position: string;
  checkIn: string;
  checkOut: string;
  status: "working" | "done";
  distance?: number | null;
}) {
  return (
    <div className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50/40">
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "relative w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0",
            status === "working"
              ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
              : "bg-gradient-to-br from-violet-400 to-violet-600"
          )}
        >
          {name.slice(0, 1)}
          {status === "working" && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-800">{name}</div>
          <div className="text-[10.5px] text-slate-500">
            {dept} · {position}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 text-[11.5px] tabular-nums">
            <span className="text-emerald-700 font-semibold">출근 {checkIn}</span>
            <span className={clsx(status === "done" ? "text-rose-700 font-semibold" : "text-slate-300")}>
              퇴근 {checkOut}
            </span>
          </div>
          {distance != null && (
            <div className="text-[9.5px] text-slate-400 mt-0.5">({Math.round(distance)}m)</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-4 text-center text-[11.5px] text-slate-400">{text}</div>;
}

/** 출근 좌표를 등록된 지사 중 가장 가까운 곳으로 매핑해 뱃지 표시 */
function BranchBadge({
  lat,
  lng,
  offices,
}: {
  lat: number | null;
  lng: number | null;
  offices: Office[];
}) {
  if (lat == null || lng == null || offices.length === 0) {
    return <span className="text-[10.5px] text-slate-300">—</span>;
  }
  // 가장 가까운 지사 + 거리 계산
  let nearest: Office | null = null;
  let minDist = Infinity;
  for (const o of offices) {
    const d = haversineMeters(lat, lng, o.lat, o.lng);
    if (d < minDist) {
      minDist = d;
      nearest = o;
    }
  }
  if (!nearest) return <span className="text-[10.5px] text-slate-300">—</span>;
  const within = minDist <= nearest.radiusM;
  // 본사/지사 색상 구분 (primary = brand, 기타 = sky)
  const tone = within
    ? nearest.isPrimary
      ? "bg-brand-50 text-brand-700 ring-brand-200"
      : "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded ring-1 font-medium",
        tone
      )}
      title={`${nearest.name} · 출근 시각 ${Math.round(minDist)}m`}
    >
      {nearest.isPrimary && <Star className="w-2.5 h-2.5 fill-current" />}
      {nearest.name}
      {!within && <span className="text-[9px] opacity-70">(반경 밖)</span>}
    </span>
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
