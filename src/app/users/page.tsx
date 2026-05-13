import UsersClient from "@/components/UsersClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { status: { not: "inactive" } },
    orderBy: { empNo: "asc" },
  });
  return <UsersClient initialUsers={users.map(serializeProject) as any} />;
}
