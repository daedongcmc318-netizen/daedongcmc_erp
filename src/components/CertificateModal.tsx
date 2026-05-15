"use client";
import { useEffect, useRef, useState } from "react";
import { X, Printer, Save, Loader2, FileText, History as HistoryIcon, Trash2 } from "lucide-react";
import type { User } from "./UsersClient";
import { maskResident } from "@/lib/format";

type CertType = "employment" | "career";

type Certificate = {
  id: string;
  certNo: string;
  type: CertType | string;
  userId: string;
  purpose: string | null;
  issueDate: string;
  startDate: string | null;
  endDate: string | null;
  customBody: string | null;
  createdAt: string;
};

const COMPANY_NAME = "주식회사 대동씨엠씨";
const COMPANY_ADDR = "울산광역시 울주군 서생면 에너지산업6로 23";
const CEO_NAME = "최진혁";

function fmtKDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}년 ${String(dt.getMonth() + 1).padStart(2, "0")}월 ${String(dt.getDate()).padStart(2, "0")}일`;
}

function fmtKDateDot(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}년 ${String(dt.getMonth() + 1).padStart(2, "0")}월 ${String(dt.getDate()).padStart(2, "0")}일`;
}


export default function CertificateModal({
  user,
  type,
  onClose,
}: {
  user: User;
  type: CertType;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [purpose, setPurpose] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [startDate, setStartDate] = useState(user.joinDate ? user.joinDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(
    type === "career" && user.leaveDate ? user.leaveDate.slice(0, 10) : today
  );
  const [customBody, setCustomBody] = useState("");
  const [certNoPreview, setCertNoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCert, setSavedCert] = useState<Certificate | null>(null);
  const [history, setHistory] = useState<Certificate[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const title = type === "employment" ? "재 직 증 명 서" : "경 력 증 명 서";

  // 발급번호 미리보기 — 미리 발급해보지 않고 'NEW' 표시
  useEffect(() => {
    setCertNoPreview(`${new Date().getFullYear()}-NEW`);
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    const res = await fetch(`/api/certificates?userId=${user.id}`);
    if (res.ok) {
      const list = await res.json();
      setHistory(list.filter((c: Certificate) => c.type === type));
    }
  }

  async function save(): Promise<Certificate | null> {
    setSaving(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          type,
          purpose: purpose || null,
          issueDate,
          startDate: startDate || null,
          endDate: endDate || null,
          customBody: customBody || null,
        }),
      });
      if (!res.ok) {
        alert("저장 실패");
        return null;
      }
      const c = await res.json();
      setSavedCert(c);
      setCertNoPreview(c.certNo);
      loadHistory();
      return c;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndPrint() {
    const c = savedCert ?? (await save());
    if (!c) return;
    // 약간의 딜레이 후 인쇄 (state 반영 후)
    setTimeout(() => doPrint(c.certNo), 200);
  }

  function loadFromHistory(c: Certificate) {
    setPurpose(c.purpose ?? "");
    setIssueDate(c.issueDate.slice(0, 10));
    setStartDate(c.startDate?.slice(0, 10) ?? "");
    setEndDate(c.endDate?.slice(0, 10) ?? "");
    setCustomBody(c.customBody ?? "");
    setSavedCert(c);
    setCertNoPreview(c.certNo);
    setShowHistory(false);
  }

  async function deleteHistory(id: string) {
    if (!confirm("이 발급 이력을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (savedCert?.id === id) {
        setSavedCert(null);
        setCertNoPreview(`${new Date().getFullYear()}-NEW`);
      }
      loadHistory();
    }
  }

  function doPrint(certNo: string) {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) {
      alert("팝업이 차단되었습니다.");
      return;
    }
    // 인쇄 새 창에서 상대경로 이미지 깨짐 방지 → 절대 URL로 치환
    const origin = window.location.origin;
    const html = printRef.current.innerHTML
      .replace(/__CERT_NO__/g, certNo)
      .replace(/src="\/daedong-seal\.png"/g, `src="${origin}/daedong-seal.png"`)
      .replace(/src='\/daedong-seal\.png'/g, `src='${origin}/daedong-seal.png'`);
    w.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${type === "employment" ? "재직증명서" : "경력증명서"} - ${user.name}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    color: #111;
    margin: 24mm 22mm;
    font-size: 14px;
  }
  .cert-no { font-size: 12px; margin-bottom: 14px; }
  .title-wrap {
    border: 2px solid #333;
    padding: 32px 0;
    text-align: center;
    margin-bottom: 0;
  }
  .title-wrap h1 {
    font-size: 28px;
    letter-spacing: 0.3em;
    margin: 0;
    font-weight: bold;
    text-decoration: underline;
    text-underline-offset: 6px;
  }
  table.info {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #333;
    border-top: 0;
  }
  table.info th, table.info td {
    border: 1px solid #333;
    padding: 14px 12px;
    font-size: 13px;
  }
  table.info th {
    background: #f9fafb;
    width: 25%;
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.3em;
  }
  table.info td { padding-left: 16px; }
  .body-text {
    text-align: center;
    margin: 60px 0 90px;
    font-size: 16px;
    font-weight: 600;
  }
  .footer {
    text-align: center;
    font-size: 13px;
  }
  .footer .date { margin-bottom: 60px; font-weight: 500; }
  .footer .addr { margin-bottom: 6px; }
  .footer .ceo {
    font-weight: 600;
    letter-spacing: 0.3em;
    margin-bottom: 4px;
    position: relative;
    display: inline-block;
  }
  .footer .stamp {
    display: inline-block;
    width: 60px; height: 60px;
    margin-left: 4px;
    margin-bottom: -16px;
    vertical-align: middle;
    object-fit: contain;
  }
  .footer .company {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.2em;
  }
  @media print {
    body { margin: 16mm 14mm; }
    button { display: none; }
  }
</style>
</head>
<body>
${html}
<script>
window.onload = function() {
  var imgs = document.querySelectorAll('img');
  var pending = imgs.length;
  function ready() { setTimeout(function(){ window.print(); }, 200); }
  if (pending === 0) { ready(); return; }
  imgs.forEach(function(img){
    if (img.complete && img.naturalWidth > 0) {
      if (--pending === 0) ready();
    } else {
      img.addEventListener('load', function(){ if(--pending === 0) ready(); });
      img.addEventListener('error', function(){ if(--pending === 0) ready(); });
    }
  });
};
</script>
</body>
</html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {type === "employment" ? "재직증명서" : "경력증명서"} — {user.name}
            {certNoPreview && (
              <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded font-mono ml-2">
                {certNoPreview}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto flex">
          {/* 왼쪽: 인쇄 영역 미리보기 */}
          <div className="flex-1 p-6 bg-slate-100 overflow-auto">
            <div className="bg-white p-10 shadow-md max-w-[640px] mx-auto" ref={printRef}>
              <div className="cert-no" style={{ fontSize: 12, marginBottom: 14 }}>
                발급번호 : __CERT_NO__호
              </div>
              <div
                className="title-wrap"
                style={{
                  border: "2px solid #333",
                  padding: "32px 0",
                  textAlign: "center",
                }}
              >
                <h1
                  style={{
                    fontSize: 28,
                    letterSpacing: "0.3em",
                    margin: 0,
                    fontWeight: "bold",
                    textDecoration: "underline",
                    textUnderlineOffset: 6,
                  }}
                >
                  {title}
                </h1>
              </div>
              <table
                className="info"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "2px solid #333",
                  borderTop: 0,
                }}
              >
                <tbody>
                  <tr>
                    <th style={thStyle}>성 명</th>
                    <td style={tdStyle}>{user.name}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>주민등록번호</th>
                    <td style={tdStyle}>{maskResident(user.residentNo)}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>현 주 소</th>
                    <td style={tdStyle}>{user.address ?? ""}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>소 속</th>
                    <td style={tdStyle}>{user.dept}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>직 위</th>
                    <td style={tdStyle}>{user.position}</td>
                  </tr>
                  <tr>
                    <th style={thStyle}>근무기간</th>
                    <td style={tdStyle}>
                      {fmtKDateDot(startDate)}
                      {endDate && type === "career"
                        ? ` ~ ${fmtKDateDot(endDate)}`
                        : type === "employment"
                          ? ` ~ ${fmtKDateDot(endDate || issueDate)}`
                          : ""}
                    </td>
                  </tr>
                  <tr>
                    <th style={thStyle}>용 도</th>
                    <td style={tdStyle}>{purpose}</td>
                  </tr>
                </tbody>
              </table>

              <div
                className="body-text"
                style={{
                  textAlign: "center",
                  margin: "60px 0 90px",
                  fontSize: 16,
                  fontWeight: 600,
                  whiteSpace: "pre-wrap",
                }}
              >
                {customBody || "위와 같이 증명합니다."}
              </div>

              <div className="footer" style={{ textAlign: "center", fontSize: 13 }}>
                <div className="date" style={{ marginBottom: 60, fontWeight: 500 }}>
                  {fmtKDate(issueDate)}
                </div>
                <div className="addr" style={{ marginBottom: 6 }}>
                  {COMPANY_ADDR}
                </div>
                <div
                  className="ceo"
                  style={{
                    fontWeight: 600,
                    letterSpacing: "0.3em",
                    marginBottom: 4,
                    display: "inline-block",
                  }}
                >
                  대 표 이 사&nbsp;&nbsp;{CEO_NAME}
                  <img
                    src="/daedong-seal.png"
                    alt="대동CMC 법인직인"
                    className="stamp"
                    style={{
                      display: "inline-block",
                      width: 60,
                      height: 60,
                      marginLeft: 4,
                      marginBottom: -16,
                      verticalAlign: "middle",
                      objectFit: "contain",
                    }}
                  />
                </div>
                <div
                  className="company"
                  style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.2em" }}
                >
                  {COMPANY_NAME}
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 편집 패널 */}
          <div className="w-80 border-l border-slate-200 bg-slate-50 overflow-auto p-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-600 mb-1 block">용 도</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 관공서 제출, 비자 신청 등"
                className="form-input"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 mb-1 block">발행일</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="form-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 mb-1 block">근무 시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600 mb-1 block">
                  {type === "career" ? "근무 종료일" : "발행 기준일"}
                </label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 mb-1 block">증명 문구 (선택)</label>
              <textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                placeholder="기본: 위와 같이 증명합니다."
                rows={3}
                className="form-input min-h-[64px] py-2 resize-none"
              />
            </div>

            {/* 발급 이력 */}
            <div className="border-t border-slate-200 pt-3 mt-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[11px] text-brand-600 hover:underline flex items-center gap-1"
              >
                <HistoryIcon className="w-3 h-3" /> 발급 이력 {history.length}건 {showHistory ? "▲" : "▼"}
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1 max-h-48 overflow-auto">
                  {history.length === 0 ? (
                    <li className="text-[11px] text-slate-400 text-center py-2">이력 없음</li>
                  ) : (
                    history.map((c) => (
                      <li key={c.id} className="bg-white border border-slate-200 rounded px-2 py-1.5 text-[11px] flex items-start gap-1 group">
                        <button
                          onClick={() => loadFromHistory(c)}
                          className="flex-1 text-left"
                        >
                          <div className="font-mono text-brand-700 font-medium">{c.certNo}</div>
                          <div className="text-slate-500 text-[10px]">
                            {c.issueDate.slice(0, 10)} · {c.purpose || "—"}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteHistory(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] text-slate-500">
            💡 「저장 + 인쇄」 클릭 → 발급번호 부여 후 새 창에서 인쇄 대화상자 → 「PDF로 저장」 가능
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => save()}
              disabled={saving}
              className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 border border-slate-200 text-sm font-medium rounded flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장만
            </button>
            <button
              onClick={saveAndPrint}
              disabled={saving}
              className="h-9 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> 저장 + 인쇄 (PDF)
            </button>
            <button onClick={onClose} className="h-9 px-4 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded">
              닫기
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .form-input {
          height: 32px;
          width: 100%;
          padding: 0 10px;
          font-size: 12px;
          border: 1px solid rgb(226 232 240);
          border-radius: 4px;
          background: white;
        }
        .form-input:focus {
          border-color: rgb(63 99 245);
          outline: none;
          box-shadow: 0 0 0 2px rgba(63, 99, 245, 0.1);
        }
        textarea.form-input { height: auto; }
      `}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #333",
  padding: "14px 12px",
  fontSize: 13,
  background: "#f9fafb",
  width: "25%",
  textAlign: "center",
  fontWeight: 600,
  letterSpacing: "0.3em",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #333",
  padding: "14px 16px",
  fontSize: 13,
};
