import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "ddcmc_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14일

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "dev-secret-change-me") {
    if (process.env.NODE_ENV === "production") {
      // 운영에서 시크릿 누락은 치명적 — 토큰 위조 가능. 명시적 오류로 차단.
      throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다. Vercel 환경변수에 충분히 긴 랜덤 문자열을 설정하세요.");
    }
    return "dev-secret-change-me";
  }
  if (s.length < 32) {
    console.warn("[auth] SESSION_SECRET 이 너무 짧습니다 (권장: 32자 이상)");
  }
  return s;
}

function sign(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  // timingSafeEqual 호환을 위해 hex
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(`${userId}.${ts}`).digest("hex");
  // 상수시간 비교 (timing attack 방지)
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  // 만료 검증 — 발급 시각이 MAX_AGE 보다 오래되면 거부
  const issuedAt = Number(ts);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE * 1000) return null;
  return userId;
}

export function setSessionCookie(userId: string) {
  cookies().set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

export async function getCurrentUser() {
  const c = cookies().get(COOKIE_NAME);
  if (!c) return null;
  const userId = verify(c.value);
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      empNo: true,
      name: true,
      email: true,
      dept: true,
      position: true,
      role: true,
      pmCode: true,
    },
  });
}

export const SESSION_COOKIE = COOKIE_NAME;
