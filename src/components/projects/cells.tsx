"use client";
import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";

/* ─────────── 텍스트 ─────────── */
export function InlineText({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        className={clsx("min-h-[22px] cursor-text truncate", className, !value && "text-slate-300")}
        title={value}
      >
        {value || placeholder || ""}
      </div>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (draft !== value) onSave(draft);
          setEditing(false);
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="w-full h-6 px-1.5 text-xs border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white"
    />
  );
}

/* ─────────── 정수 매출 ─────────── */
export function InlineMoney({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <div
        className="cursor-text min-h-[22px] tabular-nums text-right"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {value ? `₩${value.toLocaleString()}` : <span className="text-slate-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const n = Number(draft || 0);
        if (n !== value) onSave(n);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const n = Number(draft || 0);
          if (n !== value) onSave(n);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1.5 text-xs text-right border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white tabular-nums"
    />
  );
}

/* ─────────── 소수(자부담) ─────────── */
export function InlineDecimal({
  value,
  onSave,
  suffix,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  if (!editing) {
    return (
      <div
        className="cursor-text min-h-[22px] tabular-nums text-right"
        onClick={() => {
          setDraft(value == null ? "" : String(value));
          setEditing(true);
        }}
      >
        {value != null ? (
          <>
            {value}
            {suffix && <span className="text-slate-400 ml-0.5">{suffix}</span>}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
      onBlur={() => {
        const n = draft === "" ? null : Number(draft);
        if (n !== value) onSave(n);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const n = draft === "" ? null : Number(draft);
          if (n !== value) onSave(n);
          setEditing(false);
        } else if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1.5 text-xs text-right border border-brand-300 rounded outline-none ring-2 ring-brand-200 bg-white"
    />
  );
}

/* ─────────── 체크박스 ─────────── */
export function CheckCell({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx(
        "inline-flex w-5 h-5 items-center justify-center rounded transition",
        value ? "bg-emerald-500 text-white" : "bg-slate-100 hover:bg-slate-200 text-transparent"
      )}
    >
      <Check className="w-3 h-3" />
    </button>
  );
}

/* ─────────── 단일 날짜 ─────────── */
export function InlineDate({
  value,
  onSave,
}: {
  value: string | Date | null;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fmt = (d: string | Date | null) => {
    if (!d) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    if (typeof d === "string") return d.slice(0, 10);
    return "";
  };
  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer text-[11px] min-h-[22px] text-slate-600 hover:text-slate-900"
      >
        {value ? fmt(value) : <span className="text-slate-300">—</span>}
      </div>
    );
  }
  return (
    <input
      autoFocus
      type="date"
      value={fmt(value)}
      onChange={(e) => onSave(e.target.value || null)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") setEditing(false);
      }}
      className="h-6 px-1 text-[10px] border border-brand-300 rounded outline-none bg-white"
    />
  );
}

/* ─────────── 날짜 범위 ─────────── */
export function DateRange({
  start,
  end,
  onChange,
}: {
  start: string | Date | null;
  end: string | Date | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fmt = (d: string | Date | null) => {
    if (!d) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    if (typeof d === "string") return d.slice(0, 10);
    return "";
  };
  const startStr = fmt(start) || null;
  const endStr = fmt(end) || null;
  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className="cursor-pointer text-[11px] min-h-[22px] text-slate-600 hover:text-slate-900 whitespace-nowrap"
      >
        {start || end ? (
          <>
            {fmt(start) || "—"} <span className="text-slate-300">→</span> {fmt(end) || "—"}
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={fmt(start)}
        onChange={(e) => onChange(e.target.value || null, endStr)}
        className="h-6 px-1 text-[10px] border border-brand-300 rounded outline-none"
      />
      <span className="text-slate-300">→</span>
      <input
        type="date"
        value={fmt(end)}
        onChange={(e) => onChange(startStr, e.target.value || null)}
        className="h-6 px-1 text-[10px] border border-brand-300 rounded outline-none"
      />
      <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-700">
        <Check className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ─────────── 드롭다운 (pill) ─────────── */
export function PillSelect<T extends { value: string; label: string }>({
  value,
  options,
  onChange,
  renderPill,
  placeholder,
}: {
  value: string | null;
  options: readonly T[];
  onChange: (v: string) => void;
  renderPill: (option: T | null) => React.ReactNode;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center min-h-[22px]"
        type="button"
      >
        {current ? renderPill(current) : <span className="text-slate-300 text-xs">{placeholder ?? "—"}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 min-w-[120px] bg-white border border-slate-200 rounded-md shadow-lg py-1 max-h-64 overflow-auto">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-slate-100 flex items-center gap-2"
              >
                {renderPill(o)}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-slate-50 text-xs text-slate-400"
              >
                지우기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
