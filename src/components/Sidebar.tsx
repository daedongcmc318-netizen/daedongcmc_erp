"use client";
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
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { group: "메인", items: [{ href: "/", label: "대시보드", icon: LayoutDashboard }] },
  {
    group: "사업",
    items: [
      { href: "/projects", label: "프로젝트 관리", icon: FolderKanban },
      { href: "/managers", label: "담당자별 관리", icon: UserCheck },
      { href: "/companies", label: "업체/거래처", icon: Building2 },
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

export default function Sidebar() {
  const pathname = usePathname();

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
                const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition",
                        active
                          ? "bg-brand-50 text-brand-700 font-medium"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon className={clsx("w-4 h-4", active ? "text-brand-600" : "text-slate-400")} />
                      {it.label}
                    </Link>
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
