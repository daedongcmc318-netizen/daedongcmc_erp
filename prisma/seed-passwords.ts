/*
 * 로그인 비밀번호 시드 — jhchoi (최진혁 대표이사) + admin (관리자)
 * 멱등: 실행할 때마다 동일 결과
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = "#choi421342#";
  const hash = await bcrypt.hash(password, 10);

  // jhchoi 계정: 최진혁의 empNo='00001'이 기본이지만, 사용자가 'jhchoi'로 로그인하길 원함
  // pmCode='JHC'인 사용자(최진혁)에 비밀번호 세팅 + email/empNo도 로그인 가능
  // 별도 'jhchoi' 식별자를 위해 사용자의 empNo를 'jhchoi'로 변경하지 않고, email로 매칭하도록 함
  // 더 직관적: 'jhchoi' empNo의 별도 alias를 만들 수 없으니, pmCode 'JHC' 또는 email 'jhchoi@daedongcmc.com' 또는 empNo로 로그인 가능하게 한다.
  // 그리고 empNo를 'jhchoi'로 부여 어드민 별칭 — 가장 깔끔하니 그대로 함.

  // 최진혁: empNo가 '00001'인데, 'jhchoi' 로그인을 위해 그대로 두고 email 기반 매칭 가능.
  // 사용자 요구사항대로 'jhchoi' 직접 매칭을 위해, 최진혁 사용자의 empNo는 유지하고, pmCode를 jhchoi로 alias 처리. 다만 pmCode는 대문자 비교라 'JHC' 그대로 유지하고 어떤 식으로 매칭하지?

  // 가장 단순: 'jhchoi'로 로그인되려면 jhchoi가 empNo, email, pmCode 중 하나여야 함.
  // 'jhchoi'를 empNo로 별도의 alias 행으로 만들면 user_count가 +1 됨. 안 됨.
  // → '@/api/auth/login'에서 'jhchoi'를 'JHC' pmCode로 mapping하거나, name='최진혁'으로 매칭하는 보조 룰 추가.

  // 결정: API에서 username을 'jhchoi'로 받으면 '최진혁'으로 매칭하는 별칭 로직 추가.
  //       이 시드에선 단순히 최진혁의 passwordHash 설정

  const jhchoi = await prisma.user.findFirst({ where: { name: "최진혁" } });
  if (jhchoi) {
    await prisma.user.update({ where: { id: jhchoi.id }, data: { passwordHash: hash } });
    console.log(`✓ 최진혁 (empNo=${jhchoi.empNo}) 비밀번호 설정`);
  } else {
    console.log("⚠ 최진혁 사용자를 찾을 수 없습니다. seed-users.ts를 먼저 실행하세요.");
  }

  // admin 별도 계정 (시스템 관리자)
  const admin = await prisma.user.upsert({
    where: { empNo: "admin" },
    update: { passwordHash: hash },
    create: {
      empNo: "admin",
      name: "시스템 관리자",
      dept: "시스템",
      position: "관리자",
      role: "admin",
      status: "active",
      passwordHash: hash,
      email: "admin@daedongcmc.com",
    },
  });
  console.log(`✓ admin (id=${admin.id}) 비밀번호 설정`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
