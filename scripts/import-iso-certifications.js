// ISO 인증 리스트 → TrackRecord (category='certification') 로 import
//   CSV 헤더: 진행여부, 구분, 업체/기관명, 규격, 인증번호, 인증범위, (영문), GC 코드, 담당자, 심사원, 최초인증일, 인증일, 만료일, ...
//   중복 회피: clientName + 규격 + 인증번호 키로 매칭
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

const CSV_PATH = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/ISO 인증 리스트 1762862807ac80bf9422e71f5571aa1b.csv";

function parseCSV(text) {
  // 간단한 CSV 파서 (큰따옴표 처리 포함, 한 행 = 한 레코드)
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // skip
      } else cur += c;
    }
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseMoney(s) {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

(async () => {
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const rows = parseCSV(raw);
  const header = rows[0];
  console.log("HEADER:", header.slice(0, 10).join(" | "));

  // 컬럼 인덱스
  const col = (name) => header.findIndex((h) => h.trim() === name);
  const I = {
    status: col("진행여부"),
    division: col("구분"),
    company: col("업체/기관명"),
    standard: col("규격"),
    certNo: col("인증번호"),
    scope: col("인증범위"),
    pm: col("담당자"),
    reviewer: col("심사원"),
    firstCert: col("최초인증일"),
    certDate: col("인증일"),
    expireDate: col("만료일"),
    contact: col("기업담당자"),
    phone: col("연락처"),
    email: col("이메일"),
    notes: col("비고"),
    fee: col("인증비"),
  };
  console.log("INDEX:", I);

  const p = new PrismaClient();

  // 기존 ISO 인증 레코드 매칭용
  const existing = await p.trackRecord.findMany({
    where: { category: "certification" },
    select: { id: true, clientName: true, serviceName: true, notes: true },
  });
  const norm = (s) => String(s ?? "").replace(/[\s\(\)（）주식회사유한회사㈜]/g, "").toLowerCase();
  const existingKeys = new Set(existing.map((e) => `${norm(e.clientName)}|${norm(e.serviceName)}`));

  let created = 0;
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const company = (r[I.company] ?? "").trim();
    const standard = (r[I.standard] ?? "").trim();
    if (!company || !standard) continue;

    const certNo = (r[I.certNo] ?? "").trim();
    const scope = (r[I.scope] ?? "").trim();
    const serviceName = `${standard} 인증${scope ? ` (${scope})` : ""}${certNo ? ` [${certNo}]` : ""}`;

    const key = `${norm(company)}|${norm(serviceName)}`;
    if (existingKeys.has(key)) {
      skipped++;
      console.log(`  [SKIP] ${company} - ${standard}`);
      continue;
    }

    const certDate = parseDate(r[I.certDate]);
    const expireDate = parseDate(r[I.expireDate]);
    const fee = parseMoney(r[I.fee]);

    const notesArr = [];
    if (r[I.division]) notesArr.push(`구분: ${r[I.division]}`);
    if (r[I.pm]) notesArr.push(`담당자: ${r[I.pm]}`);
    if (r[I.reviewer]) notesArr.push(`심사원: ${r[I.reviewer]}`);
    if (r[I.contact]) notesArr.push(`기업담당자: ${r[I.contact]}`);
    if (r[I.phone]) notesArr.push(`연락처: ${r[I.phone]}`);
    if (r[I.email]) notesArr.push(`이메일: ${r[I.email]}`);
    if (expireDate) notesArr.push(`만료일: ${expireDate.toISOString().slice(0, 10)}`);
    if (r[I.notes]) notesArr.push(`비고: ${r[I.notes]}`);
    const notes = notesArr.join(" | ");

    await p.trackRecord.create({
      data: {
        type: "innovation", // ISO 인증은 자체 카테고리이므로 division 은 임의 (innovation 기본). UI 상 category 로 분류됨
        category: "certification",
        serviceName,
        serviceFee: BigInt(fee ?? 0),
        clientName: company,
        startDate: certDate,
        endDate: expireDate,
        status: r[I.status] ? r[I.status].trim() : null,
        year: certDate ? certDate.getUTCFullYear() : null,
        notes,
      },
    });
    created++;
    console.log(`  [+] ${company} - ${standard} (${certNo}) ${certDate ? certDate.toISOString().slice(0, 10) : ""}`);
  }
  console.log(`\nDONE: 신규 ${created}건 / 스킵 ${skipped}건`);

  const total = await p.trackRecord.count({ where: { category: "certification" } });
  console.log(`전체 인증 레코드: ${total}건`);
  await p.$disconnect();
})();
