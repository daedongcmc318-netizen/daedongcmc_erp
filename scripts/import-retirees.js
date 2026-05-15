// 퇴직자 리스트 import — 직원 DB에 status='inactive' 로 추가
//   - 입사일자 후 퇴사처리 (퇴사일자는 엑셀에 없으므로 null 유지, 추후 수동 입력)
//   - 이미 존재하는 empNo 는 skip (중복 방지)
//   - isInternal=false (퇴사자는 근태/연차 대상 아님)
//   - role='staff'
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILE = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/직원 DB/퇴직자 리스트_260514.xlsx";

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

(async () => {
  const wb = xlsx.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  // 헤더: row 1 = [사원번호, 성명, 주민등록번호, 부서명, 직위/직급명, 입사일자, 계좌번호, Email]
  // 데이터: row 2 부터, 마지막 줄은 timestamp 라 skip

  const p = new PrismaClient();
  const existing = await p.user.findMany({ select: { empNo: true } });
  const existingSet = new Set(existing.map((u) => String(u.empNo)));

  let created = 0;
  let skipped = 0;
  const skippedRows = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || String(r[0]).includes("2026/")) continue; // timestamp row
    const empNo = String(r[0]).trim();
    const name = String(r[1] ?? "").trim();
    if (!empNo || !name) continue;

    if (existingSet.has(empNo)) {
      skipped++;
      skippedRows.push(`  [SKIP] ${empNo} ${name} (이미 존재)`);
      continue;
    }

    const residentNo = r[2] ? String(r[2]).trim() : null;
    const dept = r[3] ? String(r[3]).trim() : "사업운영본부";
    const position = r[4] ? String(r[4]).trim() : "사원";
    const joinDate = parseDate(r[5]);
    const accountNo = r[6] ? String(r[6]).trim() : null;
    const email = r[7] ? String(r[7]).trim() : null;

    await p.user.create({
      data: {
        empNo,
        name,
        residentNo,
        dept,
        position,
        role: "staff",
        joinDate,
        accountNo,
        email,
        status: "inactive", // 퇴사 상태
        isInternal: false,
      },
    });
    created++;
    console.log(`  [+] ${empNo.padEnd(10)} ${name.padEnd(5)} ${position.padEnd(8)} ${joinDate ? joinDate.toISOString().slice(0, 10) : "—"}`);
  }
  console.log("");
  for (const s of skippedRows) console.log(s);
  console.log(`\nDONE: 신규 ${created}건 / 스킵 ${skipped}건`);

  const total = await p.user.count();
  const inactive = await p.user.count({ where: { status: "inactive" } });
  console.log(`전체 ${total}명 / 비활성(퇴사) ${inactive}명`);
  await p.$disconnect();
})();
