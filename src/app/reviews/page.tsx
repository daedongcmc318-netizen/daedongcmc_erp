import { redirect } from "next/navigation";
import ReviewsClient from "@/components/ReviewsClient";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serializeProject } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReviewsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/reviews");

  // 검토 대시보드 접근: admin OR manager (책임연구원/이사/팀장 등 모두 포함)
  const canReview = me.role === "admin" || me.role === "manager";
  if (!canReview) {
    return (
      <div className="px-6 py-16 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold mb-2">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">산출물 검토는 관리자 또는 매니저 권한만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const [pending, recent] = await Promise.all([
    // 검토 대기 (in_review)
    prisma.projectDeliverable.findMany({
      where: { reviewStatus: "in_review" },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            displayCode: true,
            year: true,
            bizCategory: true,
            serviceType: true,
            serviceDetail: true,
            status: true,
            manager: { select: { id: true, name: true, pmCode: true } },
          },
        },
      },
      orderBy: { reviewSubmittedAt: "asc" },
    }),
    // 최근 처리 (approved + revision, 50건)
    prisma.projectDeliverable.findMany({
      where: { reviewStatus: { in: ["approved", "revision"] } },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            displayCode: true,
            year: true,
            manager: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <ReviewsClient
      me={{ id: me.id, name: me.name, role: me.role }}
      pending={pending.map(serializeProject) as any}
      recent={recent.map(serializeProject) as any}
    />
  );
}
