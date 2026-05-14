import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "대동CMC ERP",
  description: "대동CMC 통합 ERP 시스템",
  manifest: "/manifest.json",
  themeColor: "#3f63f5",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "대동근태",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") || "";
  const isLogin = pathname === "/login";
  const isMobile = pathname.startsWith("/m/");
  const user = isLogin ? null : await getCurrentUser();

  // 로그인 페이지는 사이드바/헤더 없이 children만 렌더
  if (isLogin) {
    return (
      <html lang="ko">
        <head>
          <link rel="apple-touch-icon" href="/daedong-logo.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body>{children}</body>
      </html>
    );
  }

  // /m/* (모바일 PWA) 는 사이드바/헤더 없이 풀스크린
  if (isMobile) {
    return (
      <html lang="ko">
        <head>
          <link rel="apple-touch-icon" href="/daedong-logo.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        </head>
        <body className="bg-slate-50">{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/daedong-logo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar role={user?.role ?? null} />
          <div className="flex flex-1 flex-col min-w-0">
            <Header user={user} />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
