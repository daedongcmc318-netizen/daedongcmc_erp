import ContractsClient from "@/components/ContractsClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [contracts, users, projects] = await Promise.all([
    prisma.laborContract.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { status: { not: "inactive" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, empNo: true, dept: true, position: true, email: true, mobile: true },
    }),
    prisma.project.findMany({
      orderBy: [{ year: "desc" }, { sortOrder: "asc" }],
      select: { id: true, title: true, displayCode: true, year: true },
      take: 200,
    }),
  ]);
  return (
    <ContractsClient
      initialContracts={contracts.map(serializeProject) as any}
      users={users as any}
      projects={projects as any}
    />
  );
}
