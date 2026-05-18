import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocation, haversineMeters } from "@/lib/geo";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * POST { action: "check_in"|"check_out", notes? } — 출근/퇴근 체크
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { isInternal: true } });
  if (!u?.isInternal && me.role !== "admin") {
    return NextResponse.json({ error: "내부직원만 근태 체크가 가능합니다." }, { status: 403 });
  }

  const body = await req.json();
  const { action, notes, lat, lng, accuracy } = body;
  const today = dateOnly(new Date());
  const now = new Date();
  const ip = getIp(req);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: me.id, date: today } },
  });

  // GPS 검증 — 출근/퇴근 시 lat/lng 필수 + 반경 강제
  let distance: number | null = null;
  if (action === "check_in" || action === "check_out") {
    if (lat == null || lng == null) {
      return NextResponse.json(
        {
          error: "위치 정보(GPS)가 필요합니다. 휴대폰 위치 권한을 허용하고 다시 시도하세요.",
        },
        { status: 400 }
      );
    }
    const office = await getOfficeLocation();
    if (!office) {
      return NextResponse.json(
        { error: "사무실 위치가 설정되지 않았습니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }
    distance = haversineMeters(Number(lat), Number(lng), office.lat, office.lng);
    // 반경 초과 시 차단 — admin도 동일하게 적용. 예외 처리가 필요하면 관리자가 /attendance 페이지에서 수동 편집.
    if (distance > office.radiusM) {
      return NextResponse.json(
        {
          error: `사무실에서 너무 멉니다. 현재 ${Math.round(distance)}m (허용 반경 ${office.radiusM}m, 기준: ${office.name})`,
          distance,
          officeRadius: office.radiusM,
        },
        { status: 403 }
      );
    }
  }

  if (action === "check_in") {
    if (existing?.checkIn) {
      return NextResponse.json({ error: "이미 출근 기록되어 있습니다.", attendance: existing }, { status: 400 });
    }
    const data: any = {
      checkIn: now,
      checkInIp: ip,
      checkInLat: lat != null ? Number(lat) : null,
      checkInLng: lng != null ? Number(lng) : null,
      checkInDistance: distance,
      status: "working",
      notes: notes ?? existing?.notes ?? null,
    };
    const att = existing
      ? await prisma.attendance.update({ where: { id: existing.id }, data })
      : await prisma.attendance.create({ data: { userId: me.id, date: today, ...data } });
    revalidatePath("/attendance");
    revalidatePath("/");
    return NextResponse.json(att);
  }

  if (action === "check_out") {
    if (!existing || !existing.checkIn) {
      return NextResponse.json({ error: "출근 기록이 없습니다." }, { status: 400 });
    }
    if (existing.checkOut) {
      return NextResponse.json({ error: "이미 퇴근 기록되어 있습니다.", attendance: existing }, { status: 400 });
    }
    const att = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        checkOutIp: ip,
        checkOutLat: lat != null ? Number(lat) : null,
        checkOutLng: lng != null ? Number(lng) : null,
        checkOutDistance: distance,
        notes: notes ?? existing.notes,
      },
    });
    revalidatePath("/attendance");
    revalidatePath("/");
    return NextResponse.json(att);
  }

  // 출장/근무 등 상태 토글 (오늘 기록 새로 생성하거나 갱신)
  if (action === "set_status") {
    const newStatus = String(body.status ?? "working");
    const VALID = new Set(["working", "business_trip", "off"]);
    if (!VALID.has(newStatus)) {
      return NextResponse.json({ error: "허용되지 않는 상태" }, { status: 400 });
    }
    const att = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { status: newStatus, notes: notes ?? existing.notes },
        })
      : await prisma.attendance.create({
          data: { userId: me.id, date: today, status: newStatus, notes: notes ?? null },
        });
    revalidatePath("/attendance");
    revalidatePath("/");
    return NextResponse.json(att);
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}

/**
 * GET ?userId=&from=&to= 근태 내역
 *   userId 없으면 본인.
 *   admin/manager는 다른 사용자 조회 가능. staff는 본인만.
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const userId = userIdParam ?? me.id;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (userId !== me.id && me.role === "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: any = { userId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const items = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(items);
}
