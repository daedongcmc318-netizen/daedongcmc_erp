// 수출 서비스수행이력 xlsx ↔ DB TrackRecord 점검
// 주의: 이 xlsx 의 컬럼 구조는 혁신(innovation) 스타일 (국가/지원사업 없음).
//       DB innovation 359건과 1:1 매칭일 가능성 높음.
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILE = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/수출 서비스수행이력_20260514143330.xlsx";

(async () => {
  const wb = xlsx.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const header = rows[0];
  const I = {
    no: header.indexOf("번호"),
    service: header.indexOf("서비스명"),
    amount: header.indexOf("서비스이용금액"),
    feeType: header.indexOf("요금형태"),
    startDate: header.indexOf("시작일"),
    endDate: header.indexOf("종료일"),
    company: header.indexOf("수요기업명"),
    processedDate: header.indexOf("처리일자"),
    status: header.indexOf("진행상태"),
  };

  const p = new PrismaClient();
  const dbInnov = await p.trackRecord.findMany({
    where: { type: "innovation" },
    select: { id: true, seqNo: true, clientName: true, serviceName: true, serviceFee: true, status: true, startDate: true },
  });
  const dbExp = await p.trackRecord.findMany({
    where: { type: "export" },
    select: { id: true, seqNo: true, clientName: true, country: true, supportProgram: true },
  });

  console.log(`엑셀 데이터: ${rows.length - 1}건 (헤더 1)`);
  console.log(`DB innovation: ${dbInnov.length}건 / export: ${dbExp.length}건`);

  // seqNo 매칭
  const dbBySeq = new Map(dbInnov.map((d) => [d.seqNo, d]));
  let matched = 0;
  let mismatched = [];
  let xlsxOnly = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const no = Number(r[I.no]);
    const company = r[I.company];
    const amount = Number(r[I.amount] ?? 0);
    if (!no || !company) continue;
    const db = dbBySeq.get(no);
    if (!db) {
      xlsxOnly.push({ no, company });
      continue;
    }
    matched++;
    // 금액 일치 체크
    const dbAmt = Number(db.serviceFee ?? 0);
    if (Math.abs(dbAmt - amount) > 1) {
      mismatched.push({ no, company, xlsxAmount: amount, dbAmount: dbAmt });
    }
  }

  console.log(`\nseqNo 매칭 ${matched}건 / xlsx 에만(${xlsxOnly.length}) / 금액 차이 ${mismatched.length}건`);
  if (xlsxOnly.length > 0 && xlsxOnly.length < 20) {
    console.log("xlsx 에만:");
    for (const x of xlsxOnly) console.log(`  ${x.no} ${x.company}`);
  }
  if (mismatched.length > 0) {
    console.log("\n금액 차이 샘플:");
    for (const m of mismatched.slice(0, 10)) {
      console.log(`  ${m.no} ${m.company}: 엑셀 ₩${m.xlsxAmount.toLocaleString()} ≠ DB ₩${m.dbAmount.toLocaleString()}`);
    }
  }
  if (matched > 0 && mismatched.length === 0 && xlsxOnly.length === 0) {
    console.log("\n✅ 모든 데이터 일치");
  }
  await p.$disconnect();
})();
