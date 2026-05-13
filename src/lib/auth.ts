import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "ddcmc_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14일

function secret() {
  return process.env.SESSION_SECRET ?? "dev-secret-change-me";
}

function sign(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = crypto.createHmac("sha256", secret()).update(`${userId}.${ts}`).digest("hex");
  if (sig !== expected) return null;
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
