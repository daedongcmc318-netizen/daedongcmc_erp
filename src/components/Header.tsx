"use client";
import { Search, Bell, LogOut, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  user: {
    id: string;
    name: string;
    empNo: string;
    dept: string;
    position: string;
    pmCode: string | null;
    role: string;
  } | null;
};

export default function Header({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:bg-white border border-transparent focus:border-brand-300"
            placeholder="프로젝트, 업체, 직원 검색..."
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2.5 pl-3 pr-2 h-10 border-l border-slate-200 hover:bg-slate-50 rounded transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-semibold flex items-center justify-center">
                {user.pmCode ?? user.name.slice(0, 2)}
              </div>
              <div className="text-right leading-tight">
                <div className="text-[13px] font-medium">{user.name}</div>
                <div className="text-[10px] text-slate-500">{user.position}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-12 z-40 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[200px] py-1">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-medium text-slate-800">{user.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {user.dept} · {user.position}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {user.empNo}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> 로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
