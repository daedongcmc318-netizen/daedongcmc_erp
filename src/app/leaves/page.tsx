import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getUserLeaveBalance, resolveApprovalLine } from "@/lib/leaves";
import LeavesClient from "@/components/LeavesClient";

export const dynamic = "force-dynamic";

export default async function LeavesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?from=/leaves");

  const myUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, name: true, dept: true, position: true, isInternal: true, joinDate: true },
  });
  if (!myUser) redirect("/login");

  const balance = await getUserLeaveBalance(me.id);
  const approvalLine = await resolveApprovalLine();

  // 내 신청 + 내가 결재할 건
  const [myRequests, toApprove] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { userId: me.id },
      include: {
        user: { select: { id: true, name: true, dept: true, position: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, position: true } } },
          orderBy: { level: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "pending",
        approvals: { some: { approverId: me.id, status: "pending" } },
      },
      include: {
        user: { select: { id: true, name: true, dept: true, position: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, position: true } } },
          orderBy: { level: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const serialize = (v: any): any => {
    if (v == null) return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(serialize);
    if (typeof v === "object") {
      const o: any = {};
      for (const k of Object.keys(v)) o[k] = serialize(v[k]);
      return o;
    }
    return v;
  };

  return (
    <LeavesClient
      me={{
        id: myUser.id,
        name: myUser.name,
        dept: myUser.dept,
        position: myUser.position,
        isInternal: myUser.isInternal,
        joinDate: myUser.joinDate ? myUser.joinDate.toISOString() : null,
      }}
      balance={balance}
      approvalLine={approvalLine}
      myRequests={serialize(myRequests)}
      toApprove={serialize(toApprove)}
    />
  );
}
