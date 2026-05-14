import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import TripReportsClient from "@/components/TripReportsClient";

export const dynamic = "force-dynamic";

export default async function ExpenseTripsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/expense-trips");

  const reports = await prisma.tripReport.findMany({
    where: { userId: me.id },
    include: { user: { select: { id: true, name: true, position: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <TripReportsClient
      me={{ id: me.id, name: me.name }}
      initialReports={reports.map(serializeProject) as any}
    />
  );
}
