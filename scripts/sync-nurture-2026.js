// 2026 육성 노션 xlsx → DB 동기화
//   1) 이미 매칭되는 프로젝트 status 갱신
//   2) 엑셀에만 있는 항목 (대부분 수출바우처 잔금 입금완료) 신규 등록
//   부가 정보 (PM, 자부담, 확정매출 등) 도 함께 반영
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const FILE = "C:/Users/DAEDONGCMC_10/Desktop/대동 통합 ERP/노션 프로젝트 관리 DB/2026 육성 2b02862807ac807b8277fd6d88472311.xlsx";

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[\(\)（）]/g, "")
    .replace(/주식회사|유한회사|㈜|\(주\)|\(유\)/g, "")
    .toLowerCase()
    .trim();
}

const BIZ_MAP = {
  혁신바우처: "innovation",
  수출바우처: "export",
  테크노파크: "tp",
  TP: "tp",
  용역: "contract",
  인증: "certification",
};

// 노션 상태 한글 → DB enum 값 매핑 (육성 PROJECT_STATUS)
const STATUS_MAP = {
  서비스요청수신: "request_received",
  수행계약대기: "contract_pending",
  원가감리: "cost_audit",
  서비스진행중: "in_progress",
  중간완료: "mid_completed",
  수행확인요청: "review_pending",
  성과물검토중: "review_pending",
  정산승인요청: "settlement_request",
  정산완료: "settlement_done",
  입금완료: "payment_done",
  A예정: "scheduled",
};

(async () => {
  const wb = xlsx.readFile(FILE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const header = rows[0];
  // 헤더 확인
  console.log("headers:", header);

  const I = {
    company: header.indexOf("업체.기관명") >= 0 ? header.indexOf("업체.기관명") : header.indexOf("업체/기관명"),
    biz: header.indexOf("사업영역") >= 0 ? header.indexOf("사업영역") : header.indexOf("사업"),
    status: header.indexOf("진행현황"),
    service: header.indexOf("서비스"),
    pm: header.indexOf("PM"),
    manager: header.indexOf("담당자"),
    selfFunding: header.indexOf("자부담"),
    expectedRevenue: header.indexOf("예상매출"),
    confirmedYn: header.indexOf("확정"),
    confirmedRevenue: header.indexOf("확정매출"),
    nurtureType: header.indexOf("신규육성"),
    region: header.indexOf("지역"),
    notes: header.indexOf("비고"),
  };

  const p = new PrismaClient();

  // 기존 DB 인덱스
  const dbProjects = await p.project.findMany({
    where: { year: 2026, source: "nurture" },
    select: { id: true, title: true, status: true },
  });
  const byNormDB = new Map();
  for (const d of dbProjects) {
    const k = norm(d.title);
    if (!byNormDB.has(k)) byNormDB.set(k, []);
    byNormDB.get(k).push(d);
  }

  let updated = 0;
  let created = 0;
  const skipped = [];

  // sortOrder 시작값
  const last = await p.project.findFirst({
    where: { year: 2026, source: "nurture" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? 0) + 1;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const company = r[I.company];
    if (!company) continue;
    const xStatus = r[I.status];
    const dbStatus = STATUS_MAP[xStatus] ?? xStatus; // 매핑 없으면 원본 한글
    const bizValue = BIZ_MAP[r[I.biz]] ?? r[I.biz];

    const k = norm(company);
    const candidates = byNormDB.get(k) ?? [];

    if (candidates.length > 0) {
      // 매칭 — status 동기화 (있으면)
      for (const c of candidates) {
        if (dbStatus && c.status !== dbStatus) {
          await p.project.update({
            where: { id: c.id },
            data: { status: dbStatus },
          });
          updated++;
        }
      }
    } else {
      // 엑셀에만 있음 — 신규 생성
      // 필수 필드: projectCode (unique). title 기반으로 임시 생성
      const projectCode = `26N_${Date.now().toString(36)}_${i}`;
      try {
        await p.project.create({
          data: {
            projectCode,
            year: 2026,
            source: "nurture",
            title: String(company).trim(),
            status: dbStatus || "payment_done", // 노션이 대부분 입금완료
            bizCategory: bizValue || null,
            serviceType: null,
            pmCode: r[I.pm] && r[I.pm] !== "담다" ? String(r[I.pm]).trim() : null,
            region: r[I.region] ? String(r[I.region]).trim() : null,
            selfFunding: r[I.selfFunding] ? Number(r[I.selfFunding]) : null,
            expectedRevenue: r[I.expectedRevenue] ? BigInt(Math.round(Number(r[I.expectedRevenue]))) : BigInt(0),
            confirmedYn: r[I.confirmedYn] === "Yes" || r[I.confirmedYn] === "확정",
            confirmedRevenue: r[I.confirmedRevenue] ? BigInt(Math.round(Number(r[I.confirmedRevenue]))) : BigInt(0),
            nurtureType: r[I.nurtureType] ? String(r[I.nurtureType]).trim() : null,
            remarks: r[I.notes] ? String(r[I.notes]).trim() : null,
            sortOrder: nextOrder++,
          },
        });
        created++;
        console.log(`  [+] ${company}  status=${dbStatus}  biz=${bizValue}`);
      } catch (err) {
        skipped.push({ company, err: err.message });
      }
    }
  }

  console.log(`\nDONE: 업데이트 ${updated} / 신규 ${created} / 실패 ${skipped.length}`);
  if (skipped.length) {
    console.log("실패 샘플:");
    for (const s of skipped.slice(0, 5)) console.log(`  ${s.company}: ${s.err}`);
  }

  // 후 분포
  const after = await p.project.groupBy({
    by: ["status"],
    _count: true,
    where: { source: "nurture", year: 2026 },
  });
  console.log("\n=== 2026 육성 status 분포 (반영 후) ===");
  for (const x of after) console.log(`  ${(x.status || "(빈값)").padEnd(20)} ${x._count}`);
  await p.$disconnect();
})();
