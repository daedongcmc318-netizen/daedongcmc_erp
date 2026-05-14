/** Haversine 공식 — 두 지점 간 거리 (m) */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름 (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type OfficeLocation = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
};

import { prisma } from "@/lib/prisma";

export async function getOfficeLocation(): Promise<OfficeLocation | null> {
  const s = await prisma.appSetting.findUnique({ where: { key: "office_location" } });
  if (!s) return null;
  try {
    return JSON.parse(s.value);
  } catch {
    return null;
  }
}

export async function setOfficeLocation(loc: OfficeLocation): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: "office_location" },
    create: { key: "office_location", value: JSON.stringify(loc) },
    update: { value: JSON.stringify(loc) },
  });
}
