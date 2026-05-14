"use client";
import { useEffect, useState } from "react";
import { FileText, X, Plus, Trash2, Pencil, Check, Loader2 } from "lucide-react";
import clsx from "clsx";

type HistoryItem = {
  id: string;
  body: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 프로젝트 히스토리(특이사항) 모달.
 *  - 제목 옆 서류 아이콘 버튼 클릭 시 열림
 *  - 기존 메모 리스트(최신순) + 신규 추가 textarea
 *  - 저장 후 닫을 때 부모에 새 개수 전달 (서류 아이콘 토글용)
 */
export default function ProjectNotesModal({
  projectId,
  projectTitle,
  initialCount,
  onClose,
  onCountChange,
}: {
  projectId: string;
  projectTitle: string;
  initialCount: number;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/project-histories?projectId=${projectId}`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setItems(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function addHistory() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/project-histories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, body: draft.trim() }),
      });
      if (!res.ok) {
        alert("저장 실패");
        return;
      }
      const created = await res.json();
      const next = [created, ...items];
      setItems(next);
      setDraft("");
      onCountChange(next.length);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim()) return;
    const res = await fetch(`/api/project-histories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editDraft.trim() }),
    });
    if (!res.ok) {
      alert("수정 실패");
      return;
    }
    const updated = await res.json();
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    setEditingId(null);
  }

  async function removeHistory(id: string) {
    if (!confirm("이 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/project-histories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    onCountChange(next.length);
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-brand-500 shrink-0" />
            <h2 className="text-sm font-semibold truncate">히스토리 — {projectTitle}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium tabular-nums">
              {items.length}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 신규 추가 */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <label className="text-[10px] text-slate-400 font-medium mb-1 block">새 특이사항</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="특이사항을 입력하세요 (예: 거래처 사정으로 보고 지연)"
            rows={3}
            className="w-full text-[12px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200 resize-none bg-white"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={addHistory}
              disabled={saving || !draft.trim()}
              className="h-7 px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[11px] font-medium rounded flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              추가
            </button>
          </div>
        </div>

        {/* 기존 목록 */}
        <div className="flex-1 overflow-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-[12px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> 불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-slate-400">
              기록된 특이사항이 없습니다
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:shadow-sm transition"
              >
                {editingId === it.id ? (
                  <>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full text-[12px] px-2 py-1.5 border border-brand-300 rounded outline-none focus:ring-2 focus:ring-brand-200 resize-none bg-white"
                    />
                    <div className="flex justify-end gap-1 mt-1.5">
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-6 px-2 text-[10px] text-slate-500 hover:text-slate-800"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveEdit(it.id)}
                        className="h-6 px-2 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-medium rounded flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> 저장
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">{it.body}</div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span>
                        {it.createdByName ?? "익명"} · {fmtDateTime(it.createdAt)}
                        {it.updatedAt !== it.createdAt && " (수정됨)"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(it.id);
                            setEditDraft(it.body);
                          }}
                          className="text-slate-300 hover:text-brand-600 p-0.5"
                          title="수정"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeHistory(it.id)}
                          className="text-slate-300 hover:text-rose-500 p-0.5"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/40 flex justify-end">
          <button
            onClick={onClose}
            className="h-7 px-3 text-[11px] text-slate-600 hover:text-slate-800 font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
