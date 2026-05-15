"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Printer, X, UserPlus, FileText, FileBadge } from "lucide-react";
import clsx from "clsx";
import UserModal from "@/components/UserModal";
import EmployeeCardModal from "@/components/EmployeeCardModal";
import CertificateModal from "@/components/CertificateModal";
import { maskResident } from "@/lib/format";

export type User = {
  id: string;
  empNo: string;
  name: string;
  residentNo: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  dept: string;
  position: string;
  positionTitle: string | null;
  role: string;
  pmCode: string | null;
  joinDate: string | null;
  joinType: string | null;
  leaveDate: string | null;
  leaveReason: string | null;
  status: string;
  bankName: string | null;
  accountNo: string | null;
  accountHolder: string | null;
  postCode: string | null;
  address: string | null;
  passportNo: string | null;
  isInternal?: boolean;
  consultantGrade?: string | null;
  consultantRate?: string | null; // BigInt → string when serialized
};

const DEPTS = [
  "CEO",
  "사업운영본부",
  "글로벌사업본부",
  "기술사업화본부",
  "HRD사업본부",
  "신사업/연구개발본부",
  "부산지사",
  "경남지사",
];

const POSITIONS = [
  "대표이사",
  "부대표",
  "전무이사",
  "이사",
  "감사",
  "책임연구원",
  "전문위원",
  "연구원",
  "인턴",
];

function fmtDate(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 10).replaceAll("-", "/");
}

