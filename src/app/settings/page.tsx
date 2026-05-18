import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOfficeLocations } from "@/lib/geo";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/settings");
  if (me.role !== "admin") {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">관리자(admin)만 시스템 설정에 접근할 수 있습니다.</p>
      </div>
    );
  }

  const offices = await getOfficeLocations();
  return <SettingsClient initialOffices={offices} />;
}
