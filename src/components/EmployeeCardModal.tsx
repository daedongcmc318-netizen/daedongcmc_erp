"use client";
import { useEffect, useState, useRef } from "react";
import { X, Printer, Plus, Trash2, Loader2 } from "lucide-react";
import type { User } from "./UsersClient";
import { maskResident } from "@/lib/format";

type Education = {
  id: string;
  level: string;
  schoolName: string;
  major: string | null;
  location: string | null;
  enterDate: string | null;
  graduateDate: string | null;
  daytime: string | null;
  graduateType: string | null;
  note: string | null;
};

const LEVELS = ["고졸", "전문대", "대학", "대학원-석사", "대학원-박사", "기타"];
const DAYTIMES = ["주간", "야간", "사이버"];
const GRAD_TYPES = ["졸업", "재학", "휴학", "수료", "중퇴"];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const s = typeof d === "string" ? d.slice(0, 10) : "";
  return s.replaceAll("-", "/");
}

function birthFromResident(r: string | null | undefined): string {
  if (!r) return "";
  const m = r.match(/^(\d{2})(\d{2})(\d{2})-?(\d)/);
  if (!m) return "";
  const yy = Number(m[1]);
  const gd = Number(m[4]);
  const century = gd === 1 || gd === 2 || gd === 5 || gd === 6 ? 1900 : 2000;
  return `${century + yy}${m[2]}${m[3]}`;
}

