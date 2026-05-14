import { redirect } from "next/navigation";
import PermissionsClient from "@/components/PermissionsClient";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PermissionsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/permissions");
  if (me.role !== "admin") {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">권한관리는 관리자(admin) 권한 사용자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const perms = await prisma.permission.findMany({
    orderBy: [{ role: "asc" }, { section: "asc" }],
  });
  return <PermissionsClient initialPerms={perms} />;
}
