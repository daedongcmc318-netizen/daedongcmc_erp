import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  getOfficeLocations,
  setOfficeLocations,
  type OfficeLocation,
} from "@/lib/geo";

export const dynamic = "force-dynamic";

/** GET — 모든 지사 위치 (배열) 반환. 로그인 사용자 누구나 조회 가능 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await getOfficeLocations();
  return NextResponse.json(list);
}

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "admin")
    return { err: NextResponse.json({ error: "Forbidden — admin 만 가능" }, { status: 403 }) };
  return { me };
}

function validateBranch(b: any): OfficeLocation | { error: string } {
  const name = String(b?.name ?? "").trim();
  if (!name) return { error: "이름 필수" };
  const lat = Number(b?.lat);
  const lng = Number(b?.lng);
  const radiusM = Number(b?.radiusM ?? 200);
  if (isNaN(lat) || isNaN(lng) || isNaN(radiusM))
    return { error: "lat/lng/radiusM 숫자 필수" };
  return {
    id: String(b?.id ?? `br_${Date.now().toString(36)}`),
    name,
    address: b?.address ?? "",
    lat,
    lng,
    radiusM,
    isPrimary: !!b?.isPrimary,
  };
}

/** POST — 지사 추가 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("err" in guard) return guard.err;

  const body = await req.json();
  const v = validateBranch(body);
  if ("error" in v) return NextResponse.json(v, { status: 400 });

  const list = await getOfficeLocations();
  // 첫 번째 추가 시 자동으로 primary
  if (list.length === 0) v.isPrimary = true;
  // id 중복 회피
  if (list.some((x) => x.id === v.id)) v.id = `br_${Date.now().toString(36)}`;
  // primary 마킹 시 다른 곳들 primary false
  const next = (v.isPrimary ? list.map((x) => ({ ...x, isPrimary: false })) : list).concat(v);
  await setOfficeLocations(next);
  revalidatePath("/settings");
  revalidatePath("/m/attendance");
  return NextResponse.json({ ok: true, branch: v });
}

/** PATCH — 배열이면 전체 교체. 단일 객체면 기존 호환 (첫 항목 갱신) */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if ("err" in guard) return guard.err;

  const body = await req.json();
  if (Array.isArray(body)) {
    const out: OfficeLocation[] = [];
    for (const b of body) {
      const v = validateBranch(b);
      if ("error" in v)
        return NextResponse.json({ error: `${v.error} — ${JSON.stringify(b)}` }, { status: 400 });
      out.push(v);
    }
    if (!out.some((x) => x.isPrimary) && out[0]) out[0].isPrimary = true;
    await setOfficeLocations(out);
    revalidatePath("/settings");
    revalidatePath("/m/attendance");
    return NextResponse.json({ ok: true, count: out.length });
  }

  const v = validateBranch(body);
  if ("error" in v) return NextResponse.json(v, { status: 400 });
  const list = await getOfficeLocations();
  if (list.length === 0) {
    v.isPrimary = true;
    await setOfficeLocations([v]);
  } else {
    const next = list.map((x, i) => (i === 0 ? { ...x, ...v, id: x.id } : x));
    await setOfficeLocations(next);
  }
  revalidatePath("/settings");
  revalidatePath("/m/attendance");
  return NextResponse.json({ ok: true });
}
