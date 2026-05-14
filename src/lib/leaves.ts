/**
 * 휴가/연차 계산 로직 (한국 근로기준법 60조 준거)
 *
 * - 1년 미만: 매월 개근 시 1일씩 발생 (월차), 최대 11일
 * - 1년 이상 ~ 3년 미만: 연 15일
 * - 3년 이상: 2년마다 +1일, 최대 25일
 *
 * 결재 라인 (3단계, 직급 기반):
 *   Level 1: 본부장 (책임연구원/이사/전무이사 등 본부 리더 — 김혜진 책임이 사업운영본부장 역할)
 *   Level 2: 부대표 (박지윤)
 *   Level 3: 대표이사 (최진혁)
 *
 * 신청자가 결재 라인 중 한 명이면 자기 단계는 auto_passed 처리.
 */

import { prisma } from "@/lib/prisma";

export const LEAVE_TYPES = [
  // 차감 대상 (연차/월차/반차 모두 annualLeave 잔여에서 차감)
  { value: "annual", label: "연차", deducts: true, halfDay: false },
  { value: "monthly", label: "월차", deducts: true, halfDay: false },
  { value: "half_am", label: "오전반차", deducts: true, halfDay: true },
  { value: "half_pm", label: "오후반차", deducts: true, halfDay: true },
  // 차감 없음 (별도 카운트)
  { value: "public", label: "공가", deducts: false, halfDay: false },
  { value: "sick", label: "병가", deducts: false, halfDay: false },
  { value: "maternity", label: "출산휴가", deducts: false, halfDay: false, special: true },
  { value: "summer", label: "하계휴가", deducts: false, halfDay: false, special: true },
  { value: "family_event", label: "경조휴가", deducts: false, halfDay: false, special: true },
  { value: "disaster", label: "재해휴가", deducts: false, halfDay: false, special: true },
  { value: "health", label: "보건휴가", deducts: false, halfDay: false },
  { value: "other", label: "기타", deducts: false, halfDay: false },
] as const;

export function getLeaveTypeLabel(type: string): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function getLeaveTypeMeta(type: string) {
  return LEAVE_TYPES.find((t) => t.value === type);
}

export const APPROVAL_LEVELS = [
  { level: 1, label: "본부장", role: "headquarters_lead" },
  { level: 2, label: "부대표", role: "vice_ceo" },
  { level: 3, label: "대표이사", role: "ceo" },
] as const;

/**
 * 근속연차에 따른 연차 자동계산.
 * 입사 1년 미만 → 0 (월차로 처리)
 * 1년~3년 미만 → 15
 * 3년 이후 매 2년마다 +1, 최대 25일
 */
export function calculateAnnualLeaveTotal(joinDate: Date | null, asOf: Date = new Date()): number {
  if (!joinDate) return 0;
  const months = monthsBetween(joinDate, asOf);
  if (months < 12) return 0; // 1년 미만은 월차로 부여
  const years = Math.floor(months / 12);
  if (years < 3) return 15;
  // 3년부터 16일, 5년 17, 7년 18, ... 21년 이상 25일
  const extra = Math.floor((years - 1) / 2); // 3년→1, 5년→2, ...
  return Math.min(15 + extra, 25);
}

/**
 * 월차 자동계산 — 입사 1년 미만 직원 한정.
 * 입사 후 만 N개월(개근 가정) 경과 시 N일, 최대 11일.
 * 1년 도달 시 0으로 리셋 (이후 연차로 전환).
 */
export function calculateMonthlyLeaveTotal(joinDate: Date | null, asOf: Date = new Date()): number {
  if (!joinDate) return 0;
  const months = monthsBetween(joinDate, asOf);
  if (months >= 12) return 0; // 1년 이상이면 월차 X
  return Math.min(months, 11);
}

/**
 * Date 사이 만 개월 수 — 입사일과 같은 일자가 지나면 +1
 */
function monthsBetween(start: Date, end: Date): number {
  const y = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  let months = y * 12 + m;
  if (end.getDate() < start.getDate()) months--;
  return Math.max(0, months);
}

/**
 * 근속 표시 (예: "5년 3개월")
 */
