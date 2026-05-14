import ExpensesClient from "@/components/ExpensesClient";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const me = await getCurrentUser();
  const [expenses, users, projects, tripReports, leaveRequests] = await Promise.all([
    prisma.expenseRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, pmCode: true } },
        approver: { select: { id: true, name: true, pmCode: true } },
        project: { select: { id: true, title: true, displayCode: true, year: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: { not: "inactive" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, empNo: true, dept: true, position: true, pmCode: true, role: true },
    }),
    prisma.project.findMany({
      orderBy: [{ year: "desc" }, { sortOrder: "asc" }],
      select: { id: true, title: true, displayCode: true, year: true },
      take: 300,
    }),
    // 출장신청서 (본인 또는 admin: 전체)
    prisma.tripReport.findMany({
      where: me?.role === "admin" ? {} : { userId: me?.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, position: true } } },
    }),
    // 휴가신청서 (본인 또는 admin: 전체)
    prisma.leaveRequest.findMany({
      where: me?.role === "admin" ? {} : { userId: me?.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, position: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, position: true } } },
          orderBy: { level: "asc" },
        },
      },
    }),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses.map(serializeProject) as any}
      users={users as any}
      projects={projects as any}
      me={me as any}
      tripReports={tripReports.map(serializeProject) as any}
      leaveRequests={leaveRequests.map(serializeProject) as any}
    />
  );
}
