"use client";
import { useState } from "react";

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string; // raw hex
};

export default function Donut({
  segments,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const fraction = s.value / total;
    const dash = circumference * fraction;
    const gap = circumference - dash;
    const offset = circumference * (0.25 - cumulative);
    cumulative += fraction;
    return { ...s, dash, gap, offset, fraction };
  });

  const hovered = hover ? segments.find((s) => s.key === hover) : null;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.key ? thickness + 3 : thickness}
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
              style={{ transition: "stroke-width 0.15s ease" }}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-[11px] text-slate-500">{hovered.label}</span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {hovered.value}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">
                {Math.round((hovered.value / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-slate-500">{centerLabel ?? "합계"}</span>
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {centerValue ?? total.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400">건</span>
            </>
          )}
        </div>
      </div>
      <ul className="space-y-1.5 flex-1 min-w-0">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <li
                key={s.key}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                className="flex items-center gap-2 text-xs cursor-pointer rounded px-1.5 py-1 hover:bg-slate-50"
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-slate-700 truncate">{s.label}</span>
                <span className="tabular-nums text-slate-900 font-medium">{s.value}</span>
                <span className="tabular-nums text-slate-400 w-8 text-right">{pct}%</span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
