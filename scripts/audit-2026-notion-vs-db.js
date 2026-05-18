// 2026 발굴/육성 노션 xlsx ↔ DB Project 정합성 점검 (read-only)
//   매칭 키: 정규화(업체명) — 회사 접두/공백/괄호 제거
//   리포트: 일치 / DB만 / 노션만 / status 차이 / 사업영역 차이
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILES = {
  discovery: "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/2026 발굴 2b02862807ac80bdb71cf783db1de7cc.xlsx",
  nurture: "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/2026 육성 2b02862807ac807b8277fd6d88472311.xlsx",
};

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[\(\)（）]/g, "")
    .replace(/주식회사|유한회사|㈜|\(주\)|\(유\)/g, "")
    .replace(/[(잔금)|선금|진금]/g, "")
    .toLowerCase()
    .trim();
}

function readSheet(filePath) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i];
    return o;
  });
}

(async () => {
  const p = new PrismaClient();

  for (const [source, file] of Object.entries(FILES)) {
    console.log(`\n${"=".repeat(70)}\n[${source === "discovery" ? "발굴" : "육성"}] ${file.split("/").pop()}\n${"=".repeat(70)}`);
    const xlsxRows = readSheet(file);
    console.log(`엑셀 행 수: ${xlsxRows.length}`);

    const dbProjects = await p.project.findMany({
      where: { year: 2026, source, isAdvance: false }, // 선금 분할 건 제외
      select: { id: true, title: true, status: true, bizCategory: true, pmCode: true, isBalance: true },
    });
    console.log(`DB 프로젝트 (year=2026, source=${source}, isAdvance=false): ${dbProjects.length}건`);

    // 매칭 인덱스
    const byNormDB = new Map();
    for (const d of dbProjects) {
      const k = norm(d.title);
      if (!byNormDB.has(k)) byNormDB.set(k, []);
      byNormDB.get(k).push(d);
    }

    const matched = [];
    const dbOnly = new Set(dbProjects.map((d) => d.id));
    const xlsxOnly = [];
    const statusDiffs = [];

    for (const r of xlsxRows) {
      const company = r["업체.기관명"] || r["업체/기관명"] || r["업체명"];
      if (!company) continue;
      const k = norm(company);
      const candidates = byNormDB.get(k) ?? [];
      if (candidates.length === 0) {
        xlsxOnly.push({ company, status: r["진행현황"], biz: r["사업"] || r["사업영역"], pm: r["PM"] });
      } else {
        // 첫 매칭으로 기록 (여러 개면 모두 dbOnly 에서 제외)
        for (const c of candidates) {
          dbOnly.delete(c.id);
          matched.push({ company, dbTitle: c.title, dbStatus: c.status, xlsxStatus: r["진행현황"], dbBiz: c.bizCategory, xlsxBiz: r["사업"] || r["사업영역"] });
          if (r["진행현황"] && c.status !== r["진행현황"]) {
            statusDiffs.push({ company, dbStatus: c.status, xlsxStatus: r["진행현황"] });
          }
        }
      }
    }

    console.log(`\n매칭 ${matched.length}건 / DB에만 있음 ${dbOnly.size}건 / 엑셀에만 있음 ${xlsxOnly.length}건`);
    console.log(`status 불일치: ${statusDiffs.length}건`);

    if (xlsxOnly.length > 0) {
      console.log(`\n[엑셀에만 있음 — DB 등록 필요 가능성]`);
      for (const x of xlsxOnly.slice(0, 20)) {
        console.log(`  • ${x.company} (status=${x.status ?? "-"}, biz=${x.biz ?? "-"}, PM=${x.pm ?? "-"})`);
      }
      if (xlsxOnly.length > 20) console.log(`  ... 외 ${xlsxOnly.length - 20}건`);
    }

    if (dbOnly.size > 0) {
      console.log(`\n[DB에만 있음 — 엑셀과 매칭 안됨]`);
      const onlyList = dbProjects.filter((d) => dbOnly.has(d.id));
      for (const d of onlyList.slice(0, 20)) {
        console.log(`  • ${d.title} (status=${d.status}, biz=${d.bizCategory}, pmCode=${d.pmCode ?? "-"})`);
      }
      if (onlyList.length > 20) console.log(`  ... 외 ${onlyList.length - 20}건`);
    }

    if (statusDiffs.length > 0) {
      console.log(`\n[status 불일치 샘플]`);
      for (const s of statusDiffs.slice(0, 15)) {
        console.log(`  • ${s.company}: DB='${s.dbStatus}' ≠ 엑셀='${s.xlsxStatus}'`);
      }
      if (statusDiffs.length > 15) console.log(`  ... 외 ${statusDiffs.length - 15}건`);
    }
  }

  await p.$disconnect();
})();
