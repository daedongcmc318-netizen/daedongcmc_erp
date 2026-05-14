"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Receipt,
  Clock,
  CalendarDays,
  Users,
  FileSpreadsheet,
  Settings,
  CreditCard,
  FileSignature,
  KeyRound,
  UserCheck,
  ShieldCheck,
  ClipboardCheck,
  ChevronRight,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
  children?: NavItem[];
};

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "메인", items: [{ href: "/", label: "대시보드", icon: LayoutDashboard }] },
  {
    group: "사업",
    items: [
      {
        href: "/projects",
        label: "프로젝트 관리",
        icon: FolderKanban,
        children: [
          { href: "/managers", label: "담당자별 관리", icon: UserCheck },
          { href: "/reviews", label: "산출물 검토", icon: ClipboardCheck },
        ],
      },
      {
        href: "/companies",
        label: "업체/거래처",
        icon: Building2,
        children: [
          { href: "/mgmt-fees", label: "업체별 관리비", icon: Wallet, adminOnly: true },
        ],
      },
      { href: "/invoices", label: "세금계산서", icon: FileSpreadsheet },
      { href: "/card-purchases", label: "카드매입", icon: CreditCard },
    ],
  },
  {
    group: "결재",
    items: [{ href: "/expenses", label: "지출결의", icon: Receipt }],
  },
  {
    group: "인사관리",
    items: [
      { href: "/users", label: "직원 관리", icon: Users },
      { href: "/contracts", label: "전자근로계약", icon: FileSignature },
      { href: "/attendance", label: "근태", icon: Clock },
      { href: "/leaves", label: "연차/휴가", icon: CalendarDays },
    ],
  },
  {
    group: "시스템",
    items: [
      { href: "/settings", label: "설정", icon: Settings },
      { href: "/accounts", label: "계정관리", icon: KeyRound },
      { href: "/permissions", label: "권한관리", icon: ShieldCheck },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export default function Sidebar({ role }: { role: string | null }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  // 현재 경로의 부모 메뉴를 펼침
  const initialExpanded = new Set<string>();
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.children?.some((c) => isActive(pathname, c.href))) {
        initialExpanded.add(item.href);
      }
    }
  }
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  // 경로가 바뀌면 해당 메뉴 자동 펼침
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const section of NAV) {
        for (const item of section.items) {
          if (item.children?.some((c) => isActive(pathname, c.href))) {
            next.add(item.href);
          }
        }
      }
      return next;
    });
  }, [pathname]);

  function toggle(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white font-bold text-sm">
          D
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">대동CMC</div>
          <div className="text-[10px] text-slate-500">통합 ERP</div>
        </div>
      </div>
      <nav className="px-3 py-4 space-y-5">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="px-2 mb-1 text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
              {section.group}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((it) => {
                if (it.adminOnly && !isAdmin) return null;
                const active = isActive(pathname, it.href);
                const Icon = it.icon;
                const hasChildren = !!it.children?.length;
                const visibleChildren = (it.children ?? []).filter((c) => !c.adminOnly || isAdmin);
                const isExpanded = expanded.has(it.href);
                return (
                  <li key={it.href}>
                    <div className="flex items-center gap-0.5">
                      <Link
                        href={it.href}
                        className={clsx(
                          "flex-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition",
                          active
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Icon className={clsx("w-4 h-4", active ? "text-brand-600" : "text-slate-400")} />
                        {it.label}
                      </Link>
                      {hasChildren && visibleChildren.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggle(it.href)}
                          aria-label={`${it.label} 하위 메뉴 토글`}
                          className={clsx(
                            "p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          )}
                        >
                          <ChevronRight
                            className={clsx(
                              "w-3.5 h-3.5 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </button>
                      )}
                    </div>
                    {hasChildren && isExpanded && visibleChildren.length > 0 && (
                      <ul className="mt-0.5 ml-3 pl-3 border-l border-slate-100 space-y-0.5">
                        {visibleChildren.map((child) => {
                          const cActive = isActive(pathname, child.href);
                          const CIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={clsx(
                                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition",
                                  cActive
                                    ? "bg-brand-50 text-brand-700 font-medium"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                )}
                              >
                                <CIcon className={clsx("w-3.5 h-3.5", cActive ? "text-brand-600" : "text-slate-400")} />
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
