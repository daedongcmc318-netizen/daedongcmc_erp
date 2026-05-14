"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Navigation,
  Briefcase,
} from "lucide-react";
import clsx from "clsx";

type Attendance = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInDistance: number | null;
};

type Office = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
} | null;

function fmtTime(d: string | null): string {
  if (!d) return "--:--";
  const dt = new Date(d);
  return dt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDate(d: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}시간 ${m}분`;
}

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

export default function MobileAttendanceClient({
  me,
  today: initialToday,
  recent: initialRecent,
  office,
}: {
  me: { id: string; name: string; dept: string; position: string; isInternal: boolean; role: string };
  today: Attendance | null;
  recent: Attendance[];
  office: Office;
}) {
  const router = useRouter();
  const [today, setToday] = useState<Attendance | null>(initialToday);
  const [recent, setRecent] = useState<Attendance[]>(initialRecent);
  const [now, setNow] = useState(new Date());
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // 시계
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // GPS 추적
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("이 기기는 위치 서비스를 지원하지 않습니다");
      return;
    }
    setLoading(true);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setGeoError(null);
        setLoading(false);
      },
      (err) => {
        setGeoError(err.message ?? "위치 가져오기 실패");
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const distance =
    pos && office ? haversineMeters(pos.lat, pos.lng, office.lat, office.lng) : null;
  const inRange = office && distance != null ? distance <= office.radiusM : false;
  const canCheck = me.role === "admin" || (pos != null && inRange);

  async function action(act: "check_in" | "check_out") {
    if (!pos && me.role !== "admin") {
      alert("위치 정보를 가져올 수 없습니다. GPS를 허용해주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: act,
          lat: pos?.lat,
          lng: pos?.lng,
          accuracy: pos?.accuracy,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "처리 실패");
        return;
      }
      setToday(j);
      setRecent((prev) => {
        const idx = prev.findIndex((r) => r.id === j.id);
        if (idx >= 0) return prev.map((r) => (r.id === j.id ? j : r));
        return [j, ...prev];
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleTrip() {
    setBusy(true);
    try {
      const newStatus = today?.status === "business_trip" ? "working" : "business_trip";
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", status: newStatus }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "처리 실패");
        return;
      }
      setToday(j);
    } finally {
      setBusy(false);
    }
  }

  if (!me.isInternal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-amber-900 mb-1">내부직원 전용</h2>
          <p className="text-sm text-amber-800">근태는 내부직원만 사용 가능합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-br from-brand-600 to-indigo-700 text-white p-5 pb-7">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[11px] text-white/70">대동CMC 근태</div>
            <div className="text-lg font-bold">{me.name}</div>
            <div className="text-[11px] text-white/80">{me.dept} · {me.position}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/70">{fmtDate(now)}</div>
            <div className="text-3xl font-bold tabular-nums tracking-tight mt-0.5">
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </div>
          </div>
        </div>
      </div>

      {/* 위치 상태 카드 */}
      <div className="px-4 -mt-4">
        <div className={clsx(
          "rounded-2xl shadow-sm border p-4 mb-4",
          loading ? "bg-white border-slate-200" :
          geoError ? "bg-rose-50 border-rose-200" :
          inRange ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
        )}>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">위치 확인 중...</span>
            </div>
          ) : geoError ? (
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{geoError}</span>
            </div>
          ) : office ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className={clsx("w-4 h-4", inRange ? "text-emerald-600" : "text-amber-600")} />
                  <span className="font-semibold text-[13px]">{office.name}</span>
                </div>
                <span className={clsx("text-[11px] font-bold tabular-nums", inRange ? "text-emerald-700" : "text-amber-700")}>
                  {distance != null ? `${Math.round(distance)}m` : "--m"}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mb-1">
                {inRange ? `✓ 사무실 반경 ${office.radiusM}m 안에 있습니다` : `허용 반경 ${office.radiusM}m — ${distance ? Math.round(distance - office.radiusM) : "--"}m 더 가까이 가야 합니다`}
              </div>
              {pos && (
                <div className="text-[9px] text-slate-400 font-mono">
                  내 위치: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} (±{Math.round(pos.accuracy)}m)
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-amber-700">사무실 위치 미설정 — 관리자에게 문의</div>
          )}
        </div>

        {/* 출근/퇴근 버튼 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => action("check_in")}
            disabled={busy || !!today?.checkIn || (!canCheck && me.role !== "admin")}
            className={clsx(
              "py-6 rounded-2xl font-bold text-base shadow-lg flex flex-col items-center gap-1.5 transition",
              today?.checkIn
                ? "bg-slate-200 text-slate-400"
                : canCheck
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                  : "bg-slate-200 text-slate-400"
            )}
          >
            {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />}
            <span>{today?.checkIn ? `출근 ${fmtTime(today.checkIn)}` : "출근"}</span>
          </button>
          <button
            onClick={() => action("check_out")}
            disabled={busy || !today?.checkIn || !!today?.checkOut || (!canCheck && me.role !== "admin")}
            className={clsx(
              "py-6 rounded-2xl font-bold text-base shadow-lg flex flex-col items-center gap-1.5 transition",
              !today?.checkIn || today?.checkOut
                ? "bg-slate-200 text-slate-400"
                : canCheck
                  ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
                  : "bg-slate-200 text-slate-400"
            )}
          >
            {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
            <span>{today?.checkOut ? `퇴근 ${fmtTime(today.checkOut)}` : "퇴근"}</span>
          </button>
        </div>

        {/* 출장 토글 */}
        <button
          onClick={toggleTrip}
          disabled={busy}
          className={clsx(
            "w-full py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition mb-4",
            today?.status === "business_trip"
              ? "bg-violet-100 text-violet-700 border border-violet-200"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <Briefcase className="w-4 h-4" />
          {today?.status === "business_trip" ? "출장 중 (해제하려면 클릭)" : "출장 모드 켜기"}
        </button>

        {/* 오늘 기록 */}
        {today?.checkIn && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="text-[11px] text-slate-500 mb-2">오늘 근무</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-slate-700">근무 시간</span>
              <span className="text-lg font-bold tabular-nums text-slate-800">
                {fmtDuration(today.checkIn, today.checkOut)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span>
                <LogIn className="w-3 h-3 inline text-emerald-500" /> {fmtTime(today.checkIn)}
                {today.checkInDistance != null && (
                  <span className="text-[9px] text-slate-400 ml-1">({Math.round(today.checkInDistance)}m)</span>
                )}
              </span>
              {today.checkOut && (
                <span>
                  <LogOut className="w-3 h-3 inline text-rose-500" /> {fmtTime(today.checkOut)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 최근 7일 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-6">
          <div className="text-[11px] font-medium text-slate-600 mb-2">최근 7일</div>
          {recent.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-slate-400">기록 없음</div>
          ) : (
            <div className="space-y-1.5">
              {recent.map((r) => {
                const isToday = r.date.slice(0, 10) === new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={r.id}
                    className={clsx(
                      "flex items-center justify-between text-[11px] py-1.5 px-2 rounded",
                      isToday && "bg-brand-50"
                    )}
                  >
                    <span className="font-mono text-slate-500 tabular-nums">{r.date.slice(5, 10)}</span>
                    <span className="text-[10px] text-slate-400">
                      {fmtTime(r.checkIn)} ~ {fmtTime(r.checkOut)}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {fmtDuration(r.checkIn, r.checkOut)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 풋터 안내 */}
        <div className="text-center text-[10px] text-slate-400 pb-6">
          GPS 기반 출퇴근 체크
          <br />
          홈 화면에 추가하여 앱처럼 사용 가능
        </div>
      </div>
    </div>
  );
}
