import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import ConsultantMDClient from "@/components/ConsultantMDClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConsultantMDPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/consultant-md");

  const year = Number(searchParams.year ?? 2026);

  const [plans, users, projects] = await Promise.all([
    prisma.consultantPlan.findMany({
      where: { year },
      include: {
        manager: { select: { id: true, name: true } },
        project: { select: { id: true, title: true, displayCode: true } },
        assignments: { select: { id: true, date: true, consultantId: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "active" },
      select: {
        id: true, name: true, dept: true, position: true, isInternal: true, pmCode: true,
        consultantGrade: true, consultantRate: true,
      },
      orderBy: [{ consultantGrade: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: { year },
      select: { id: true, title: true, displayCode: true, year: true, managerId: true, confirmedRevenue: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <ConsultantMDClient
      year={year}
      initialPlans={plans.map(serializeProject) as any}
      users={users as any}
      projects={projects.map(serializeProject) as any}
    />
  );
}
