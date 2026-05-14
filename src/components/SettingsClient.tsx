"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, Settings, Check, Navigation } from "lucide-react";

type Office = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
} | null;

export default function SettingsClient({ initialOffice }: { initialOffice: Office }) {
  const router = useRouter();
  const [name, setName] = useState(initialOffice?.name ?? "대동CMC 사무실");
  const [address, setAddress] = useState(initialOffice?.address ?? "");
  const [lat, setLat] = useState(String(initialOffice?.lat ?? ""));
  const [lng, setLng] = useState(String(initialOffice?.lng ?? ""));
  const [radius, setRadius] = useState(String(initialOffice?.radiusM ?? 200));
  const [saving, setSaving] = useState(false);
  const [pickLoading, setPickLoading] = useState(false);

  async function save() {
    const latN = Number(lat);
    const lngN = Number(lng);
    const rN = Number(radius);
    if (isNaN(latN) || isNaN(lngN) || isNaN(rN)) {
      alert("위도/경도/반경은 숫자여야 합니다");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/office-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, lat: latN, lng: lngN, radiusM: rN }),
      });
      if (!res.ok) {
        alert("저장 실패");
        return;
      }
      alert("저장되었습니다");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function pickCurrent() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    setPickLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
        setPickLoading(false);
      },
      (err) => {
        alert("위치 가져오기 실패: " + (err.message ?? ""));
        setPickLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="px-8 py-7 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-4 h-4 text-brand-500" />
        <span className="text-xs text-slate-500">시스템 ▸ 설정</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">시스템 설정</h1>

      {/* 사무실 위치 (GPS 기반 출퇴근 체크) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-semibold">사무실 위치</h2>
          <span className="text-[11px] text-slate-500">GPS 기반 모바일 출퇴근 체크 기준점</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-400">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">허용 반경 (m)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full h-9 px-2 text-[13px] tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
            />
            <div className="text-[10px] text-slate-400 mt-0.5">권장: 200m (건물 + 주변)</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] text-slate-400">주소</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 울산 남구 ..."
              className="w-full h-9 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">위도 (latitude)</label>
            <input
              type="text"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="35.5394"
              className="w-full h-9 px-2 text-[13px] tabular-nums font-mono border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">경도 (longitude)</label>
            <input
              type="text"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="129.3114"
              className="w-full h-9 px-2 text-[13px] tabular-nums font-mono border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={pickCurrent}
            disabled={pickLoading}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[12px] font-medium rounded flex items-center gap-1.5"
          >
            {pickLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            현재 위치로 설정
          </button>
          {lat && lng && (
            <a
              href={`https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`}
              target="_blank"
              rel="noopener"
              className="text-[11px] text-brand-600 hover:underline"
            >
              지도에서 보기 ↗
            </a>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 저장
          </button>
        </div>

        <div className="mt-3 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2 leading-relaxed">
          📍 모바일 PWA(/m/attendance)에서 출퇴근 시 직원의 GPS와 이 위치 사이 거리를 측정합니다.<br />
          📌 허용 반경 이내에서만 체크 가능 (admin은 반경 검증 우회).<br />
          🌐 직원에게 모바일 앱 안내: 모바일 브라우저로 ERP 접속 → /m/attendance 페이지 열고 "홈 화면에 추가"
        </div>
      </div>
    </div>
  );
}
