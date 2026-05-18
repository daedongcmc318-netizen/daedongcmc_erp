"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Loader2,
  Settings,
  Check,
  Navigation,
  Plus,
  Trash2,
  Star,
  X,
} from "lucide-react";
import clsx from "clsx";

type Office = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
  isPrimary?: boolean;
};

export default function SettingsClient({ initialOffices }: { initialOffices: Office[] }) {
  const router = useRouter();
  const [offices, setOffices] = useState<Office[]>(initialOffices);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patchBranch(id: string, patch: Partial<Office>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/office-location/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "저장 실패");
        return;
      }
      const list = await fetch(`/api/office-location`).then((r) => r.json());
      setOffices(list);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function addBranch(b: Omit<Office, "id">) {
    const res = await fetch(`/api/office-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "추가 실패");
      return false;
    }
    const list = await fetch(`/api/office-location`).then((r) => r.json());
    setOffices(list);
    router.refresh();
    return true;
  }

  async function deleteBranch(id: string) {
    if (offices.length <= 1) {
      alert("최소 1개의 사무실은 유지되어야 합니다.");
      return;
    }
    if (!confirm("이 지사를 삭제할까요?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/office-location/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("삭제 실패");
        return;
      }
      setOffices((prev) => prev.filter((o) => o.id !== id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function setPrimary(id: string) {
    await patchBranch(id, { isPrimary: true });
  }

  return (
    <div className="px-8 py-7 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-4 h-4 text-brand-500" />
        <span className="text-xs text-slate-500">시스템 ▸ 설정</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">시스템 설정</h1>

      {/* 사무실 위치 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-semibold">사무실 / 지사 위치</h2>
            <span className="text-[11px] text-slate-500">
              GPS 기반 모바일 출퇴근 — 등록된 지사 중 어디든 200m 이내면 통과
            </span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 지사 추가
          </button>
        </div>

        <div className="space-y-2">
          {offices.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              등록된 사무실이 없습니다. 우측 상단 [지사 추가] 로 시작하세요.
            </div>
          ) : (
            offices.map((o) => (
              <BranchRow
                key={o.id}
                office={o}
                busy={busyId === o.id}
                onPatch={(p) => patchBranch(o.id, p)}
                onDelete={() => deleteBranch(o.id)}
                onSetPrimary={() => setPrimary(o.id)}
              />
            ))
          )}
        </div>

        <div className="mt-3 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded p-2 leading-relaxed">
          📍 모바일 PWA(/m/attendance) 출퇴근 시 직원 GPS 와 등록된 <strong>각 지사 좌표</strong>의 거리를 검사합니다.<br />
          📌 한 곳이라도 허용 반경 이내면 통과. 전부 밖이면 차단 (admin도 동일하게 적용).<br />
          ⭐ 기본(primary) 지사는 별표 — 거리 검사 우선순위는 없고 표시·기록용입니다.
        </div>
      </div>

      {adding && (
        <BranchModal
          onClose={() => setAdding(false)}
          onSubmit={async (b) => {
            const ok = await addBranch(b);
            if (ok) setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/* ─────────── 지사 행 (인라인 편집) ─────────── */
function BranchRow({
  office,
  busy,
  onPatch,
  onDelete,
  onSetPrimary,
}: {
  office: Office;
  busy: boolean;
  onPatch: (p: Partial<Office>) => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Office>(office);

  function commit() {
    if (draft.name !== office.name || draft.address !== office.address || draft.lat !== office.lat || draft.lng !== office.lng || draft.radiusM !== office.radiusM) {
      onPatch({
        name: draft.name,
        address: draft.address,
        lat: draft.lat,
        lng: draft.lng,
        radiusM: draft.radiusM,
      });
    }
    setEditing(false);
  }

  function pickHere() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDraft({ ...draft, lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (err) => alert("위치 가져오기 실패: " + (err.message ?? "")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!editing) {
    return (
      <div
        className={clsx(
          "border rounded-lg p-3 transition",
          office.isPrimary ? "border-brand-300 bg-brand-50/40" : "border-slate-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {office.isPrimary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
              <span className="font-semibold text-[14px] text-slate-800 truncate">{office.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tabular-nums">
                반경 {office.radiusM}m
              </span>
            </div>
            {office.address && (
              <div className="text-[11.5px] text-slate-500 mt-0.5 truncate">{office.address}</div>
            )}
            <div className="text-[10.5px] text-slate-400 font-mono mt-1 tabular-nums">
              {office.lat.toFixed(6)}, {office.lng.toFixed(6)}
              <a
                href={`https://www.google.com/maps/place/${office.lat},${office.lng}/@${office.lat},${office.lng},17z`}
                target="_blank"
                rel="noopener"
                className="ml-2 text-brand-600 hover:underline"
              >
                지도 ↗
              </a>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!office.isPrimary && (
              <button
                onClick={onSetPrimary}
                disabled={busy}
                title="기본 지사로 설정"
                className="h-7 px-2 text-[11px] text-amber-600 hover:bg-amber-50 rounded inline-flex items-center gap-1"
              >
                <Star className="w-3.5 h-3.5" /> 기본
              </button>
            )}
            <button
              onClick={() => {
                setDraft(office);
                setEditing(true);
              }}
              disabled={busy}
              className="h-7 px-2 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
            >
              편집
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded inline-flex items-center justify-center"
              title="삭제"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-brand-300 rounded-lg p-3 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-slate-400">이름</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full h-8 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">허용 반경 (m)</label>
          <input
            type="number"
            value={draft.radiusM}
            onChange={(e) => setDraft({ ...draft, radiusM: Number(e.target.value) })}
            className="w-full h-8 px-2 text-[13px] tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-400">주소</label>
          <input
            value={draft.address ?? ""}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className="w-full h-8 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">위도</label>
          <input
            value={String(draft.lat ?? "")}
            onChange={(e) => setDraft({ ...draft, lat: Number(e.target.value) })}
            className="w-full h-8 px-2 text-[12px] font-mono tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400">경도</label>
          <input
            value={String(draft.lng ?? "")}
            onChange={(e) => setDraft({ ...draft, lng: Number(e.target.value) })}
            className="w-full h-8 px-2 text-[12px] font-mono tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button
          onClick={pickHere}
          className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-100 rounded inline-flex items-center gap-1"
        >
          <Navigation className="w-3 h-3" /> 현재 위치 가져오기
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(false)}
            className="h-7 px-2.5 text-[11px] text-slate-600 hover:bg-slate-100 rounded"
          >
            취소
          </button>
          <button
            onClick={commit}
            disabled={busy}
            className="h-7 px-2.5 bg-brand-600 hover:bg-brand-700 text-white text-[11px] rounded inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 저장
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 지사 추가 모달 ─────────── */
function BranchModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (b: Omit<Office, "id">) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("200");
  const [saving, setSaving] = useState(false);

  function pickHere() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 서비스를 지원하지 않습니다");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
      },
      (err) => alert("위치 가져오기 실패: " + (err.message ?? "")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit() {
    if (!name.trim()) {
      alert("이름을 입력하세요");
      return;
    }
    const latN = Number(lat);
    const lngN = Number(lng);
    const rN = Number(radius);
    if (isNaN(latN) || isNaN(lngN) || isNaN(rN)) {
      alert("위도/경도/반경은 숫자여야 합니다");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), address: address.trim(), lat: latN, lng: lngN, radiusM: rN });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-brand-500" /> 지사 추가
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-400">이름 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 남구 지사"
              autoFocus
              className="w-full h-9 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">주소</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 울산광역시 남구 화합로 138"
              className="w-full h-9 px-2 text-[13px] border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">위도</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="35.539"
                className="w-full h-9 px-2 text-[12px] font-mono tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">경도</label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="129.330"
                className="w-full h-9 px-2 text-[12px] font-mono tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-400">허용 반경 (m)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full h-9 px-2 text-[13px] tabular-nums border border-slate-200 rounded outline-none focus:border-brand-300"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={pickHere}
            className="h-8 px-2 text-[11px] text-slate-700 hover:bg-slate-100 rounded inline-flex items-center gap-1"
          >
            <Navigation className="w-3 h-3" /> 현재 위치 가져오기
          </button>
          <div className="flex gap-1.5">
            <button onClick={onClose} className="h-8 px-3 text-[12px] text-slate-600 hover:bg-slate-100 rounded">
              취소
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="h-8 px-3 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded inline-flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
