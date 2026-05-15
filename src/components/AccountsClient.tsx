"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  UserPlus,
  Lock,
  Unlock,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";

type User = {
  id: string;
  empNo: string;
  name: string;
  email: string | null;
  dept: string;
  position: string;
  role: string;
  pmCode: string | null;
  status: string;
  hasPassword: boolean;
};

const ROLE_META: Record<string, { label: string; color: string; desc: string }> = {
  admin: { label: "관리자", color: "bg-rose-100 text-rose-800", desc: "모든 권한" },
  manager: { label: "매니저", color: "bg-amber-100 text-amber-800", desc: "결재·관리" },
  staff: { label: "직원", color: "bg-slate-100 text-slate-700", desc: "기본 조회/편집" },
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "활성", color: "bg-emerald-100 text-emerald-700" },
  inactive: { label: "비활성", color: "bg-slate-100 text-slate-500" },
  leave: { label: "휴직", color: "bg-amber-100 text-amber-700" },
};

export default function AccountsClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [hasPwFilter, setHasPwFilter] = useState<"" | "yes" | "no">("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (hasPwFilter === "yes" && !u.hasPassword) return false;
      if (hasPwFilter === "no" && u.hasPassword) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [u.name, u.empNo, u.email, u.dept, u.position, u.pmCode]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, hasPwFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "active");
    return {
      total: users.length,
      active: active.length,
      withPw: users.filter((u) => u.hasPassword).length,
      admin: users.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  async function refreshList() {
    const res = await fetch("/api/accounts");
    if (res.ok) {
      const list = await res.json();
      setUsers(list);
    }
    router.refresh();
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">계정관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            전체 {stats.total}명 · 활성 {stats.active}명 · 비번 설정 {stats.withPw}명 · 관리자 {stats.admin}명
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> 신규 계정 생성
        </button>
      </div>

      {/* 로그인 ID 안내 */}
      <div className="mb-3 px-3 py-2 bg-brand-50/50 border border-brand-200 rounded-lg text-[11.5px] text-brand-800 flex items-start gap-2">
        <KeyRound className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>로그인 ID = 회사 이메일</strong> (@daedongcmc.com). 직원에게 비번을 발급할 때 표의「로그인 ID」컬럼을 알려주세요. 이메일이 미설정이면 우측 [비번/권한 변경]에서 입력할 수 있습니다.
        </span>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 사원번호, 이메일, 부서..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-64"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={clsx(
            "h-7 text-xs px-2 rounded border bg-white cursor-pointer",
            roleFilter ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600"
          )}
        >
          <option value="">전체 권한</option>
          <option value="admin">관리자</option>
          <option value="manager">매니저</option>
          <option value="staff">직원</option>
        </select>
        <select
          value={hasPwFilter}
          onChange={(e) => setHasPwFilter(e.target.value as any)}
          className={clsx(
            "h-7 text-xs px-2 rounded border bg-white cursor-pointer",
            hasPwFilter ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600"
          )}
        >
          <option value="">전체</option>
          <option value="yes">비번 설정됨</option>
          <option value="no">미설정</option>
        </select>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
          {filtered.length} / {users.length}명
        </span>
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
              <th className="text-left px-3 py-2.5 w-10">No</th>
              <th className="text-left px-3 py-2.5 w-20">사원번호</th>
              <th className="text-left px-3 py-2.5 w-24">성명</th>
              <th className="text-left px-3 py-2.5 w-72">로그인 ID (회사 이메일)</th>
              <th className="text-left px-3 py-2.5 w-36">부서</th>
              <th className="text-left px-3 py-2.5 w-24">직위</th>
              <th className="text-center px-3 py-2.5 w-20">권한</th>
              <th className="text-center px-3 py-2.5 w-20">비밀번호</th>
              <th className="text-center px-3 py-2.5 w-20">상태</th>
              <th className="text-center px-3 py-2.5 w-28">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => {
              const r = ROLE_META[u.role] ?? { label: u.role, color: "bg-slate-100", desc: "" };
              const s = STATUS_META[u.status] ?? { label: u.status, color: "bg-slate-100" };
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="text-center text-[10px] text-slate-400 px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{u.empNo}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {u.name} {isSelf && <span className="text-[10px] text-brand-600">(나)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {u.email ? (
                      <span className="font-mono text-[11.5px] text-brand-700 font-medium select-all">
                        {u.email}
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-rose-500 italic">미설정 — 관리 버튼에서 입력</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{u.dept}</td>
                  <td className="px-3 py-2 text-slate-700">{u.position}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={clsx("px-2 py-0.5 rounded text-[11px] font-medium", r.color)}
                      title={r.desc}
                    >
                      {r.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {u.hasPassword ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> 설정됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <ShieldAlert className="w-3.5 h-3.5" /> 미설정
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={clsx("px-2 py-0.5 rounded text-[10.5px] font-medium", s.color)}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-[11px] text-brand-600 hover:text-brand-800 hover:underline"
                    >
                      비번/권한 변경
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                  조건에 맞는 계정이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateAccountModal
          users={users}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refreshList();
          }}
        />
      )}
      {editing && (
        <EditAccountModal
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onUpdated={() => {
            setEditing(null);
            refreshList();
          }}
        />
      )}
    </div>
  );
}

