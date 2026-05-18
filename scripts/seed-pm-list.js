// PM 분류 시드
//   - 기존 PM 5명: 최진혁(JHC), 이용삼(YSL), 김대원(DWK), 이동혁(DHL), 우광호(GHW) → isPM=true
//   - 외부위원 3명: 박현용(HYP), 이현영(HYL), 김태한(THK) → isPM=true, isInternal=false
//     · 박현용/김태한은 기존 DB 에 있음 → pmCode/isPM 갱신
//     · 이현영은 없으면 신규 생성 (status='active' 외부위원)
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

const INTERNAL_PMS = [
  { pmCode: "JHC", name: "최진혁" },
  { pmCode: "YSL", name: "이용삼" },
  { pmCode: "DWK", name: "김대원" },
  { pmCode: "DHL", name: "이동혁" },
  { pmCode: "GHW", name: "우광호" },
];

const EXTERNAL_COMMITTEE = [
  { pmCode: "HYP", name: "박현용", position: "외부위원" },
  { pmCode: "HYL", name: "이현영", position: "외부위원" },
  { pmCode: "THK", name: "김태한", position: "외부위원" },
];

(async () => {
  const p = new PrismaClient();
  console.log("=== 1) 기존 PM 5명 isPM=true 마킹 ===");
  for (const pm of INTERNAL_PMS) {
    const u = await p.user.findUnique({ where: { pmCode: pm.pmCode } });
    if (!u) {
      console.log(`  [SKIP] ${pm.pmCode} ${pm.name} 사용자 없음`);
      continue;
    }
    await p.user.update({ where: { id: u.id }, data: { isPM: true } });
    console.log(`  [OK] ${pm.pmCode.padEnd(5)} ${u.name}  isPM=true`);
  }

  console.log("\n=== 2) 외부위원 3명 등록/갱신 ===");
  for (const c of EXTERNAL_COMMITTEE) {
    // pmCode 로 먼저 찾기
    let u = await p.user.findUnique({ where: { pmCode: c.pmCode } });
    if (!u) {
      // 이름으로 찾기 (기존 회원 + pmCode 미지정)
      u = await p.user.findFirst({ where: { name: c.name, pmCode: null } });
    }
    if (u) {
      // 기존 사용자 갱신
      await p.user.update({
        where: { id: u.id },
        data: { pmCode: c.pmCode, isPM: true, isInternal: false, status: "active" },
      });
      console.log(`  [UPDATE] ${c.pmCode.padEnd(5)} ${c.name}  (기존 empNo=${u.empNo}) → pmCode/isPM 부여, 상태=active`);
    } else {
      // 신규 생성
      const empNo = `EXT_${c.pmCode}`;
      await p.user.create({
        data: {
          empNo,
          name: c.name,
          dept: "외부위원",
          position: c.position,
          role: "staff",
          status: "active",
          isInternal: false,
          isPM: true,
          pmCode: c.pmCode,
        },
      });
      console.log(`  [CREATE] ${c.pmCode.padEnd(5)} ${c.name}  empNo=${empNo} (신규)`);
    }
  }

  console.log("\n=== 최종 PM 목록 (isPM=true) ===");
  const allPMs = await p.user.findMany({
    where: { isPM: true },
    select: { pmCode: true, name: true, isInternal: true, status: true, dept: true, position: true },
    orderBy: { name: "asc" },
  });
  for (const u of allPMs) {
    console.log(
      `  ${u.pmCode?.padEnd(5)} ${u.name.padEnd(6)} ${u.isInternal ? "내부" : "외부"}  ${u.dept}·${u.position}  (${u.status})`
    );
  }
  console.log(`총 PM ${allPMs.length}명`);
  await p.$disconnect();
})();
