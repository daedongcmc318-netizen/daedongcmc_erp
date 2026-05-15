import UsersClient from "@/components/UsersClient";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage() {
  // 직원관리에는 비활성/퇴사 직원 포함 전체 노출 (계정관리에서 비활성한 것과는 별개)
  // 활성 → 휴직 → 비활성 순으로 정렬
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { empNo: "asc" }],
  });
  return <UsersClient initialUsers={users.map(serializeProject) as any} />;
}
