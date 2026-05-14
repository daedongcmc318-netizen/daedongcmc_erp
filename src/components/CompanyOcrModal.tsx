"use client";
import { useRef, useState } from "react";
import { X, Upload, FileScan, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type OcrResult = {
  name?: string | null;
  bizNo?: string | null;
  repName?: string | null;
  address?: string | null;
  industry?: string | null;
  corpType?: string | null;
  foundedAt?: string | null;
  items?: string | null;
  region?: string | null;
};

const TYPES = [
  { v: "client", l: "수혜기업" },
  { v: "agency", l: "운영기관" },
  { v: "partner", l: "협력사" },
  { v: "etc", l: "기타" },
];

export default function CompanyOcrModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (company: any) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OcrResult>({});
  const [type, setType] = useState("client");

  async function handleFile(file: File) {
    setError(null);
    setData({});
    setPreviewUrl(URL.createObjectURL(file));
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ocr/business-registration", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "OCR 처리 실패");
      } else {
        setData(json.data ?? {});
      }
    } catch (e: any) {
      setError(e.message ?? "네트워크 오류");
    } finally {
      setScanning(false);
    }
  }

  function set(k: keyof OcrResult, v: any) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    if (!data.name) {
      setError("회사명이 필요합니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: data.name,
        bizNo: data.bizNo,
        repName: data.repName,
        address: data.address,
        region: data.region,
        industry: data.industry,
        corpType: data.corpType,
        items: data.items,
        type,
      };
      if (data.foundedAt) {
        // foundedAt은 Date 필요 — Company schema 사용
        payload.foundedAt = data.foundedAt;
      }
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "저장 실패");
        return;
      }
      // foundedAt이 무시되면 PATCH로 보강
      if (data.foundedAt && !json.foundedAt) {
        await fetch(`/api/companies/${json.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foundedAt: data.foundedAt }),
        });
      }
      onCreated(json);
    } catch (e: any) {
      setError(e.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileScan className="w-4 h-4" />
            사업자등록증 OCR 자동 등록
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* 업로드 영역 */}
          {!previewUrl ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50/30 rounded-xl p-12 text-center cursor-pointer transition"
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-700 mb-1">사업자등록증 이미지 업로드</div>
              <div className="text-[11px] text-slate-500">
                JPG · PNG · WEBP / 최대 8MB
                <br />
                클릭 또는 파일 드래그
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 미리보기 */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>업로드된 이미지</span>
                  <button
                    onClick={() => {
                      setPreviewUrl(null);
                      setData({});
                      setError(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-800"
                  >
                    다시 선택
                  </button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 max-h-[440px] flex items-center justify-center">
                  <img src={previewUrl} alt="preview" className="max-h-[440px] w-auto object-contain" />
                </div>
              </div>

              {/* 추출 결과 (편집 가능) */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {scanning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> OCR 분석 중...
                    </>
                  ) : data.name ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 추출 완료 — 확인 후 저장
                    </>
                  ) : (
                    "추출 결과"
                  )}
                </div>
                <div className="space-y-2.5">
                  <Field label="회사명 *">
                    <input
                      value={data.name ?? ""}
                      onChange={(e) => set("name", e.target.value)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="사업자등록번호">
                    <input
                      value={data.bizNo ?? ""}
                      onChange={(e) => set("bizNo", e.target.value)}
                      className="form-input font-mono"
                      placeholder="000-00-00000"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="대표자">
                    <input
                      value={data.repName ?? ""}
                      onChange={(e) => set("repName", e.target.value)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="유형">
                    <select value={type} onChange={(e) => setType(e.target.value)} className="form-input">
                      {TYPES.map((t) => (
                        <option key={t.v} value={t.v}>
                          {t.l}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="업태">
                    <input
                      value={data.industry ?? ""}
                      onChange={(e) => set("industry", e.target.value)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="법인구분">
                    <input
                      value={data.corpType ?? ""}
                      onChange={(e) => set("corpType", e.target.value)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="개업연월일">
                    <input
                      type="date"
                      value={(data.foundedAt ?? "").slice(0, 10)}
                      onChange={(e) => set("foundedAt", e.target.value || null)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="주소">
                    <textarea
                      value={data.address ?? ""}
                      onChange={(e) => set("address", e.target.value)}
                      rows={2}
                      className="form-input min-h-[52px] py-1.5 resize-none"
                      disabled={scanning}
                    />
                  </Field>
                  <Field label="종목">
                    <input
                      value={data.items ?? ""}
                      onChange={(e) => set("items", e.target.value)}
                      className="form-input"
                      disabled={scanning}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {previewUrl && !scanning && data.name && (
            <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50 border border-amber-200 rounded px-3 py-2">
              💡 추출된 정보를 확인하고 필요시 수정하세요. <strong>키맨/담당자 연락처/이메일</strong>은 등록 후 거래처 목록에서 직접 입력합니다.
            </p>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <div className="text-[11px] text-slate-500">
            {previewUrl && data.name ? "검토 완료 후 「등록」을 눌러주세요" : "이미지를 업로드하면 자동으로 정보가 추출됩니다"}
          </div>
          <div className="flex items-center gap-2">
            {previewUrl && data.name && (
              <button
                onClick={save}
                disabled={saving || scanning}
                className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                거래처 등록
              </button>
            )}
            <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
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
        .form-input:disabled { background: rgb(248 250 252); color: rgb(100 116 139); }
        textarea.form-input { height: auto; }
        select.form-input { padding-right: 24px; cursor: pointer; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