export default function EmployeeCardModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [edus, setEdus] = useState<Education[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>({
    level: "대학",
    schoolName: "",
    major: "",
    location: "",
    enterDate: "",
    graduateDate: "",
    daytime: "주간",
    graduateType: "졸업",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/user-educations?userId=${user.id}`);
      if (res.ok) setEdus(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function addEdu() {
    if (!draft.schoolName) {
      alert("학교명을 입력하세요");
      return;
    }
    const res = await fetch("/api/user-educations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...draft }),
    });
    if (res.ok) {
      setDraft({ level: "대학", schoolName: "", major: "", location: "", enterDate: "", graduateDate: "", daytime: "주간", graduateType: "졸업" });
      load();
    }
  }

  async function delEdu(id: string) {
    if (!confirm("이 학력 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/user-educations/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function handlePrint() {
    if (!printRef.current) return;
    // 새 창을 열어서 출력 부분만 인쇄
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) {
      alert("팝업이 차단되었습니다. 브라우저 팝업 차단을 해제해주세요.");
      return;
    }
    const printHtml = printRef.current.innerHTML;
    w.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>사원카드 - ${user.name}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    color: #111;
    margin: 24mm 20mm;
    font-size: 12px;
  }
  h1 { font-size: 22px; text-align: center; letter-spacing: 0.5em; margin: 0 0 18px; font-weight: bold; }
  .company { font-size: 12px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td, th {
    border: 1px solid #333;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    vertical-align: middle;
  }
  th { background: #f3f4f6; font-weight: 600; text-align: center; }
  .photo {
    width: 130px; height: 170px; border: 1px solid #ccc;
    display: flex; align-items: center; justify-content: center;
    color: #aaa; font-size: 11px;
  }
  .basic-table { table-layout: fixed; }
  .basic-table td.label { width: 80px; text-align: center; background: #f3f4f6; font-weight: 600; }
  .basic-table td.value { padding-left: 12px; }
  .top-grid { display: flex; gap: 12px; margin-bottom: 18px; }
  .section-title { font-size: 12px; margin: 18px 0 6px; font-weight: 600; }
  @media print {
    body { margin: 16mm 14mm; }
    button { display: none; }
  }
</style>
</head>
<body>
${printHtml}
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
</body>
</html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Printer className="w-4 h-4" /> 인사카드 — {user.name}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 — 미리보기 + 학력 편집 */}
        <div className="flex-1 overflow-auto flex">
          {/* 왼쪽: 사원카드 미리보기 (인쇄 영역) */}
          <div className="flex-1 p-6 bg-slate-100 overflow-auto">
            <div className="bg-white p-8 shadow-md max-w-[750px] mx-auto" ref={printRef}>
              {/* 출력 영역 — handlePrint가 그대로 복제해서 인쇄 */}
              <h1 style={{ fontSize: 22, textAlign: "center", letterSpacing: "0.5em", margin: "0 0 18px", fontWeight: "bold" }}>
                사 원 카 드
              </h1>
              <div style={{ fontSize: 12, marginBottom: 6 }}>주식회사 대동씨엠씨</div>
              <div className="top-grid" style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                <div className="photo" style={{
                  width: 130, height: 170, border: "1px solid #ccc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#aaa", fontSize: 11,
                }}>사진</div>
                <table className="basic-table" style={{ flex: 1, borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    <tr>
                      <td style={cellLabel}>입사일자</td>
                      <td style={cellValue}>{fmtDate(user.joinDate)}</td>
                      <td style={cellLabel}>주민등록번호</td>
                      <td style={cellValue}>{maskResident(user.residentNo)}</td>
                    </tr>
                    <tr>
                      <td style={cellLabel}>성명</td>
                      <td style={cellValue}>{user.name}</td>
                      <td style={cellLabel}>부서</td>
                      <td style={cellValue}>{user.dept}</td>
                    </tr>
                    <tr>
                      <td style={cellLabel}>Email</td>
                      <td style={cellValue}>{user.email ?? ""}</td>
                      <td style={cellLabel}>생년월일</td>
                      <td style={cellValue}>{birthFromResident(user.residentNo)}</td>
                    </tr>
                    <tr>
                      <td style={cellLabel}>주소</td>
                      <td style={cellValue} colSpan={3}>{user.address ?? ""}</td>
                    </tr>
                    <tr>
                      <td style={cellLabel}>전화</td>
                      <td style={cellValue}>{user.phone ?? ""}</td>
                      <td style={cellLabel}>연락처</td>
                      <td style={cellValue}>{(user.mobile ?? "").replace(/-/g, "")}</td>
                    </tr>
                    <tr>
                      <td style={cellLabel}>직위/직급</td>
                      <td style={cellValue}>{user.position}</td>
                      <td style={cellLabel}>직책</td>
                      <td style={cellValue}>{user.positionTitle ?? ""}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="section-title" style={{ fontSize: 12, margin: "18px 0 6px", fontWeight: 600 }}>
                학력사항
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>학력</th>
                    <th style={th}>학교명</th>
                    <th style={th}>입학일자</th>
                    <th style={th}>졸업일자</th>
                    <th style={th}>주야구분</th>
                    <th style={th}>전공명</th>
                    <th style={th}>소재지</th>
                    <th style={th}>기타</th>
                    <th style={th}>졸업구분</th>
                  </tr>
                </thead>
                <tbody>
                  {edus.length === 0
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={td}></td>
                        </tr>
                      ))
                    : edus.map((e) => (
                        <tr key={e.id}>
                          <td style={td}>{e.level}</td>
                          <td style={td}>{e.schoolName}</td>
                          <td style={td}>{fmtDate(e.enterDate)}</td>
                          <td style={td}>{fmtDate(e.graduateDate)}</td>
                          <td style={td}>{e.daytime ?? ""}</td>
                          <td style={td}>{e.major ?? ""}</td>
                          <td style={td}>{e.location ?? ""}</td>
                          <td style={td}>{e.note ?? ""}</td>
                          <td style={td}>{e.graduateType ?? ""}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 오른쪽: 학력 편집 패널 */}
          <div className="w-80 border-l border-slate-200 bg-slate-50 overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">학력 관리</h3>
              <button
                onClick={() => setEditing(!editing)}
                className="text-[11px] text-brand-600 hover:underline"
              >
                {editing ? "닫기" : "+ 추가"}
              </button>
            </div>

            {editing && (
              <div className="bg-white border border-slate-200 rounded p-3 space-y-2 mb-3">
                <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} className="form-input">
                  {LEVELS.map((l) => (<option key={l}>{l}</option>))}
                </select>
                <input value={draft.schoolName} onChange={(e) => setDraft({ ...draft, schoolName: e.target.value })} placeholder="학교명 *" className="form-input" />
                <input value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value })} placeholder="전공" className="form-input" />
                <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="소재지" className="form-input" />
                <div className="grid grid-cols-2 gap-1">
                  <input type="date" value={draft.enterDate} onChange={(e) => setDraft({ ...draft, enterDate: e.target.value })} className="form-input" />
                  <input type="date" value={draft.graduateDate} onChange={(e) => setDraft({ ...draft, graduateDate: e.target.value })} className="form-input" />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <select value={draft.daytime} onChange={(e) => setDraft({ ...draft, daytime: e.target.value })} className="form-input">
                    {DAYTIMES.map((d) => (<option key={d}>{d}</option>))}
                  </select>
                  <select value={draft.graduateType} onChange={(e) => setDraft({ ...draft, graduateType: e.target.value })} className="form-input">
                    {GRAD_TYPES.map((t) => (<option key={t}>{t}</option>))}
                  </select>
                </div>
                <button onClick={addEdu} className="w-full h-8 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded">
                  학력 추가
                </button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              </div>
            ) : edus.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-slate-400">
                등록된 학력이 없습니다
              </div>
            ) : (
              <ul className="space-y-1.5">
                {edus.map((e) => (
                  <li key={e.id} className="bg-white border border-slate-200 rounded px-2.5 py-2 text-[11px] group flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">
                        {e.level} · {e.schoolName}
                      </div>
                      <div className="text-slate-500 truncate">
                        {e.major} · {fmtDate(e.enterDate)} ~ {fmtDate(e.graduateDate)} · {e.graduateType}
                      </div>
                    </div>
                    <button onClick={() => delEdu(e.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] text-slate-500">
            💡 「인쇄」 클릭 → 새 창에서 인쇄 대화상자가 열립니다. 「PDF로 저장」 선택해서 PDF 다운로드 가능.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> 인쇄 / PDF
            </button>
            <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
              닫기
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .form-input {
          height: 28px;
          width: 100%;
          padding: 0 8px;
          font-size: 11.5px;
          border: 1px solid rgb(226 232 240);
          border-radius: 4px;
          background: white;
        }
        .form-input:focus {
          border-color: rgb(63 99 245);
          outline: none;
        }
      `}</style>
    </div>
  );
}

const cellLabel: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 10px",
  fontSize: 12,
  textAlign: "center",
  width: 80,
  background: "#f3f4f6",
  fontWeight: 600,
};

const cellValue: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 12px",
  fontSize: 12,
};

const th: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 10px",
  fontSize: 12,
  background: "#f3f4f6",
  fontWeight: 600,
  textAlign: "center",
};

const td: React.CSSProperties = {
  border: "1px solid #333",
  padding: "6px 10px",
  fontSize: 12,
  minHeight: 24,
};
