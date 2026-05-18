// 수행실적 정리 xlsx (수출/컨설팅/기술지원/마케팅/용역 5시트) ↔ DB TrackRecord 점검
//   매칭 키: 정규화(업체명) + 정규화(서비스명) + 연도(±1)
//   각 시트는 category 매핑이 분명 (마지막 4시트):
//     컨설팅→consulting / 기술지원→tech_support / 마케팅→marketing / 용역→service
//   '수출' 시트는 컨설팅 sheet와 중복 가능 — 이미 38건 추가됐을 수 있음
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILE = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/수행 실적 정리_(주)대동CMC_260306.xlsx";

const SHEET_TO_CATEGORY = {
  컨설팅: "consulting",
  기술지원: "tech_support",
  마케팅: "marketing",
  용역: "service",
};

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[\(\)（）]/g, "")
    .replace(/주식회사|유한회사|㈜|\(주\)|\(유\)/g, "")
    .toLowerCase()
    .trim();
}

function bizFromKR(s) {
  if (!s) return null;
  const t = String(s);
  if (t.includes("혁신")) return "innovation";
  if (t.includes("수출")) return "export";
  if (t.includes("테크노") || t.includes("TP")) return "tp";
  if (t.includes("용역")) return "contract";
  if (t.includes("인증")) return "certification";
  return null;
}

(async () => {
  const wb = xlsx.readFile(FILE);
  const p = new PrismaClient();
  const dbRecords = await p.trackRecord.findMany({
    select: { id: true, type: true, category: true, clientName: true, serviceName: true, year: true, supportProgram: true },
  });

  console.log(`\n전체 DB TrackRecord: ${dbRecords.length}건`);
  const byKey = new Map();
  for (const d of dbRecords) {
    const k = `${norm(d.clientName)}|${norm(d.serviceName)}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(d);
  }

  const report = {};
  for (const [koCat, dbCat] of Object.entries(SHEET_TO_CATEGORY)) {
    const sheet = wb.Sheets[koCat];
    if (!sheet) {
      console.log(`[!] '${koCat}' 시트 없음`);
      continue;
    }
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    // 헤더 행 위치 찾기
    let hRow = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (rows[i] && rows[i].includes("년도")) {
        hRow = i;
        break;
      }
    }
    if (hRow < 0) {
      console.log(`[!] '${koCat}' 헤더 못 찾음`);
      continue;
    }
    const header = rows[hRow];
    const I = {
      year: header.indexOf("년도"),
      biz: header.indexOf("사업"),
      company: header.indexOf("업체/기관명"),
      service: header.indexOf("서비스명"),
      amount: header.indexOf("금액"),
    };
    let valid = 0;
    let matched = 0;
    let mismatchCategory = 0;
    let xlsxOnly = [];
    let dbExtra = []; // category=dbCat but xlsx 에 없는 항목

    const xlsxKeys = new Set();
    for (let i = hRow + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const company = r[I.company];
      const service = r[I.service];
      if (!company || !service) continue;
      valid++;
      const k = `${norm(company)}|${norm(service)}`;
      xlsxKeys.add(k);
      const candidates = byKey.get(k) ?? [];
      if (candidates.length === 0) {
        xlsxOnly.push({ company, service, year: r[I.year] });
      } else {
        matched++;
        // category mismatch 체크
        for (const c of candidates) {
          if (c.category !== dbCat) mismatchCategory++;
        }
      }
    }

    // DB에서 dbCat 인 항목 중 xlsx 에 없는 것
    for (const d of dbRecords) {
      if (d.category !== dbCat) continue;
      const k = `${norm(d.clientName)}|${norm(d.serviceName)}`;
      if (!xlsxKeys.has(k)) {
        dbExtra.push(d);
      }
    }

    report[koCat] = { valid, matched, xlsxOnlyCount: xlsxOnly.length, dbExtraCount: dbExtra.length, mismatchCategory };

    console.log(`\n${"=".repeat(60)}\n[${koCat} 시트 → category='${dbCat}']\n${"=".repeat(60)}`);
    console.log(`  유효 행: ${valid} / DB 매칭: ${matched} / 엑셀에만: ${xlsxOnly.length} / DB(${dbCat})에만: ${dbExtra.length}`);
    console.log(`  매칭됐으나 DB category 다름: ${mismatchCategory}`);
    if (xlsxOnly.length > 0 && xlsxOnly.length < 30) {
      console.log(`  [엑셀에만 — 미등록 가능성]:`);
      for (const x of xlsxOnly.slice(0, 10)) console.log(`    • ${x.year} ${x.company} | ${String(x.service).slice(0, 40)}`);
      if (xlsxOnly.length > 10) console.log(`    ... 외 ${xlsxOnly.length - 10}`);
    } else if (xlsxOnly.length >= 30) {
      console.log(`  [엑셀에만 ${xlsxOnly.length}건] — 너무 많아 샘플 10건:`);
      for (const x of xlsxOnly.slice(0, 10)) console.log(`    • ${x.year} ${x.company} | ${String(x.service).slice(0, 40)}`);
    }
  }

  console.log("\n=== 요약 ===");
  for (const [k, v] of Object.entries(report)) {
    console.log(`  ${k.padEnd(8)} 유효 ${v.valid}건 / 매칭 ${v.matched} / 엑셀에만 ${v.xlsxOnlyCount} / DB추가 ${v.dbExtraCount}`);
  }

  await p.$disconnect();
})();
