// 2026 발굴 노션 엑셀 → DB 발굴 프로젝트 status 동기화
//   매칭 키: year=2026 AND source='discovery' AND 정규화(업체명)
//   status 는 한국어 그대로 (예: '문의', '검토중', '선정', '탈락')
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILE = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/2026 발굴 2b02862807ac80bdb71cf783db1de7cc.xlsx";

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[\(\)（）]/g, "")
    .replace(/주식회사|유한회사|㈜/g, "")
    .toLowerCase();
}

(async () => {
  const wb = xlsx.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const header = rows[0];
  const I = {
    company: header.indexOf("업체.기관명"),
    status: header.indexOf("진행현황"),
  };

  const p = new PrismaClient();
  const dbProjects = await p.project.findMany({
    where: { year: 2026, source: "discovery" },
    select: { id: true, title: true, status: true },
  });
  const byNorm = new Map();
  for (const d of dbProjects) {
    const k = norm(d.title);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(d);
  }

  let updated = 0;
  let skippedNoMatch = 0;
  let skippedSameStatus = 0;
  const unmatched = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const company = r[I.company];
    const status = r[I.status];
    if (!company) continue;

    const k = norm(company);
    const matches = byNorm.get(k) ?? [];
    if (matches.length === 0) {
      skippedNoMatch++;
      unmatched.push(company);
      continue;
    }

    // 같은 업체 여러 프로젝트가 있을 수 있음 — 모두 업데이트
    for (const m of matches) {
      const newStatus = status ? String(status).trim() : "문의";
      if (m.status === newStatus) {
        skippedSameStatus++;
        continue;
      }
      await p.project.update({ where: { id: m.id }, data: { status: newStatus } });
      console.log(`  [+] ${m.title.padEnd(30)} '${m.status}' → '${newStatus}'`);
      updated++;
    }
  }

  console.log(`\nDONE: 업데이트 ${updated} / 변경없음 ${skippedSameStatus} / 매칭실패 ${skippedNoMatch}`);
  if (unmatched.length) console.log("매칭실패 업체:", unmatched.slice(0, 20).join(", "), unmatched.length > 20 ? `... 외 ${unmatched.length - 20}` : "");

  const after = await p.project.groupBy({
    by: ["status"],
    _count: true,
    where: { source: "discovery", year: 2026 },
  });
  console.log("\n=== 2026 발굴 status 분포 (반영 후) ===");
  for (const x of after) console.log(`  ${(x.status || '(빈값)').padEnd(20)} ${x._count}`);
  await p.$disconnect();
})();
