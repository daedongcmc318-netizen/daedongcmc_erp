/*
 * 직원 시드 — 4대보험가입자명부(2026-05-11) 22명 + 이카운트 화면 매칭 데이터
 * 멱등성: 이름으로 기존 레코드 매칭 → empNo / 상세필드 갱신
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type UserSeed = {
  empNo: string;
  name: string;
  residentNo?: string;
  joinDate: string;
  dept: string;
  position: string;
  role: "admin" | "manager" | "staff";
  pmCode?: string;
  email?: string;
  mobile?: string;
  bankName?: string;
  accountNo?: string;
  accountHolder?: string;
  address?: string;
};

const USERS: UserSeed[] = [
  // 4대보험 + 이카운트 매칭됨
  { empNo: "00001", name: "최진혁", residentNo: "770531-1127213", joinDate: "2018-03-21",
    dept: "CEO", position: "대표이사", role: "admin", pmCode: "JHC",
    email: "jhchoi@daedongcmc.com", mobile: "010-8513-0535",
    bankName: "국민은행", accountNo: "84660101300267", accountHolder: "최진혁",
    address: "울산광역시 남구 문수로463번길 16, 102동 2903호" },
  { empNo: "180322", name: "최재용", residentNo: "780703-1127215", joinDate: "2018-03-21",
    dept: "글로벌사업본부", position: "감사", role: "manager",
    email: "topjh0531@gmail.com",
    bankName: "신한은행", accountNo: "613402-04-061447", accountHolder: "최재용" },
  { empNo: "180801", name: "최창수", residentNo: "811128-1850524", joinDate: "2018-08-01",
    dept: "신사업/연구개발본부", position: "이사", role: "manager",
    email: "ccs11@daum.net",
    accountNo: "1002044918160", accountHolder: "최창수" },
  { empNo: "200131", name: "김대원", residentNo: "801113-1851633", joinDate: "2020-01-31",
    dept: "신사업/연구개발본부", position: "전무이사", role: "manager",
    email: "dwmc1113@daum.net",
    accountNo: "3333012384935", accountHolder: "김대원" },
  { empNo: "200901", name: "이용삼", residentNo: "570401-1090714", joinDate: "2020-09-01",
    dept: "부산지사", position: "전무이사", role: "manager",
    email: "lysbusan@hanmail.net",
    accountNo: "44700937001010", accountHolder: "이용삼" },
  { empNo: "201020", name: "김혜진", residentNo: "901229-2903910", joinDate: "2020-10-20",
    dept: "사업운영본부", position: "책임연구원", role: "manager", pmCode: "HJK",
    email: "hjkim@daedongcmc.com",
    accountNo: "207-0219-4565-07", accountHolder: "김혜진" },
  { empNo: "220701", name: "박지윤", residentNo: "821026-2332814", joinDate: "2022-07-01",
    dept: "HRD사업본부", position: "부대표", role: "manager", pmCode: "JYP",
    email: "jypark@daedongcmc.com",
    accountNo: "617210193045", accountHolder: "박지윤" },
  { empNo: "230201", name: "임일택", residentNo: "660722-1650413", joinDate: "2023-02-01",
    dept: "기술사업화본부", position: "전문위원", role: "manager",
    email: "lit9535@hanmail.net",
    accountNo: "93612209628", accountHolder: "임일택" },
  { empNo: "231201", name: "최지현", residentNo: "750317-2127229", joinDate: "2023-12-01",
    dept: "글로벌사업본부", position: "이사", role: "manager",
    accountNo: "517-21-0345527", accountHolder: "최지현" },
  { empNo: "231202", name: "김엘리자", residentNo: "830301-2851610", joinDate: "2023-12-01",
    dept: "글로벌사업본부", position: "연구원", role: "staff",
    accountNo: "073211022387", accountHolder: "김엘리자" },
  { empNo: "240101", name: "권용범", residentNo: "770410-1785525", joinDate: "2024-01-01",
    dept: "글로벌사업본부", position: "전문위원", role: "manager",
    accountNo: "1002539342434", accountHolder: "권용범" },
  { empNo: "240715", name: "최병찬", residentNo: "660116-1691816", joinDate: "2024-07-15",
    dept: "기술사업화본부", position: "전문위원", role: "manager",
    accountNo: "110187842300", accountHolder: "최병찬" },
  { empNo: "250217", name: "권성열", residentNo: "630421-1779415", joinDate: "2025-02-17",
    dept: "기술사업화본부", position: "전문위원", role: "manager",
    accountNo: "19704760601018", accountHolder: "권성열" },
  { empNo: "250325", name: "우광호", residentNo: "650923-1675616", joinDate: "2025-03-25",
    dept: "기술사업화본부", position: "전문위원", role: "manager",
    email: "wkh2340@hanmail.net" },
  { empNo: "250601", name: "이동혁", residentNo: "701106-1121015", joinDate: "2025-06-01",
    dept: "경남지사", position: "전무이사", role: "manager",
    accountNo: "81160100013009", accountHolder: "이동혁" },
  { empNo: "25072302", name: "임한솔", residentNo: "960322-2455518", joinDate: "2025-07-23",
    dept: "사업운영본부", position: "연구원", role: "staff",
    email: "hslim@daedongcmc.com",
    accountNo: "110-496-527630", accountHolder: "임한솔" },

  // 4대보험에는 있으나 이카운트 화면에 안 보이는 6명 (joinDate 기준 사번 부여)
  { empNo: "25090106", name: "박영기", residentNo: "620211-1******", joinDate: "2025-09-01",
    dept: "사업운영본부", position: "전문위원", role: "manager" },
  { empNo: "26030101", name: "김정한", residentNo: "650201-1******", joinDate: "2026-03-01",
    dept: "사업운영본부", position: "전문위원", role: "manager" },
  { empNo: "26030201", name: "강혜인", residentNo: "930516-2******", joinDate: "2026-03-02",
    dept: "사업운영본부", position: "연구원", role: "staff" },
  { empNo: "26042001", name: "조경화", residentNo: "700201-2******", joinDate: "2026-04-20",
    dept: "사업운영본부", position: "연구원", role: "staff" },
  { empNo: "26042002", name: "김태한", residentNo: "720205-1******", joinDate: "2026-04-20",
    dept: "사업운영본부", position: "전문위원", role: "manager" },
  { empNo: "26022301", name: "강도희", residentNo: "990925-2******", joinDate: "2026-02-23",
    dept: "사업운영본부", position: "연구원", role: "staff" },
];

async function main() {
  // 기존 데이터 처리: 이름으로 매칭하여 empNo / 상세필드 갱신 (프로젝트와의 관계 유지)
  let updated = 0;
  let created = 0;

  for (const u of USERS) {
    // 1) 이름으로 기존 사용자 찾기
    const existing = await prisma.user.findFirst({ where: { name: u.name } });

    const data: any = {
      empNo: u.empNo,
      name: u.name,
      residentNo: u.residentNo,
      joinDate: new Date(u.joinDate),
      dept: u.dept,
      position: u.position,
      role: u.role,
      pmCode: u.pmCode ?? null,
      email: u.email,
      mobile: u.mobile,
      bankName: u.bankName,
      accountNo: u.accountNo,
      accountHolder: u.accountHolder,
      address: u.address,
      status: "active",
    };

    if (existing) {
      // pmCode unique 충돌 회피: 같은 pmCode가 다른 유저에 있으면 그 유저의 pmCode를 null로
      if (u.pmCode) {
        const conflict = await prisma.user.findFirst({
          where: { pmCode: u.pmCode, id: { not: existing.id } },
        });
        if (conflict) {
          await prisma.user.update({ where: { id: conflict.id }, data: { pmCode: null } });
        }
      }
      await prisma.user.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      // 새로 생성 — empNo unique 충돌 검사
      const empNoConflict = await prisma.user.findUnique({ where: { empNo: u.empNo } });
      if (empNoConflict) {
        await prisma.user.update({ where: { id: empNoConflict.id }, data });
        updated++;
      } else {
        if (u.pmCode) {
          const c = await prisma.user.findFirst({ where: { pmCode: u.pmCode } });
          if (c) await prisma.user.update({ where: { id: c.id }, data: { pmCode: null } });
        }
        await prisma.user.create({ data });
        created++;
      }
    }
  }

  // PDF에 없는 placeholder PM 사용자 + 인턴1 정리
  const orphans = await prisma.user.findMany({
    where: {
      OR: [
        { empNo: { startsWith: "PM_" } },
        { name: "인턴1" },
      ],
    },
  });
  let deleted = 0;
  for (const o of orphans) {
    // 프로젝트가 참조하면 삭제 불가 — pmCode/managerId 정리
    await prisma.project.updateMany({ where: { managerId: o.id }, data: { managerId: null } });
    if (o.pmCode) {
      await prisma.project.updateMany({ where: { pmCode: o.pmCode }, data: { pmCode: null } });
    }
    await prisma.user.delete({ where: { id: o.id } });
    deleted++;
  }

  console.log(`✓ 직원 시드 — 신규 ${created} / 갱신 ${updated} / 정리(placeholder) ${deleted}`);

  const total = await prisma.user.count({ where: { status: "active" } });
  console.log(`📊 활동 직원 총 ${total}명`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
