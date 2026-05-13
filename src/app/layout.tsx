import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "대동CMC ERP",
  description: "대동CMC 통합 ERP 시스템",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") || "";
  const isLogin = pathname === "/login";
  const user = isLogin ? null : await getCurrentUser();

  // 로그인 페이지는 사이드바/헤더 없이 children만 렌더
  if (isLogin) {
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Header user={user} />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
