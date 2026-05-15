import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";
import MajorTasksWidgetClient from "@/components/MajorTasksWidgetClient";

export default async function MajorTasksWidget() {
  const me = await getCurrentUser();
  if (!me) return null;

  // 대시보드에는 미완료(진행중)만 표시 — 전체보기는 별도 페이지
  const tasks = await prisma.majorTask.findMany({
    where: { completed: false },
    include: { assignee: { select: { id: true, name: true, pmCode: true } } },
    orderBy: [
      { targetDate: { sort: "asc", nulls: "last" } },
      { sortOrder: "asc" },
    ],
  });

  const users = await prisma.user.findMany({
    where: { status: "active" },
    select: { id: true, name: true, pmCode: true, position: true },
    orderBy: { name: "asc" },
  });

  return (
    <MajorTasksWidgetClient initialTasks={tasks.map(serializeProject) as any} users={users as any} />
  );
}