export function formatTenure(joinDate: Date | null, asOf: Date = new Date()): string {
  if (!joinDate) return "—";
  const months = monthsBetween(joinDate, asOf);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

/**
 * 잔여 휴가 계산 — 연차/월차 통합 반환
 */
export type LeaveBalance = {
  isInternal: boolean;
  tenure: string;
  annualTotal: number;
  annualUsed: number;
  annualRemaining: number;
  monthlyTotal: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  /** 이번 해 사용 일수 (연차+월차+반차합산) */
  totalUsedThisYear: number;
};

export async function getUserLeaveBalance(userId: string): Promise<LeaveBalance | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isInternal: true, joinDate: true, annualLeaveUsed: true },
  });
  if (!user) return null;

  const annualTotal = calculateAnnualLeaveTotal(user.joinDate);
  const monthlyTotal = calculateMonthlyLeaveTotal(user.joinDate);

  // 이번 해 승인된 휴가 사용량 집계
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1);
  const used = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: "approved",
      startDate: { gte: yearStart, lt: yearEnd },
    },
    select: { type: true, days: true },
  });
  let annualUsed = 0;
  let monthlyUsed = 0;
  for (const u of used) {
    const meta = LEAVE_TYPES.find((t) => t.value === u.type);
    if (!meta?.deducts) continue; // 공가/병가/특별/보건/기타는 잔여 차감 없음
    if (u.type === "monthly") monthlyUsed += u.days;
    else annualUsed += u.days;
  }
  const totalUsedThisYear = annualUsed + monthlyUsed;

  return {
    isInternal: user.isInternal,
    tenure: formatTenure(user.joinDate),
    annualTotal,
    annualUsed,
    annualRemaining: Math.max(0, annualTotal - annualUsed),
    monthlyTotal,
    monthlyUsed,
    monthlyRemaining: Math.max(0, monthlyTotal - monthlyUsed),
    totalUsedThisYear,
  };
}

/**
 * 결재자 라인을 직위 기반으로 찾는다.
 *  내부결재 (3단계): L1 본부장(김혜진) → L2 부대표(박지윤) → L3 대표이사(최진혁)
 *  외부결재 (2단계): L1 본부장(김혜진) → L2 대표이사(최진혁) [박지윤 부대표 생략]
 */
export async function resolveApprovalLine(
  route: "internal" | "external" = "internal"
): Promise<{ level: number; userId: string; name: string }[]> {
  const candidates = await prisma.user.findMany({
    where: {
      status: "active",
      OR: [
        { AND: [{ dept: "사업운영본부" }, { position: "책임연구원" }] },
        { position: "부대표" },
        { position: "대표이사" },
      ],
    },
    select: { id: true, name: true, dept: true, position: true },
  });

  const l1 = candidates.find((u) => u.dept === "사업운영본부" && u.position === "책임연구원"); // 김혜진
  const l2 = candidates.find((u) => u.position === "부대표"); // 박지윤
  const l3 = candidates.find((u) => u.position === "대표이사"); // 최진혁

  const out: { level: number; userId: string; name: string }[] = [];
  if (route === "external") {
    // 외부결재: 박지윤 생략. 김혜진 → 최진혁 2단계
    if (l1) out.push({ level: 1, userId: l1.id, name: l1.name });
    if (l3) out.push({ level: 2, userId: l3.id, name: l3.name });
  } else {
    // 내부결재: 3단계
    if (l1) out.push({ level: 1, userId: l1.id, name: l1.name });
    if (l2) out.push({ level: 2, userId: l2.id, name: l2.name });
    if (l3) out.push({ level: 3, userId: l3.id, name: l3.name });
  }
  return out;
}

/**
 * 신청 생성 시 결재 라인을 LeaveApproval 레코드로 만든다.
 * 신청자가 라인 중 한 명이면 그 단계는 status="auto_passed" + decidedAt=now
 */
export async function createApprovalChain(
  requestId: string,
  requesterId: string,
  route: "internal" | "external" = "internal"
) {
  const line = await resolveApprovalLine(route);
  for (const step of line) {
    const auto = step.userId === requesterId;
    await prisma.leaveApproval.create({
      data: {
        requestId,
        level: step.level,
        approverId: step.userId,
        status: auto ? "auto_passed" : "pending",
        decidedAt: auto ? new Date() : null,
        comment: auto ? "본인 단계 자동 통과" : null,
      },
    });
  }
  // currentLevel = 첫 번째 pending 단계, 없으면 마지막+1 (모두 자동통과)
  const approvals = await prisma.leaveApproval.findMany({
    where: { requestId },
    orderBy: { level: "asc" },
  });
  const firstPending = approvals.find((a) => a.status === "pending");
  if (!firstPending) {
    // 모든 단계 자동통과 → 즉시 승인
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "approved",
        currentLevel: line.length + 1,
        finalApprovedAt: new Date(),
        approverId: approvals[approvals.length - 1]?.approverId ?? null,
        approvedDate: new Date(),
      },
    });
  } else {
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { currentLevel: firstPending.level },
    });
  }
}