export default function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [printUser, setPrintUser] = useState<User | null>(null);
  const [certUser, setCertUser] = useState<{ user: User; type: "employment" | "career" } | null>(null);
  // 상태 필터: '' = 전체, 'active' = 재직, 'inactive' = 퇴사, 'leave' = 휴직
  const [filterStatus, setFilterStatus] = useState<string>("active");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterDept && u.dept !== filterDept) return false;
      if (filterPosition && u.position !== filterPosition) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [u.name, u.empNo, u.email, u.dept, u.position, u.mobile, u.phone, u.accountNo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, filterDept, filterPosition, filterStatus, search]);

  const statusCounts = useMemo(() => {
    const c = { active: 0, inactive: 0, leave: 0 };
    for (const u of users) {
      if (u.status === "active") c.active++;
      else if (u.status === "inactive") c.inactive++;
      else if (u.status === "leave") c.leave++;
    }
    return c;
  }, [users]);

  async function handleSave(payload: Partial<User>, userId?: string) {
    if (userId) {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert("저장 실패");
        return;
      }
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
    } else {
      const res = await fetch(`/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "생성 실패");
        return;
      }
      const created = await res.json();
      setUsers((prev) => [...prev, created]);
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function handleDelete(userId: string) {
    if (!confirm("이 직원을 비활성화하시겠습니까?")) return;
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    if (!res.ok) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="px-6 py-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">직원 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            인사카드 등록 · 총 <span className="font-medium text-slate-700">{users.length}</span>명 · 표시 <span className="font-medium text-slate-700">{filtered.length}</span>명
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> 새 직원
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 사원번호, 이메일, 계좌번호..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-64"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className={clsx(
            "h-7 text-xs px-2 rounded border bg-white cursor-pointer",
            filterDept ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600"
          )}
        >
          <option value="">전체 부서</option>
          {DEPTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
          className={clsx(
            "h-7 text-xs px-2 rounded border bg-white cursor-pointer",
            filterPosition ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600"
          )}
        >
          <option value="">전체 직위</option>
          {POSITIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={clsx(
            "h-7 text-xs px-2 rounded border bg-white cursor-pointer",
            filterStatus ? "border-brand-300 text-brand-700 bg-brand-50" : "border-slate-200 text-slate-600"
          )}
          title="재직 상태"
        >
          <option value="">전체 ({users.length})</option>
          <option value="active">재직 ({statusCounts.active})</option>
          <option value="leave">휴직 ({statusCounts.leave})</option>
          <option value="inactive">퇴사 ({statusCounts.inactive})</option>
        </select>
        {(filterDept || filterPosition || filterStatus !== "active" || search) && (
          <button
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 h-7"
            onClick={() => {
              setFilterDept("");
              setFilterPosition("");
              setFilterStatus("active");
              setSearch("");
            }}
          >
            <X className="w-3 h-3" /> 초기화
          </button>
        )}
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="text-xs w-full">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-slate-500 text-[11px] font-medium border-b border-slate-200">
                <th className="text-center px-2 py-2.5 w-10">No</th>
                <th className="text-left px-2.5 py-2.5 w-24">사원번호</th>
                <th className="text-left px-2.5 py-2.5 w-20">성명</th>
                <th className="text-center px-2.5 py-2.5 w-16">상태</th>
                <th className="text-left px-2.5 py-2.5 w-32">주민등록번호</th>
                <th className="text-left px-2.5 py-2.5 w-40">부서명</th>
                <th className="text-left px-2.5 py-2.5 w-28">직위/직급명</th>
                <th className="text-left px-2.5 py-2.5 w-24">입사일자</th>
                <th className="text-left px-2.5 py-2.5 w-40">계좌번호</th>
                <th className="text-left px-2.5 py-2.5">Email</th>
                <th className="w-24 text-center px-2 py-2.5">재직증명서</th>
                <th className="w-24 text-center px-2 py-2.5">경력증명서</th>
                <th className="w-16 text-center px-2 py-2.5">인쇄</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  onClick={() => setEditing(u)}
                  className="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer transition"
                >
                  <td className="text-center text-[10px] text-slate-400 tabular-nums px-2 py-1.5">{i + 1}</td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-brand-700 font-medium">{u.empNo}</td>
                  <td className={clsx("px-2.5 py-1.5 font-medium", u.status === "inactive" ? "text-slate-400" : "text-slate-800")}>
                    {u.name}
                  </td>
                  <td className="text-center px-2 py-1.5">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 tabular-nums">{u.residentNo ? maskResident(u.residentNo) : "—"}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{u.dept}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{u.position}</td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 tabular-nums">{fmtDate(u.joinDate)}</td>
                  <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 tabular-nums">{u.accountNo ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-slate-600 text-[11px]">{u.email ?? "—"}</td>
                  <td
                    className="text-center px-2 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCertUser({ user: u, type: "employment" });
                    }}
                  >
                    <button className="text-[11px] text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 inline-flex items-center gap-1 px-2 py-1 rounded font-medium">
                      <FileText className="w-3.5 h-3.5" /> 재직
                    </button>
                  </td>
                  <td
                    className="text-center px-2 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCertUser({ user: u, type: "career" });
                    }}
                  >
                    <button className="text-[11px] text-violet-600 hover:text-violet-800 hover:bg-violet-50 inline-flex items-center gap-1 px-2 py-1 rounded font-medium">
                      <FileBadge className="w-3.5 h-3.5" /> 경력
                    </button>
                  </td>
                  <td
                    className="text-center px-2 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrintUser(u);
                    }}
                  >
                    <button className="text-[11px] text-slate-400 hover:text-brand-600 inline-flex items-center gap-1">
                      <Printer className="w-3.5 h-3.5" /> 인쇄
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                    표시할 직원이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editing || creating) && (
        <UserModal
          user={editing}
          isCreating={creating}
          depts={DEPTS}
          positions={POSITIONS}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {printUser && (
        <EmployeeCardModal user={printUser} onClose={() => setPrintUser(null)} />
      )}

      {certUser && (
        <CertificateModal
          user={certUser.user}
          type={certUser.type}
          onClose={() => setCertUser(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string }> = {
    active: { label: "재직", color: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
    leave: { label: "휴직", color: "bg-amber-100 text-amber-700 ring-amber-200" },
    inactive: { label: "퇴사", color: "bg-slate-200 text-slate-500 ring-slate-300" },
  };
  const m = meta[status] ?? { label: status, color: "bg-slate-100 text-slate-500 ring-slate-200" };
  return (
    <span className={clsx("inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium", m.color)}>
      {m.label}
    </span>
  );
}
