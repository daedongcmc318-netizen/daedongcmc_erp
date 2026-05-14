"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Search, History, Loader2, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { BIZ_CATEGORY, PROJECT_STATUS, getBizMeta, getStatusMeta, getServiceLabel } from "@/lib/enums";

type Project = {
  id: string;
  year: number;
  displayCode: string | null;
  title: string;
  bizCategory: string;
  serviceType: string | null;
  serviceDetail: string | null;
  status: string;
  confirmedRevenue: string;
  company: { id: string; name: string; bizNo: string | null } | null;
  manager: { id: string; name: string } | null;
};

type Response = {
  items: Project[];
  byYear: Record<number, Project[]>;
  byCompany: Record<string, Project[]>;
};

export default function ProjectHistoryModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [groupBy, setGroupBy] = useState<"year" | "company">("year");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const totalCount = data?.items.length ?? 0;
  const yearKeys = data ? Object.keys(data.byYear).map(Number).sort((a, b) => b - a) : [];
  const companyKeys = data
    ? Object.entries(data.byCompany)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name]) => name)
    : [];

  function goToProject(p: Project) {
    router.push(`/projects?year=${p.year}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4" />
            거래처 이력 검색 — 전체 연도
          </h2>
          <button onClick={onClose} className="hover:bg-white/15 rounded p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="거래처명, 프로젝트명, 코드, 키워드, 상세서비스 검색..."
              className="w-full h-10 pl-10 pr-10 rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 outline-none text-sm"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
            )}
          </div>

          {data && totalCount > 0 && (
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                <strong className="text-slate-700">{totalCount.toLocaleString()}건</strong> · {yearKeys.length}개 연도 · {companyKeys.length}개 거래처
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setGroupBy("year")}
                  className={clsx(
                    "px-2 h-6 text-[11px] rounded transition",
                    groupBy === "year" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  연도별
                </button>
                <button
                  onClick={() => setGroupBy("company")}
                  className={clsx(
                    "px-2 h-6 text-[11px] rounded transition",
                    groupBy === "company" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  거래처별
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 결과 */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {!q || q.length < 2 ? (
            <div className="text-center py-16 text-sm text-slate-400">
              2자 이상 입력하면 전체 연도에서 검색합니다
            </div>
          ) : loading && !data ? (
            <div className="text-center py-16 text-sm text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> 검색 중...
            </div>
          ) : !data || totalCount === 0 ? (
            <div className="text-center py-16 text-sm text-slate-400">
              「{q}」 일치하는 프로젝트가 없습니다
            </div>
          ) : groupBy === "year" ? (
            <div className="space-y-4">
              {yearKeys.map((year) => (
                <YearSection
                  key={year}
                  year={year}
                  projects={data.byYear[year]}
                  onSelect={goToProject}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {companyKeys.map((name) => (
                <CompanySection
                  key={name}
                  name={name}
                  projects={data.byCompany[name]}
                  onSelect={goToProject}
                />
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50 text-[11px] text-slate-500">
          <span>💡 행을 클릭하면 해당 연도의 프로젝트 관리 페이지로 이동합니다</span>
          <button onClick={onClose} className="h-8 px-3 text-xs text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function YearSection({
  year,
  projects,
  onSelect,
}: {
  year: number;
  projects: Project[];
  onSelect: (p: Project) => void;
}) {
  const total = projects.reduce((s, p) => s + Number(p.confirmedRevenue), 0);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1">
        <span className="text-sm font-bold text-brand-700">{year}년</span>
        <span className="text-[11px] text-slate-400">{projects.length}건</span>
        <span className="text-[11px] text-slate-500 tabular-nums">· ₩{total.toLocaleString()}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <tbody>
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanySection({
  name,
  projects,
  onSelect,
}: {
  name: string;
  projects: Project[];
  onSelect: (p: Project) => void;
}) {
  const total = projects.reduce((s, p) => s + Number(p.confirmedRevenue), 0);
  const years = Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white py-1">
        <span className="text-sm font-bold text-slate-800 truncate">{name}</span>
        <span className="text-[11px] text-slate-400">{projects.length}건</span>
        <span className="text-[11px] text-slate-400">· {years.join(", ")}년</span>
        <span className="text-[11px] text-slate-500 tabular-nums">· ₩{total.toLocaleString()}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <tbody>
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} onSelect={onSelect} showYear />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onSelect,
  showYear,
}: {
  project: Project;
  onSelect: (p: Project) => void;
  showYear?: boolean;
}) {
  const biz = getBizMeta(project.bizCategory);
  const status = getStatusMeta(project.status);
  return (
    <tr
      onClick={() => onSelect(project)}
      className="border-b border-slate-100 last:border-0 hover:bg-brand-50/40 cursor-pointer group"
    >
      {showYear && (
        <td className="px-3 py-2 w-16 font-mono text-[10px] text-slate-500 tabular-nums">{project.year}</td>
      )}
      <td className="px-3 py-2 w-16 font-mono text-[10.5px] text-slate-500">{project.displayCode ?? "—"}</td>
      <td className="px-3 py-2 font-medium text-slate-800">{project.title}</td>
      <td className="px-3 py-2 w-24">
        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] ring-1 font-medium whitespace-nowrap", biz.color)}>
          {biz.label}
        </span>
      </td>
      <td className="px-3 py-2 w-28">
        <span className="text-[10.5px] text-slate-600">{getServiceLabel(project.serviceType) || "—"}</span>
        {project.serviceDetail && (
          <span className="text-[10px] text-slate-400 block truncate">{project.serviceDetail}</span>
        )}
      </td>
      <td className="px-3 py-2 w-28">
        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", status.color)}>
          {status.label}
        </span>
      </td>
      <td className="px-3 py-2 w-32 text-right tabular-nums text-slate-700">
        ₩{Number(project.confirmedRevenue).toLocaleString()}
      </td>
      <td className="px-2 w-8 text-slate-300 group-hover:text-brand-600">
        <ExternalLink className="w-3 h-3" />
      </td>
    </tr>
  );
}
