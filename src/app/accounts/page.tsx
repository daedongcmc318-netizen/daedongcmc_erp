import { redirect } from "next/navigation";
import AccountsClient from "@/components/AccountsClient";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/accounts");
  if (me.role !== "admin") {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">계정관리는 관리자(admin) 권한 사용자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { empNo: "asc" }],
    select: {
      id: true,
      empNo: true,
      name: true,
      email: true,
      dept: true,
      position: true,
      role: true,
      pmCode: true,
      status: true,
      passwordHash: true,
      updatedAt: true,
    },
  });
  const enriched = users.map((u) => ({
    ...u,
    hasPassword: !!u.passwordHash,
    passwordHash: undefined,
    updatedAt: u.updatedAt.toISOString(),
  }));

  return <AccountsClient initialUsers={enriched as any} currentUserId={me.id} />;
}
