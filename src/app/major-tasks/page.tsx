import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import MajorTasksPageClient from "@/components/MajorTasksPageClient";

export const dynamic = "force-dynamic";

export default async function MajorTasksPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/major-tasks");

  const [tasks, users] = await Promise.all([
    prisma.majorTask.findMany({
      include: { assignee: { select: { id: true, name: true, pmCode: true } } },
      orderBy: [
        { completed: "asc" },
        { targetDate: { sort: "asc", nulls: "last" } },
        { sortOrder: "asc" },
      ],
    }),
    prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, pmCode: true, position: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <MajorTasksPageClient initialTasks={tasks.map(serializeProject) as any} users={users as any} />;
}
