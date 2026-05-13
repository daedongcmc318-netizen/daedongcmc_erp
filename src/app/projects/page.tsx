import ProjectsClient from "@/components/ProjectsClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectsPage() {
  const [projects, companies, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        company: { include: { contacts: { take: 1, orderBy: { isPrimary: "desc" } } } },
        agency: true,
        manager: true,
        taxInvoices: { orderBy: { createdAt: "asc" } },
        deliverables: { orderBy: { seq: "asc" } },
      },
      orderBy: [{ source: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, pmCode: true, position: true },
    }),
  ]);

  return (
    <ProjectsClient
      initialProjects={projects.map(serializeProject) as any}
      companies={companies as any}
      users={users as any}
    />
  );
}
