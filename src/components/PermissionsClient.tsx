"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Save, Loader2, RotateCcw, Eye, Edit3, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

type Permission = {
  id: string;
  role: string;
  section: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const SECTIONS = [
  { key: "dashboard", label: "대시보드", group: "메인" },
  { key: "projects", label: "프로젝트 관리", group: "사업" },
  { key: "managers", label: "담당자별 관리", group: "사업" },
  { key: "companies", label: "업체/거래처", group: "사업" },
  { key: "invoices", label: "세금계산서", group: "사업" },
  { key: "card_purchases", label: "카드매입", group: "사업" },
  { key: "expenses", label: "지출결의", group: "결재" },
  { key: "contracts", label: "전자근로계약", group: "인사관리" },
  { key: "users", label: "직원 관리", group: "인사관리" },
  { key: "accounts", label: "계정관리", group: "시스템" },
  { key: "permissions", label: "권한관리", group: "시스템" },
  { key: "settings", label: "설정", group: "시스템" },
];

const ROLES = [
  { value: "admin", label: "관리자", color: "bg-rose-100 text-rose-800 ring-rose-200", locked: true },
  { value: "manager", label: "매니저", color: "bg-amber-100 text-amber-800 ring-amber-200", locked: false },
  { value: "staff", label: "직원", color: "bg-slate-100 text-slate-700 ring-slate-200", locked: false },
];

type Key = `${string}__${string}`;
const key = (role: string, section: string): Key => `${role}__${section}` as Key;

export default function PermissionsClient({ initialPerms }: { initialPerms: Permission[] }) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<Record<Key, { canView: boolean; canEdit: boolean; canDelete: boolean }>>(() => {
    const m: any = {};
    for (const p of initialPerms) {
      m[key(p.role, p.section)] = { canView: p.canView, canEdit: p.canEdit, canDelete: p.canDelete };
    }
    // 누락된 (role × section) 채우기
    for (const r of ROLES) {
      for (const s of SECTIONS) {
        if (!m[key(r.value, s.key)]) {
          m[key(r.value, s.key)] = { canView: false, canEdit: false, canDelete: false };
        }
      }
    }
    return m;
  });
  const [original, setOriginal] = useState(matrix);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = useMemo(() => JSON.stringify(matrix) !== JSON.stringify(original), [matrix, original]);

  function toggle(role: string, section: string, action: "canView" | "canEdit" | "canDelete") {
    if (role === "admin") return; // admin은 항상 모든 권한
    setMatrix((prev) => {
      const k = key(role, section);
      const cur = prev[k];
      const next = { ...cur, [action]: !cur[action] };
      // edit/delete 활성화하면 view도 자동 활성화
      if ((action === "canEdit" || action === "canDelete") && next[action]) {
        next.canView = true;
      }
      // view 끄면 edit/delete도 같이 끔
      if (action === "canView" && !next.canView) {
        next.canEdit = false;
        next.canDelete = false;
      }
      return { ...prev, [k]: next };
    });
  }

  function reset() {
    setMatrix(original);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        permissions: ROLES.flatMap((r) =>
          SECTIONS.map((s) => ({
            role: r.value,
            section: s.key,
            ...matrix[key(r.value, s.key)],
          }))
        ),
      };
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? "저장 실패" });
        return;
      }
      setOriginal(matrix);
      setMessage({ ok: true, text: `${json.count}건 권한이 저장되었습니다.` });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const groups = useMemo(() => {
    const g: Record<string, typeof SECTIONS> = {};
    for (const s of SECTIONS) {
      if (!g[s.group]) g[s.group] = [];
      g[s.group].push(s);
    }
    return g;
  }, []);

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">권한관리</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">섹션별 권한 설정</h1>
          <p className="text-xs text-slate-500 mt-1">
            역할(admin / manager / staff)별로 메뉴 접근·편집·삭제 권한을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={!dirty || saving}
            className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-md flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 변경 취소
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장 ({dirty ? "변경됨" : "변경 없음"})
          </button>
        </div>
      </div>

      {message && (
        <div
          className={clsx(
            "mb-3 px-3 py-2 rounded border text-xs flex items-center gap-2",
            message.ok
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          )}
        >
          {message.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}

      {/* 매트릭스 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
              <th className="text-left px-3 py-2.5 w-44">섹션</th>
              {ROLES.map((r) => (
                <th key={r.value} className="text-center px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5">
                    <span className={clsx("px-2 py-0.5 rounded ring-1 font-medium", r.color)}>
                      {r.label}
                    </span>
                    {r.locked && <span className="text-[9px] text-slate-400">(고정)</span>}
                  </div>
                  <div className="flex justify-center gap-3 text-[10px] text-slate-400 mt-1 font-normal">
                    <span className="inline-flex items-center gap-0.5 w-12 justify-center">
                      <Eye className="w-2.5 h-2.5" /> 조회
                    </span>
                    <span className="inline-flex items-center gap-0.5 w-12 justify-center">
                      <Edit3 className="w-2.5 h-2.5" /> 편집
                    </span>
                    <span className="inline-flex items-center gap-0.5 w-12 justify-center">
                      <Trash2 className="w-2.5 h-2.5" /> 삭제
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([gname, gsections]) => (
              <>
                <tr key={`g-${gname}`} className="bg-slate-50/50">
                  <td colSpan={ROLES.length + 1} className="px-3 py-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {gname}
                    </span>
                  </td>
                </tr>
                {gsections.map((s) => (
                  <tr key={s.key} className="border-b border-slate-100 hover:bg-slate-50/30">
                    <td className="px-3 py-2 font-medium text-slate-800">{s.label}</td>
                    {ROLES.map((r) => {
                      const p = matrix[key(r.value, s.key)];
                      const locked = r.locked;
                      return (
                        <td key={r.value} className="px-3 py-2">
                          <div className="flex justify-center gap-3">
                            <Check value={p.canView} onClick={() => toggle(r.value, s.key, "canView")} locked={locked} />
                            <Check value={p.canEdit} onClick={() => toggle(r.value, s.key, "canEdit")} locked={locked} />
                            <Check value={p.canDelete} onClick={() => toggle(r.value, s.key, "canDelete")} locked={locked} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
        💡 <strong>관리자(admin)</strong>는 항상 모든 권한을 가집니다 (변경 불가).<br />
        💡 <strong>편집/삭제</strong>를 켜면 <strong>조회</strong>는 자동 활성화됩니다. <strong>조회</strong>를 끄면 편집·삭제도 함께 꺼집니다.<br />
        💡 변경 후 반드시 <strong>저장</strong>을 눌러야 적용됩니다.
      </p>
    </div>
  );
}

function Check({ value, onClick, locked }: { value: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={clsx(
        "w-12 h-6 rounded transition flex items-center justify-center",
        locked && "cursor-not-allowed opacity-70",
        !locked && "cursor-pointer hover:ring-2 hover:ring-brand-200",
        value
          ? "bg-emerald-500 text-white"
          : "bg-slate-100 text-slate-300 hover:bg-slate-200"
      )}
    >
      {value ? "✓" : "—"}
    </button>
  );
}
