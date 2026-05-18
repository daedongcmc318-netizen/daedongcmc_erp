import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocations, setOfficeLocations, type OfficeLocation } from "@/lib/geo";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (me.role !== "admin")
    return { err: NextResponse.json({ error: "Forbidden — admin 만 가능" }, { status: 403 }) };
  return { me };
}

/** PATCH — 특정 지사 부분 수정 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if ("err" in guard) return guard.err;

  const body = await req.json();
  const list = await getOfficeLocations();
  const idx = list.findIndex((x) => x.id === params.id);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let next: OfficeLocation[] = list.map((x, i) =>
    i === idx
      ? {
          ...x,
          name: body.name != null ? String(body.name).trim() : x.name,
          address: body.address != null ? String(body.address) : x.address,
          lat: body.lat != null ? Number(body.lat) : x.lat,
          lng: body.lng != null ? Number(body.lng) : x.lng,
          radiusM: body.radiusM != null ? Number(body.radiusM) : x.radiusM,
          isPrimary: body.isPrimary != null ? !!body.isPrimary : x.isPrimary,
        }
      : x
  );

  // primary 단일 보장
  if (body.isPrimary === true) {
    next = next.map((x, i) => ({ ...x, isPrimary: i === idx }));
  }
  await setOfficeLocations(next);
  revalidatePath("/settings");
  revalidatePath("/m/attendance");
  return NextResponse.json({ ok: true, branch: next[idx] });
}

/** DELETE — 특정 지사 삭제 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if ("err" in guard) return guard.err;

  const list = await getOfficeLocations();
  const next = list.filter((x) => x.id !== params.id);
  if (next.length === list.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // primary 가 사라졌으면 첫 항목으로 승격
  if (next.length > 0 && !next.some((x) => x.isPrimary)) {
    next[0].isPrimary = true;
  }
  await setOfficeLocations(next);
  revalidatePath("/settings");
  revalidatePath("/m/attendance");
  return NextResponse.json({ ok: true, count: next.length });
}
