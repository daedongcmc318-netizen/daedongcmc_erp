"use client";
import { useEffect, useState } from "react";
import { X, Save, Trash2, Copy } from "lucide-react";
import clsx from "clsx";
import type { User } from "./UsersClient";

type Tab = "basic" | "extra" | "leave";

function dateToInput(d: string | null | undefined): string {
  if (!d) return "";
  return d.slice(0, 10);
}

export default function UserModal({
  user,
  isCreating,
  depts,
  positions,
  onClose,
  onSave,
  onDelete,
}: {
  user: User | null;
  isCreating: boolean;
  depts: string[];
  positions: string[];
  onClose: () => void;
  onSave: (payload: Partial<User>, userId?: string) => void | Promise<void>;
  onDelete: (userId: string) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("basic");
  const [draft, setDraft] = useState<Partial<User>>(() => user ?? { empNo: "", name: "", dept: "", position: "", role: "staff" });

  useEffect(() => {
    setDraft(user ?? { empNo: "", name: "", dept: "", position: "", role: "staff" });
    setTab("basic");
  }, [user, isCreating]);

  function set(k: keyof User, v: any) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function submit() {
    if (!draft.name) {
      alert("성명을 입력하세요");
      return;
    }
    if (!draft.dept || !draft.position) {
      alert("부서와 직위를 선택하세요");
      return;
    }
    onSave(draft, isCreating ? undefined : user?.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            인사카드 {isCreating ? "등록" : "수정"}
            {!isCreating && user && (
              <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                {user.empNo}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 pt-3 border-b border-slate-200">
          {(
            [
              { key: "basic", label: "기본" },
              { key: "extra", label: "추가정보" },
              { key: "leave", label: "퇴사/연차" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "px-3 py-2 text-xs font-medium rounded-t -mb-px border-b-2 transition",
                tab === t.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {tab === "basic" && (
            <div className="space-y-5">
              <Section title="기본 정보">
                <Grid>
                  <Field label="사원번호">
                    <input
                      type="text"
                      value={draft.empNo ?? ""}
                      onChange={(e) => set("empNo", e.target.value)}
                      placeholder="자동 생성됩니다"
                      className="form-input font-mono"
                    />
                  </Field>
                  <Field label="성명" required>
                    <input
                      type="text"
                      value={draft.name ?? ""}
                      onChange={(e) => set("name", e.target.value)}
                      className="form-input"
                      autoFocus
                    />
                  </Field>
                  <Field label="주민등록번호">
                    <input
                      type="text"
                      value={draft.residentNo ?? ""}
                      onChange={(e) => set("residentNo", e.target.value)}
                      placeholder="000000-0000000"
                      className="form-input font-mono"
                    />
                  </Field>
                  <Field label="입사일자">
                    <input
                      type="date"
                      value={dateToInput(draft.joinDate as any)}
                      onChange={(e) => set("joinDate", e.target.value || null)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="부서" required>
                    <select
                      value={draft.dept ?? ""}
                      onChange={(e) => set("dept", e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- 선택 --</option>
                      {depts.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="직위/직급" required>
                    <select
                      value={draft.position ?? ""}
                      onChange={(e) => set("position", e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- 선택 --</option>
                      {positions.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="직책">
                    <input
                      type="text"
                      value={draft.positionTitle ?? ""}
                      onChange={(e) => set("positionTitle", e.target.value)}
                      placeholder="팀장, 본부장 등"
                      className="form-input"
                    />
                  </Field>
                  <Field label="PM 코드">
                    <input
                      type="text"
                      value={draft.pmCode ?? ""}
                      onChange={(e) => set("pmCode", e.target.value)}
                      placeholder="JHC, JYP 등"
                      className="form-input font-mono"
                    />
                  </Field>
                  <Field label="시스템 권한">
                    <select
                      value={draft.role ?? "staff"}
                      onChange={(e) => set("role", e.target.value)}
                      className="form-input"
                    >
                      <option value="admin">관리자 (admin)</option>
                      <option value="manager">매니저 (manager)</option>
                      <option value="staff">직원 (staff)</option>
                    </select>
                  </Field>
                  <Field label="입사구분">
                    <input
                      type="text"
                      value={draft.joinType ?? ""}
                      onChange={(e) => set("joinType", e.target.value)}
                      placeholder="정규직, 계약직, 인턴 등"
                      className="form-input"
                    />
                  </Field>
                  <Field label="내부직원 (근태·연차 대상)">
                    <label className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded bg-white cursor-pointer hover:border-brand-300">
                      <input
                        type="checkbox"
                        checked={!!(draft as any).isInternal}
                        onChange={(e) => set("isInternal" as any, e.target.checked as any)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-300 w-4 h-4"
                      />
                      <span className="text-[12px] text-slate-700">
                        {(draft as any).isInternal ? "내부직원 (활성)" : "외부/위촉 (비활성)"}
                      </span>
                    </label>
                  </Field>
                  <Field label="컨설턴트 등급">
                    <select
                      value={(draft as any).consultantGrade ?? ""}
                      onChange={(e) => {
                        const grade = e.target.value || null;
                        set("consultantGrade" as any, grade as any);
                        // 등급 선택 시 기본 일단가 자동 채움
                        const defaultRate: Record<string, number> = {
                          "1급": 834000,
                          "2급": 757000,
                          "3급": 644000,
                          "4급": 518000,
                        };
                        if (grade && defaultRate[grade] && !Number((draft as any).consultantRate)) {
                          set("consultantRate" as any, defaultRate[grade] as any);
                        }
                      }}
                      className="form-input"
                    >
                      <option value="">— 미설정 (MD 플래너 미참여) —</option>
                      <option value="1급">1급 (₩834,000)</option>
                      <option value="2급">2급 (₩757,000)</option>
                      <option value="3급">3급 (₩644,000)</option>
                      <option value="4급">4급 (₩518,000)</option>
                    </select>
                  </Field>
                  <Field label="컨설턴트 일단가 (원)">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={(draft as any).consultantRate?.toString?.() ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        set("consultantRate" as any, (v || 0) as any);
                      }}
                      placeholder="등급 기본값 자동 적용 가능"
                      className="form-input text-right tabular-nums"
                    />
                  </Field>
                </Grid>
              </Section>

              <Section title="연락처">
                <Grid>
                  <Field label="전화">
                    <input
                      type="text"
                      value={draft.phone ?? ""}
                      onChange={(e) => set("phone", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="모바일">
                    <input
                      type="text"
                      value={draft.mobile ?? ""}
                      onChange={(e) => set("mobile", e.target.value)}
                      placeholder="010-0000-0000"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Email" wide>
                    <input
                      type="email"
                      value={draft.email ?? ""}
                      onChange={(e) => set("email", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </Grid>
              </Section>

              <Section title="급여통장">
                <Grid>
                  <Field label="은행">
                    <input
                      type="text"
                      value={draft.bankName ?? ""}
                      onChange={(e) => set("bankName", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="계좌번호">
                    <input
                      type="text"
                      value={draft.accountNo ?? ""}
                      onChange={(e) => set("accountNo", e.target.value)}
                      className="form-input font-mono"
                    />
                  </Field>
                  <Field label="예금주" wide>
                    <input
                      type="text"
                      value={draft.accountHolder ?? ""}
                      onChange={(e) => set("accountHolder", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </Grid>
              </Section>

              <Section title="주소">
                <Grid>
                  <Field label="우편번호">
                    <input
                      type="text"
                      value={draft.postCode ?? ""}
                      onChange={(e) => set("postCode", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="주소" wide>
                    <input
                      type="text"
                      value={draft.address ?? ""}
                      onChange={(e) => set("address", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </Grid>
              </Section>
            </div>
          )}

          {tab === "extra" && (
            <div className="space-y-5">
              <Section title="추가 정보">
                <Grid>
                  <Field label="외국어성명1">
                    <input
                      type="text"
                      value={(draft as any).foreignName1 ?? ""}
                      onChange={(e) => set("foreignName1" as any, e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="외국어성명2">
                    <input
                      type="text"
                      value={(draft as any).foreignName2 ?? ""}
                      onChange={(e) => set("foreignName2" as any, e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="여권번호">
                    <input
                      type="text"
                      value={draft.passportNo ?? ""}
                      onChange={(e) => set("passportNo", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="세대주여부">
                    <select
                      value={(draft as any).householderType ?? ""}
                      onChange={(e) => set("householderType" as any, e.target.value)}
                      className="form-input"
                    >
                      <option value="">선택</option>
                      <option value="head">세대주</option>
                      <option value="member">세대원</option>
                      <option value="spouse">세대주의 배우자</option>
                    </select>
                  </Field>
                </Grid>
              </Section>
            </div>
          )}

          {tab === "leave" && (
            <div className="space-y-5">
              <Section title="퇴사 정보">
                <Grid>
                  <Field label="퇴사일자">
                    <input
                      type="date"
                      value={dateToInput(draft.leaveDate as any)}
                      onChange={(e) => set("leaveDate", e.target.value || null)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="퇴사사유">
                    <input
                      type="text"
                      value={draft.leaveReason ?? ""}
                      onChange={(e) => set("leaveReason", e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </Grid>
              </Section>
              <Section title="연차">
                <Grid>
                  <Field label="연차 총 일수">
                    <input
                      type="number"
                      step="0.5"
                      value={(draft as any).annualLeaveTotal ?? 0}
                      onChange={(e) => set("annualLeaveTotal" as any, e.target.value)}
                      className="form-input tabular-nums"
                    />
                  </Field>
                  <Field label="연차 사용 일수">
                    <input
                      type="number"
                      step="0.5"
                      value={(draft as any).annualLeaveUsed ?? 0}
                      onChange={(e) => set("annualLeaveUsed" as any, e.target.value)}
                      className="form-input tabular-nums"
                    />
                  </Field>
                </Grid>
              </Section>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" /> 저장 (F8)
            </button>
            {!isCreating && user && (
              <button
                onClick={() => {
                  setDraft((d) => ({ ...d, id: undefined, empNo: "", name: (d.name || "") + " (복사)" }));
                }}
                className="h-9 px-3 text-sm text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> 복사
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isCreating && user && (
              <button
                onClick={() => onDelete(user.id)}
                className="h-9 px-3 text-sm text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 삭제(비활성화)
              </button>
            )}
            <button
              onClick={onClose}
              className="h-9 px-4 text-sm text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .form-input {
          height: 34px;
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
        select.form-input {
          padding-right: 24px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span className="inline-block w-1 h-3 bg-brand-500 rounded-sm" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, required, wide }: { label: string; children: React.ReactNode; required?: boolean; wide?: boolean }) {
  return (
    <div className={clsx("flex flex-col gap-1.5", wide && "col-span-2")}>
      <label className="text-[11px] font-medium text-slate-600 flex items-center gap-0.5">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
