import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocation, setOfficeLocation } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const loc = await getOfficeLocation();
  return NextResponse.json(loc);
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radiusM = Number(body.radiusM ?? 200);
  if (isNaN(lat) || isNaN(lng) || isNaN(radiusM)) {
    return NextResponse.json({ error: "lat/lng/radiusM 숫자 필수" }, { status: 400 });
  }

  await setOfficeLocation({
    name: String(body.name ?? "사무실"),
    address: body.address ?? "",
    lat,
    lng,
    radiusM,
  });
  revalidatePath("/settings");
  revalidatePath("/m/attendance");
  return NextResponse.json({ ok: true });
}
