import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import TrackRecordsClient from "@/components/TrackRecordsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TrackRecordsPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string; year?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/track-records");

  const records = await prisma.trackRecord.findMany({
    include: { clientCompany: { select: { id: true, name: true } } },
    orderBy: [{ type: "asc" }, { processedDate: "desc" }, { seqNo: "desc" }],
  });

  // 옵션: 사용된 연도/상태/지원사업 목록 (필터 옵션용)
  const innoRecords = records.filter((r) => r.type === "innovation");
  const usedYears = Array.from(new Set(innoRecords.map((r) => r.year).filter((y): y is number => y != null))).sort(
    (a, b) => b - a
  );
  const usedStatuses = Array.from(new Set(records.map((r) => r.status).filter(Boolean) as string[])).sort();
  const usedPrograms = Array.from(
    new Set(innoRecords.map((r) => r.supportProgram).filter(Boolean) as string[])
  ).sort();

  return (
    <TrackRecordsClient
      initialRecords={records.map(serializeProject) as any}
      usedYears={usedYears}
      usedStatuses={usedStatuses}
      usedPrograms={usedPrograms}
    />
  );
}