/* ─────────── 신규 계정 모달 ─────────── */

function CreateAccountModal({
  users,
  onClose,
  onCreated,
}: {
  users: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [pickUserId, setPickUserId] = useState("");
  const [name, setName] = useState("");
  const [empNo, setEmpNo] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("시스템");
  const [position, setPosition] = useState("관리자");
  const [role, setRole] = useState("staff");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingNoPw = users.filter((u) => !u.hasPassword && u.status === "active");

  async function submit() {
    setError(null);
    if (!password || password.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = { password, role };
      if (mode === "existing") {
        if (!pickUserId) {
          setError("직원을 선택하세요.");
          setSaving(false);
          return;
        }
        payload.userId = pickUserId;
      } else {
        if (!name) {
          setError("이름을 입력하세요.");
          setSaving(false);
          return;
        }
        payload.name = name;
        if (empNo) payload.empNo = empNo;
        payload.email = email || null;
        payload.dept = dept;
        payload.position = position;
      }
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "생성 실패");
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="신규 계정 생성" onClose={onClose}>
      {/* 모드 선택 */}
      <div className="flex items-center gap-2 mb-4">
        <ModeBtn active={mode === "existing"} onClick={() => setMode("existing")}>
          기존 직원에 비번 부여
        </ModeBtn>
        <ModeBtn active={mode === "new"} onClick={() => setMode("new")}>
          신규 직원+계정 동시 생성
        </ModeBtn>
      </div>

      {mode === "existing" ? (
        <div className="space-y-3">
          <Field label="직원 선택">
            <select
              value={pickUserId}
              onChange={(e) => setPickUserId(e.target.value)}
              className="form-input"
            >
              <option value="">— 선택 ({existingNoPw.length}명) —</option>
              {existingNoPw.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.empNo} · {u.name} ({u.dept} {u.position})
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[11px] text-slate-500">
            💡 비밀번호가 아직 설정 안 된 활성 직원만 표시됩니다. 이미 설정된 직원의 비번 변경은 표에서 「비번/권한 변경」을 사용하세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="성명 *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
          </Field>
          <Field label="사원번호 (비우면 자동)">
            <input value={empNo} onChange={(e) => setEmpNo(e.target.value)} className="form-input font-mono" />
          </Field>
          <Field label="이메일">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
          </Field>
          <Field label="부서">
            <input value={dept} onChange={(e) => setDept(e.target.value)} className="form-input" />
          </Field>
          <Field label="직위">
            <input value={position} onChange={(e) => setPosition(e.target.value)} className="form-input" />
          </Field>
        </div>
      )}

      <div className="border-t border-slate-100 mt-4 pt-4 grid grid-cols-2 gap-3">
        <Field label="권한 *">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
            <option value="staff">직원 (staff)</option>
            <option value="manager">매니저 (manager)</option>
            <option value="admin">관리자 (admin)</option>
          </select>
        </Field>
        <Field label="비밀번호 *">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="4자 이상"
            className="form-input font-mono"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <ModalFooter onClose={onClose}>
        <button
          onClick={submit}
          disabled={saving}
          className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          계정 생성
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ─────────── 비번/권한 변경 모달 ─────────── */

function EditAccountModal({
  user,
  isSelf,
  onClose,
  onUpdated,
}: {
  user: User;
  isSelf: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [email, setEmail] = useState(user.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: any) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "변경 실패");
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!newPassword || newPassword.length < 4) {
      setError("비밀번호는 4자 이상");
      return;
    }
    if (await patch({ password: newPassword })) onUpdated();
  }

  async function saveRoleStatus() {
    const data: any = {};
    if (role !== user.role) data.role = role;
    if (status !== user.status) data.status = status;
    if ((email || "").trim() !== (user.email ?? "").trim()) data.email = email.trim();
    if (Object.keys(data).length === 0) return onClose();
    if (await patch(data)) onUpdated();
  }

  async function clearPw() {
    if (!confirm("비밀번호를 제거하면 해당 계정으로 로그인이 불가능해집니다. 진행할까요?")) return;
    if (await patch({ clearPassword: true })) onUpdated();
  }

  return (
    <ModalShell title={`${user.name} 계정 관리`} onClose={onClose}>
      <div className="space-y-2 mb-4 px-3 py-2 bg-slate-50 rounded text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">사원번호</span>
          <span className="font-mono">{user.empNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">부서/직위</span>
          <span>{user.dept} · {user.position}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">현재 비밀번호</span>
          <span>{user.hasPassword ? "설정됨" : "미설정"}</span>
        </div>
      </div>

      {/* 로그인 ID (이메일) — 가장 중요 */}
      <div className="mb-4 p-3 bg-brand-50/50 border border-brand-200 rounded-lg">
        <Field label="로그인 ID (회사 이메일) ★">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="예: hjkim@daedongcmc.com"
            className="form-input font-mono"
          />
        </Field>
        <p className="text-[10.5px] text-brand-700 mt-1.5">
          이 이메일이 로그인 ID가 됩니다. 사원번호로도 로그인 가능하지만 이메일을 권장합니다.
        </p>
      </div>

      {/* 권한/상태 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label="권한">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="form-input">
            <option value="staff">직원 (staff)</option>
            <option value="manager">매니저 (manager)</option>
            <option value="admin">관리자 (admin)</option>
          </select>
        </Field>
        <Field label="상태">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="form-input"
            disabled={isSelf}
          >
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="leave">휴직</option>
          </select>
        </Field>
      </div>

      {/* 비밀번호 */}
      <div className="border-t border-slate-100 pt-4 mb-2">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
          <KeyRound className="w-3 h-3" /> 비밀번호 변경
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (4자 이상)"
            className="form-input font-mono flex-1"
          />
          <button
            onClick={savePassword}
            disabled={saving || !newPassword}
            className="h-9 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs rounded"
          >
            저장
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <ModalFooter onClose={onClose}>
        {user.hasPassword && (
          <button
            onClick={clearPw}
            disabled={saving}
            className="h-9 px-3 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded inline-flex items-center gap-1.5"
            title="해당 계정으로 로그인 불가하게 됨"
          >
            <Lock className="w-3 h-3" /> 비번 제거
          </button>
        )}
        <button
          onClick={saveRoleStatus}
          disabled={saving}
          className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          이메일·권한·상태 저장
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ─────────── 공용 ─────────── */

function ModalShell({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> {title}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
      <style jsx global>{`
        .form-input {
          height: 36px;
          width: 100%;
          padding: 0 10px;
          font-size: 12.5px;
          border: 1px solid rgb(226 232 240);
          border-radius: 6px;
          background: white;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.15s;
        }
        .form-input:focus {
          border-color: rgb(63 99 245);
          box-shadow: 0 0 0 3px rgba(63, 99, 245, 0.12);
        }
        .form-input:disabled { background: rgb(248 250 252); color: rgb(100 116 139); }
        select.form-input { padding-right: 24px; cursor: pointer; }
      `}</style>
    </div>
  );
}

function ModalFooter({ children, onClose }: any) {
  return (
    <div className="border-t border-slate-200 mt-4 pt-3 flex items-center justify-end gap-2 -mx-5 px-5 -mb-5 pb-5 bg-slate-50 rounded-b-xl">
      <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
        닫기
      </button>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-600 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function ModeBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 h-9 text-xs font-medium rounded border transition",
        active ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
      )}
    >
      {children}
    </button>
  );
}
