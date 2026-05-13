"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인 실패");
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "네트워크 오류");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 overflow-hidden">
        {/* 로고 영역 */}
        <div className="px-8 pt-10 pb-6 text-center bg-gradient-to-b from-white to-slate-50/50">
          <div className="flex items-center justify-center mb-3">
            <Image
              src="/daedong-logo.png"
              alt="대동CMC"
              width={220}
              height={60}
              priority
              className="h-auto"
            />
          </div>
          <p className="text-xs text-slate-500 tracking-wider font-medium">통합 ERP 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={onSubmit} className="px-8 pb-8 pt-2 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="사원번호 또는 ID"
              autoFocus
              required
              className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-200 outline-none text-sm transition"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-200 outline-none text-sm transition"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 disabled:opacity-60 text-white font-semibold rounded-lg shadow-md flex items-center justify-center gap-2 transition"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            로그인
          </button>
        </form>

        {/* 푸터 */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-3 text-center">
          <p className="text-[10.5px] text-slate-400">© 2026 (주)대동CMC. All rights reserved.</p>
        </div>
      </div>

      {/* 도움말 */}
      <p className="mt-4 text-center text-[11px] text-slate-400">
        비밀번호를 잊으셨나요? 관리자에게 문의하세요.
      </p>
    </div>
  );
}
