"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileSignature, X, Send, Search, CheckCircle2, AlertCircle, Loader2, Copy, Trash2, FileText, Paperclip } from "lucide-react";
import clsx from "clsx";

type Contract = {
  id: string;
  title: string;
  category: string | null;
  dept: string | null;
  projectId: string | null;
  fileUrl: string | null;
  fileName: string | null;
  message: string | null;
  use2FA: boolean;
  recipientUserId: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  deliveryMethod: string | null;
  stage: string;
  requestedAt: string | null;
  signedAt: string | null;
  signatureUrl: string | null;
  createdAt: string;
};

type User = { id: string; name: string; empNo: string; dept: string; position: string; email: string | null; mobile: string | null };
type Project = { id: string; title: string; displayCode: string | null; year: number };

const CATEGORIES = ["표준근로계약서", "표준근로계약서(시간제)", "표준근로계약서(정규 월급제)", "비밀유지서약서", "외주용역계약서", "기타"];
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

const STAGE_META: Record<string, { label: string; color: string }> = {
  draft: { label: "수신정보입력", color: "bg-slate-100 text-slate-700" },
  requested: { label: "요청완료", color: "bg-amber-100 text-amber-800" },
  signed: { label: "서명완료", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "요청취소", color: "bg-slate-100 text-slate-500" },
  rejected: { label: "반려", color: "bg-rose-100 text-rose-700" },
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

export default function ContractsClient({
  initialContracts,
  users,
  projects,
}: {
  initialContracts: Contract[];
  users: User[];
  projects: Project[];
}) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: contracts.length };
    for (const s of Object.keys(STAGE_META)) c[s] = 0;
    for (const k of contracts) c[k.stage] = (c[k.stage] ?? 0) + 1;
    return c;
  }, [contracts]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (stageFilter && c.stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [c.title, c.category, c.recipientName, c.dept].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, stageFilter, search]);

  async function onCreated(c: Contract) {
    setContracts((prev) => [c, ...prev]);
    setCreating(false);
    setEditing(c);
    router.refresh();
  }
  async function onPatched(c: Contract) {
    setContracts((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    router.refresh();
  }
  async function onDelete(id: string) {
    if (!confirm("이 계약서를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setContracts((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">전자근로계약</h1>
          <p className="text-xs text-slate-500 mt-1">계약서 작성 → 수신자 지정 → 서명 요청 → 완료 단계로 진행됩니다</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> 신규 계약서
        </button>
      </div>

      {/* 진행단계 탭 */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
        <StageTab active={stageFilter === ""} onClick={() => setStageFilter("")} count={counts.all}>
          전체
        </StageTab>
        {Object.entries(STAGE_META).map(([k, m]) => (
          <StageTab
            key={k}
            active={stageFilter === k}
            onClick={() => setStageFilter(k)}
            count={counts[k] ?? 0}
          >
            {m.label}
          </StageTab>
        ))}
      </div>

      {/* 검색 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="계약서명, 수신자, 부서..."
            className="h-7 pl-7 pr-3 rounded text-xs bg-slate-100 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none w-64"
          />
        </div>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{filtered.length} / {contracts.length}건</span>
      </div>

      {/* 표 */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-[11px] text-slate-500 font-medium border-b border-slate-200">
              <th className="text-left px-3 py-2.5 w-10">No</th>
              <th className="text-left px-3 py-2.5 w-28">일자</th>
              <th className="text-left px-3 py-2.5">계약서명</th>
              <th className="text-left px-3 py-2.5 w-32">진행단계</th>
              <th className="text-left px-3 py-2.5 w-28">수신자</th>
              <th className="text-left px-3 py-2.5 w-32">구분명</th>
              <th className="text-center px-3 py-2.5 w-24">문서</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const sm = STAGE_META[c.stage] ?? { label: c.stage, color: "bg-slate-100 text-slate-600" };
              return (
                <tr
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer transition group"
                >
                  <td className="text-center text-[10px] text-slate-400 tabular-nums px-2 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums">
                    {fmtDate(c.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{c.title}</td>
                  <td className="px-3 py-2">
                    <span className={clsx("px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap", sm.color)}>
                      {sm.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {c.recipientName ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-[11px]">{c.category ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {c.fileUrl ? (
                      <a
                        href={c.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700"
                      >
                        <FileText className="w-3 h-3" /> 보기
                      </a>
                    ) : (
                      <span className="text-slate-300 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-1 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                  표시할 계약서가 없습니다. 「+ 신규 계약서」로 시작하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <ContractFormModal
          isCreating
          users={users}
          projects={projects}
          onClose={() => setCreating(false)}
          onSaved={onCreated}
        />
      )}
      {editing && (
        <ContractFormModal
          isCreating={false}
          contract={editing}
          users={users}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            onPatched(c);
            setEditing(c);
          }}
        />
      )}
    </div>
  );
}

function StageTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5",
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-800"
      )}
    >
      {children}
      <span
        className={clsx(
          "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-medium",
          active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ─────────── 계약서 작성/수정 모달 ─────────── */

function ContractFormModal({
  isCreating,
  contract,
  users,
  projects,
  onClose,
  onSaved,
}: {
  isCreating: boolean;
  contract?: Contract;
  users: User[];
  projects: Project[];
  onClose: () => void;
  onSaved: (c: Contract) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Partial<Contract>>(
    contract ?? { title: "", category: "표준근로계약서", use2FA: false, stage: "draft" }
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [showUserPicker, setShowUserPicker] = useState(false);

  function set(k: keyof Contract, v: any) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        set("fileUrl", json.fileUrl);
        set("fileName", json.fileName);
      } else {
        alert("업로드 실패: " + json.error);
      }
    } catch (e: any) {
      alert("업로드 실패: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft.title) {
      alert("계약서명을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const url = isCreating ? "/api/contracts" : `/api/contracts/${contract!.id}`;
      const method = isCreating ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("저장 실패: " + (json.error ?? "오류"));
      } else {
        onSaved(json);
        if (isCreating) onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendRequest() {
    if (!draft.recipientName) {
      alert("먼저 수신자(인사관리 직원)를 지정하세요.");
      return;
    }
    if (!draft.fileUrl) {
      alert("계약서 PDF를 첨부하세요.");
      return;
    }
    set("stage", "requested");
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contract!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, stage: "requested" }),
      });
      const json = await res.json();
      if (res.ok) {
        onSaved(json);
        alert("계약서 요청이 발송되었습니다.");
      } else {
        alert("요청 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  const userMatches = userSearch
    ? users.filter(
        (u) =>
          u.name.includes(userSearch) ||
          u.empNo.includes(userSearch) ||
          u.dept.includes(userSearch)
      ).slice(0, 8)
    : users.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileSignature className="w-4 h-4" />
            {isCreating ? "계약서 입력" : "계약서 수정"}
            {!isCreating && contract && (
              <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded">
                {STAGE_META[contract.stage]?.label}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {/* 기본 정보 */}
          <Field label="계약서명" required>
            <input
              value={draft.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              className="form-input"
              placeholder="예: 강혜인_표준근로계약서"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="구분">
              <select
                value={draft.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
                className="form-input"
              >
                <option value="">— 선택 —</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="부서">
              <select
                value={draft.dept ?? ""}
                onChange={(e) => set("dept", e.target.value)}
                className="form-input"
              >
                <option value="">— 선택 —</option>
                {DEPTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="프로젝트">
            <select
              value={draft.projectId ?? ""}
              onChange={(e) => set("projectId", e.target.value)}
              className="form-input"
            >
              <option value="">— 없음 —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.year} · {p.displayCode ?? ""} {p.title}
                </option>
              ))}
            </select>
          </Field>

          {/* 첨부 PDF */}
          <Field label="첨부 (PDF)">
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.hwp,.hwpx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="h-10 px-3 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                파일 선택
              </button>
              {draft.fileUrl ? (
                <a
                  href={draft.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 truncate"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {draft.fileName ?? draft.fileUrl}
                </a>
              ) : (
                <span className="text-[11px] text-slate-400">파일 미선택</span>
              )}
            </div>
          </Field>

          {/* 수신자 (인사관리에서 검색) */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="inline-block w-1 h-3 bg-brand-500 rounded-sm" />
              수신정보 입력
            </h3>

            <Field label="수신자 (직원 검색)">
              <div className="relative">
                <input
                  value={userSearch || draft.recipientName || ""}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    set("recipientName", e.target.value);
                    setShowUserPicker(true);
                  }}
                  onFocus={() => setShowUserPicker(true)}
                  placeholder="이름, 사원번호, 부서로 검색..."
                  className="form-input"
                />
                {showUserPicker && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowUserPicker(false)} />
                    <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-auto">
                      {userMatches.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            set("recipientUserId", u.id);
                            set("recipientName", u.name);
                            set("recipientEmail", u.email);
                            set("recipientPhone", u.mobile);
                            setUserSearch("");
                            setShowUserPicker(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {u.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-800">
                              {u.name}{" "}
                              <span className="text-slate-400 font-normal text-[10px]">
                                {u.empNo}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {u.dept} · {u.position}
                              {u.email && <span className="ml-1">· {u.email}</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                      {userMatches.length === 0 && (
                        <div className="px-3 py-3 text-center text-[11px] text-slate-400">
                          검색 결과 없음
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Email">
                <input
                  type="email"
                  value={draft.recipientEmail ?? ""}
                  onChange={(e) => set("recipientEmail", e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="연락처">
                <input
                  value={draft.recipientPhone ?? ""}
                  onChange={(e) => set("recipientPhone", e.target.value)}
                  className="form-input"
                  placeholder="010-0000-0000"
                />
              </Field>
            </div>

            <Field label="전달방식">
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { v: "email", l: "Email" },
                  { v: "sms", l: "SMS" },
                  { v: "kakao", l: "카카오톡" },
                  { v: "direct", l: "직접 서명" },
                ].map((opt) => (
                  <label key={opt.v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="dm"
                      checked={draft.deliveryMethod === opt.v}
                      onChange={() => set("deliveryMethod", opt.v)}
                      className="text-brand-600"
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="전달 메시지">
              <textarea
                value={draft.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
                rows={2}
                className="form-input min-h-[64px] py-2 resize-none"
                placeholder="수신자에게 전달할 안내 메시지"
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-slate-600 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!draft.use2FA}
                onChange={(e) => set("use2FA", e.target.checked)}
                className="rounded border-slate-300 text-brand-600"
              />
              2차 인증 사용
            </label>
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-md flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              저장(F8)
            </button>
            {!isCreating && contract?.stage === "draft" && (
              <button
                onClick={sendRequest}
                disabled={saving}
                className="h-9 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-medium rounded-md flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> 서명 요청 발송
              </button>
            )}
          </div>
          <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
            닫기
          </button>
        </div>
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
        select.form-input { padding-right: 24px; cursor: pointer; }
      `}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-600 mb-1.5 flex items-center gap-0.5">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
