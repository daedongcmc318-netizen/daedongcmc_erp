// 김혜진 5/11 완료 업무 17건 일괄 추가
//   - date: 2026-05-11 (월요일)
//   - dueDate: 2026-05-15 (오늘)
//   - status: done, completed: true
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

const SCHEDULED_DATE = new Date("2026-05-11T00:00:00");
const DUE_DATE = new Date("2026-05-15T00:00:00");

const TASKS = [
  { title: "혁신 2차 진행여부 안내_토새, 이에스링크, 엑셉", category: "innovation" },
  { title: "토새 혁신바우처 T 진행 검토_JHC 보고 대기", category: "innovation" },
  { title: "다미 직생 보완_법인등기부등본 발급", category: "damiex" },
  { title: "ANS개발 발표자료 초안 전달", category: "innovation" },
  { title: "은광정밀 컨설팅 신청 안내~ 내일 연락 요청", category: "innovation" },
  { title: "전통문화 보완서류 제출", category: "etc" },
  { title: "바크, 오라 중간보고 검토", category: "innovation" },
  { title: "이노테크 사업계획서 보완 제출 완료", category: "damiex" },
  { title: "대동 직생 다운로드", category: "certification" },
  { title: "이에스링크, 토새, 엑셉 관리비 안내", category: "innovation" },
  { title: "토새 수행계획서 작성 확인", category: "innovation" },
  { title: "에이앰 기술지원, 마케팅 신청 안내", category: "innovation" },
  { title: "남구청 진행현황 파일 송부", category: "service" },
  { title: "심플솔루션 카탈로그, 리플렛 주문 완료", category: "innovation" },
  { title: "서울가죽소년단 혁신 진행 안내", category: "innovation" },
  { title: "우광호 위원 혁신 사업계획서 등 자료 요청", category: "innovation" },
  { title: "인바운드 2건 확인_자료수령 검토", category: "etc" },
];

(async () => {
  const p = new PrismaClient();
  const user = await p.user.findFirst({ where: { name: "김혜진" } });
  if (!user) {
    console.log("김혜진 user not found");
    process.exit(1);
  }
  console.log("user:", user.name, user.id);

  // 5/11 의 마지막 sortOrder
  const last = await p.weeklyTask.findFirst({
    where: { userId: user.id, date: SCHEDULED_DATE },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? 0) + 1;

  // 중복 방지 (같은 title 이미 있으면 skip)
  const existing = await p.weeklyTask.findMany({
    where: {
      userId: user.id,
      date: SCHEDULED_DATE,
      title: { in: TASKS.map((t) => t.title) },
    },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((t) => t.title));

  let created = 0;
  let skipped = 0;
  for (const t of TASKS) {
    if (existingTitles.has(t.title)) {
      console.log("  [SKIP]", t.title);
      skipped++;
      continue;
    }
    await p.weeklyTask.create({
      data: {
        userId: user.id,
        date: SCHEDULED_DATE,
        dueDate: DUE_DATE,
        category: t.category,
        priority: null,
        status: "done",
        title: t.title,
        notes: null,
        completed: true,
        sortOrder: nextOrder++,
      },
    });
    console.log(`  [+ ${t.category.padEnd(13)}]`, t.title);
    created++;
  }
  console.log(`\nDONE: created=${created}, skipped=${skipped}`);
  await p.$disconnect();
})();
