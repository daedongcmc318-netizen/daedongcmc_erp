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
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusM: number;
  isPrimary?: boolean;
};

import { prisma } from "@/lib/prisma";

const SETTING_KEY = "office_locations"; // 신규: 복수 지사 지원 (배열)
const LEGACY_KEY = "office_location"; // 기존: 단일 사무실 (단일 객체)

/**
 * 모든 지사 위치 반환. 신규 키 'office_locations' 우선,
 * 없으면 legacy 'office_location' (단일) 을 [1개 배열]로 변환해 반환.
 */
export async function getOfficeLocations(): Promise<OfficeLocation[]> {
  const s = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (s) {
    try {
      const parsed = JSON.parse(s.value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fallthrough */
    }
  }
  // legacy fallback
  const legacy = await prisma.appSetting.findUnique({ where: { key: LEGACY_KEY } });
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy.value);
      if (parsed && typeof parsed === "object" && parsed.lat != null) {
        return [{ id: "legacy", isPrimary: true, ...parsed }];
      }
    } catch {
      /* fallthrough */
    }
  }
  return [];
}

export async function setOfficeLocations(list: OfficeLocation[]): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(list) },
    update: { value: JSON.stringify(list) },
  });
}

/** Legacy 호환: 기본(첫 번째) 사무실 반환 */
export async function getOfficeLocation(): Promise<OfficeLocation | null> {
  const list = await getOfficeLocations();
  if (list.length === 0) return null;
  return list.find((x) => x.isPrimary) ?? list[0];
}

/** Legacy 호환: 단일 사무실 저장 (배열의 첫 항목 갱신/생성) */
export async function setOfficeLocation(loc: Omit<OfficeLocation, "id"> & { id?: string }): Promise<void> {
  const list = await getOfficeLocations();
  if (list.length === 0) {
    await setOfficeLocations([{ id: "hq", isPrimary: true, ...loc }]);
    return;
  }
  // 첫 항목 update
  const updated = list.map((x, i) =>
    i === 0 ? { ...x, ...loc, id: x.id } : x
  );
  await setOfficeLocations(updated);
}

/**
 * 주어진 좌표가 어느 지사 반경 안에 있는지 검사.
 * 가장 가까운 지사와 거리, 통과 여부 반환.
 */
export async function checkInRadius(lat: number, lng: number): Promise<{
  ok: boolean;
  nearest: OfficeLocation | null;
  distance: number | null;
}> {
  const list = await getOfficeLocations();
  if (list.length === 0) return { ok: false, nearest: null, distance: null };

  let nearest: OfficeLocation | null = null;
  let minDist = Infinity;
  let ok = false;
  for (const loc of list) {
    const d = haversineMeters(lat, lng, loc.lat, loc.lng);
    if (d < minDist) {
      minDist = d;
      nearest = loc;
    }
    if (d <= loc.radiusM) {
      ok = true;
      nearest = loc;
      minDist = d;
      break;
    }
  }
  return { ok, nearest, distance: minDist === Infinity ? null : minDist };
}
