// 회사 이메일(@daedongcmc.com) 일괄 부여
//   - 이미 @daedongcmc.com 이면 유지
//   - pmCode 있으면 {pmCodeLowercase}@daedongcmc.com
//   - pmCode 없으면 {empNoLowercase}@daedongcmc.com (fallback)
//   - 중복 회피: 같은 이메일 이미 있으면 끝에 -2, -3 ... suffix
//   - 결과 표 출력
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

const DOMAIN = "daedongcmc.com";

(async () => {
  const p = new PrismaClient();
  const users = await p.user.findMany({
    where: { status: { not: "inactive" } },
    select: { id: true, empNo: true, name: true, email: true, pmCode: true, role: true, status: true },
    orderBy: { name: "asc" },
  });

  // 이미 회사 이메일 인 항목 + 새로 부여할 항목 분류
  const existing = new Set(
    users.filter((u) => u.email && u.email.endsWith(`@${DOMAIN}`)).map((u) => u.email.toLowerCase())
  );

  function uniquify(base) {
    let candidate = `${base}@${DOMAIN}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
    for (let i = 2; i < 100; i++) {
      candidate = `${base}${i}@${DOMAIN}`;
      if (!existing.has(candidate.toLowerCase())) return candidate;
    }
    throw new Error("Too many collisions for " + base);
  }

  let touched = 0;
  const rows = [];
  for (const u of users) {
    if (u.email && u.email.endsWith(`@${DOMAIN}`)) {
      rows.push({ ...u, action: "keep", newEmail: u.email });
      continue;
    }
    let base;
    if (u.pmCode) base = u.pmCode.toLowerCase();
    else base = String(u.empNo).toLowerCase();
    const newEmail = uniquify(base);
    existing.add(newEmail.toLowerCase());

    await p.user.update({ where: { id: u.id }, data: { email: newEmail } });
    rows.push({ ...u, action: u.email ? "overwrite" : "new", newEmail, oldEmail: u.email });
    touched++;
  }

  console.log("\n[결과] 이메일 부여 완료\n");
  for (const r of rows) {
    const tag = r.action === "keep" ? "  -  " : r.action === "overwrite" ? "[ 덮 ]" : "[ 신 ]";
    const old = r.oldEmail ? `  (기존: ${r.oldEmail})` : "";
    console.log(
      `${tag} ${(r.name || "").padEnd(8)} ${(r.empNo || "").padEnd(10)} pmCode=${(r.pmCode || "-").padEnd(5)} → ${r.newEmail}${old}`
    );
  }
  console.log(`\n총 ${users.length}명 중 변경 ${touched}건, 유지 ${users.length - touched}건`);
  await p.$disconnect();
})();
