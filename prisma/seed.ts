import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

// Excel 직렬 날짜 → Date
function excelDateToJSDate(serial: number | string | null | undefined): Date | null {
  if (serial == null || serial === "") return null;
  if (typeof serial === "string") {
    // "2026/03/03 → 2026/06/12" 같은 문자열은 별도 파서가 처리
    return null;
  }
  if (typeof serial !== "number") return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function parseDateRange(text: string | null | undefined): { start: Date | null; end: Date | null } {
  if (!text || typeof text !== "string") return { start: null, end: null };
  // "2026/03/03 → 2026/06/12"
  const m = text.match(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2}).*?(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (!m) return { start: null, end: null };
  return {
    start: new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`),
    end: new Date(`${m[4]}-${m[5].padStart(2, "0")}-${m[6].padStart(2, "0")}`),
  };
}

const STATUS_MAP: Record<string, string> = {
  서비스요청수신: "request_received",
  수행계약대기: "contract_pending",
  원가감리: "cost_audit",
  서비스진행중: "in_progress",
  성과물검토중: "review_pending",
  정산승인요청: "settlement_request",
  정산완료: "settlement_done",
  입금완료: "payment_done",
  사업신청: "request_received",
  문의: "request_received",
  탈락: "request_received",
};

const BIZ_MAP: Record<string, string> = {
  혁신바우처: "innovation",
  수출바우처: "export",
  용역: "contract",
  인증: "certification",
  임대: "rental",
};

const SERVICE_MAP: Record<string, string> = {
  혁신컨설팅: "consulting",
  혁신마케팅: "marketing",
  혁신기술지원: "tech_support",
  수출컨설팅: "export_consulting",
  통번역: "translation",
  전시회행사: "exhibition",
  용역컨설팅: "contract_work",
  인증: "certification",
  임대: "rental",
  비용정산: "cost_settlement",
};

async function seedUsers() {
  const usersData = [
    { empNo: "00001", name: "최진혁", dept: "CEO", position: "대표이사", role: "admin", pmCode: "JHC" },
    { empNo: "180322", name: "박지윤", dept: "HRD사업본부", position: "이사", role: "manager", pmCode: "JYP" },
    { empNo: "200101", name: "강도희", dept: "사업운영본부", position: "연구원", role: "staff", pmCode: null },
    { empNo: "200102", name: "강혜인", dept: "사업운영본부", position: "연구원", role: "staff", pmCode: null },
    { empNo: "201020", name: "김혜진", dept: "사업운영본부", position: "책임연구원", role: "manager", pmCode: "HJK" },
    { empNo: "25072302", name: "임한솔", dept: "사업운영본부", position: "연구원", role: "staff", pmCode: null },
    { empNo: "25090101", name: "인턴1", dept: "사업운영본부", position: "인턴", role: "staff", pmCode: null },
    { empNo: "PM_GHW", name: "GHW(미매핑)", dept: "글로벌사업본부", position: "PM", role: "manager", pmCode: "GHW" },
    { empNo: "PM_GSY", name: "GSY(미매핑)", dept: "사업운영본부", position: "PM", role: "manager", pmCode: "GSY" },
    { empNo: "PM_DWK", name: "DWK(미매핑)", dept: "사업운영본부", position: "PM", role: "manager", pmCode: "DWK" },
    { empNo: "PM_DHL", name: "DHL(미매핑)", dept: "사업운영본부", position: "PM", role: "manager", pmCode: "DHL" },
    { empNo: "PM_HYP", name: "HYP(미매핑)", dept: "사업운영본부", position: "PM", role: "manager", pmCode: "HYP" },
    { empNo: "PM_YSL", name: "YSL(미매핑)", dept: "사업운영본부", position: "PM", role: "manager", pmCode: "YSL" },
    { empNo: "PM_DAMDA", name: "담다(외부)", dept: "협력사", position: "외부 PM", role: "staff", pmCode: "담다" },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { empNo: u.empNo },
      update: {},
      create: {
        empNo: u.empNo,
        name: u.name,
        dept: u.dept,
        position: u.position,
        role: u.role,
        pmCode: u.pmCode,
        status: "active",
        annualLeaveTotal: 15,
        annualLeaveUsed: 0,
      },
    });
  }
  console.log(`✓ users seeded: ${usersData.length}`);
}

async function seedFromNurtureSheet() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "노션 프로젝트 관리 DB",
    "2026 육성 2b02862807ac807b8277fd6d88472311.xlsx"
  );
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });

  let count = 0;
  let order = 0;
  for (const row of rows) {
    const code = String(row["구분"] ?? "").trim();
    const title = String(row["업체.기관명"] ?? "").trim();
    if (!code || !title) continue;
    order++;

    const companyName = title.replace(/\s*[CMTBR]?\s*(\(선금\)|\(잔금\))?\s*$/u, "").trim();
    const company = companyName
      ? await prisma.company.upsert({
          where: { bizNo: `temp-${companyName}` }, // bizNo unknown — use placeholder
          update: {},
          create: { name: companyName, bizNo: `temp-${companyName}`, type: "client", region: row["지역"] ?? null },
        }).catch(async () => {
          // bizNo conflict — fall back to find-or-create by name
          const found = await prisma.company.findFirst({ where: { name: companyName } });
          if (found) return found;
          return prisma.company.create({
            data: { name: companyName, type: "client", region: row["지역"] ?? null },
          });
        })
        : null;

    const agencyName = row["운영기관"] ? String(row["운영기관"]).trim() : null;
    let agency = null;
    if (agencyName) {
      agency = await prisma.company.findFirst({ where: { name: agencyName } });
      if (!agency) {
        agency = await prisma.company.create({ data: { name: agencyName, type: "agency" } });
      }
    }

    const bizRaw = String(row["사업영역"] ?? "").split(",")[0].trim();
    const serviceRaw = String(row["서비스"] ?? "").trim();
    const statusRaw = String(row["진행현황"] ?? "").trim();
    const { start, end } = parseDateRange(row["수행일자"]);

    const isAdvance = /\(선금\)/.test(title);
    const isBalance = /\(잔금\)/.test(title);

    const projectCodeUnique = `${row["연도"] ?? 2026}-${code}-${isAdvance ? "A" : isBalance ? "B" : "M"}`;

    // contact
    if (company && row["업체담당자"]) {
      const exists = await prisma.companyContact.findFirst({
        where: { companyId: company.id, name: String(row["업체담당자"]) },
      });
      if (!exists) {
        await prisma.companyContact.create({
          data: {
            companyId: company.id,
            name: String(row["업체담당자"]),
            phone: row["전화번호"] ? String(row["전화번호"]) : null,
            email: row["이메일"] ? String(row["이메일"]) : null,
            isPrimary: true,
          },
        });
      }
    }

    const managerName = row["담당자"] ? String(row["담당자"]).trim() : null;
    const manager = managerName ? await prisma.user.findFirst({ where: { name: managerName } }) : null;

    await prisma.project.upsert({
      where: { projectCode: projectCodeUnique },
      update: { displayCode: code, sortOrder: order },
      create: {
        projectCode: projectCodeUnique,
        displayCode: code,
        sortOrder: order,
        year: Number(row["연도"] ?? 2026),
        title,
        companyId: company?.id ?? null,
        agencyId: agency?.id ?? null,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        serviceType: SERVICE_MAP[serviceRaw] ?? serviceRaw ?? null,
        serviceDetail: row["상세서비스"] ? String(row["상세서비스"]) : null,
        status: STATUS_MAP[statusRaw] ?? "request_received",
        pmCode: row["PM"] ? String(row["PM"]).trim() : null,
        managerId: manager?.id ?? null,
        confirmedRevenue: BigInt(Number(row["확정매출"] ?? 0) || 0),
        nurtureType: row["신규육성"] === "신규" ? "new" : row["신규육성"] === "육성" ? "nurture" : null,
        region: row["지역"] ?? null,
        startDate: start,
        endDate: end,
        isAdvance,
        isBalance,
        parentProjectCode: isAdvance || isBalance ? `${row["연도"] ?? 2026}-${code}` : null,
        requestStatus:
          row["요청수신"] === "작성완료"
            ? "received"
            : row["요청수신"] === "접수"
              ? "submitted"
              : row["요청수신"] === "해당없음"
                ? "na"
                : null,
        agreementYn: row["협약"] === "Yes",
        advancePaidYn: row["선금"] === "Yes",
        midReportDate: excelDateToJSDate(row["중간보고일자"]),
        midReportYn: row["중간보고"] === "Yes",
        finalReportDate: excelDateToJSDate(row["완료보고일자"]),
        finalReportYn: row["완료보고"] === "Yes",
        revisionYn: row["보완"] === "Yes",
        keyword: row["키워드"] ? String(row["키워드"]) : null,
        notes: row["비고"] ? String(row["비고"]) : null,
      },
    });

    // tax invoice (if any)
    if (row["계산서발행"] === "Yes" || row["계산서발행금액"]) {
      const project = await prisma.project.findUnique({ where: { projectCode: projectCodeUnique } });
      if (project) {
        const existing = await prisma.taxInvoice.findFirst({ where: { projectId: project.id } });
        if (!existing) {
          await prisma.taxInvoice.create({
            data: {
              projectId: project.id,
              companyId: company?.id ?? null,
              amount: BigInt(Number(row["계산서발행금액"] ?? 0) || 0),
              issueDate: excelDateToJSDate(row["발행일자"]),
              issuedYn: row["계산서발행"] === "Yes",
              vatReceivedYn: row["부가세입금"] === "Yes",
              settlementDoneYn: row["정산완료"] === "Yes",
              paymentDoneYn: row["입금완료"] === "Yes",
              paymentDate: excelDateToJSDate(row["입금일자"]),
              description: row["품목"] ? String(row["품목"]) : null,
            },
          });
        }
      }
    }

    count++;
  }
  console.log(`✓ projects (육성) seeded: ${count}`);
}

async function seedFromDiscoverySheet() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "노션 프로젝트 관리 DB",
    "2026 발굴 2b02862807ac80bdb71cf783db1de7cc.xlsx"
  );
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });

  let count = 0;
  let order = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const companyName = String(row["업체.기관명"] ?? "").trim();
    if (!companyName) continue;
    order++;

    // 발굴 시트는 코드 컬럼 없음 → 자동 생성
    const projectCodeUnique = `${row["연도"] ?? 2026}-DISC-${String(i + 1).padStart(3, "0")}`;

    let company = await prisma.company.findFirst({ where: { name: companyName } });
    if (!company) {
      company = await prisma.company.create({
        data: { name: companyName, type: "client", region: row["지역"] ?? null },
      });
    }

    const bizRaw = String(row["사업영역"] ?? "").split(",")[0].trim();
    const serviceRaw = String(row["서비스"] ?? "").trim();
    const statusRaw = String(row["진행현황"] ?? "").trim();
    const confirmedRaw = String(row["확정"] ?? "").trim();
    const confirmedYn = confirmedRaw === "Yes";

    // 예상매출: 단위가 백만원으로 보임 (0.3 같은 값) — 원 단위로 환산
    const expectedRevRaw = Number(row["예상매출"] ?? 0) || 0;
    const expectedRevenue = BigInt(Math.round(expectedRevRaw * 1_000_000));
    const confirmedRevenue = BigInt(Number(row["확정매출"] ?? 0) || 0);

    const managerName = row["담당자"] ? String(row["담당자"]).trim() : null;
    const manager = managerName ? await prisma.user.findFirst({ where: { name: managerName } }) : null;

    await prisma.project.upsert({
      where: { projectCode: projectCodeUnique },
      update: {
        sortOrder: order,
        content: row["내용"] ? String(row["내용"]) : null,
        selfFunding: row["자부담"] != null ? Number(row["자부담"]) : null,
      },
      create: {
        projectCode: projectCodeUnique,
        sortOrder: order,
        year: Number(row["연도"] ?? 2026),
        title: companyName,
        companyId: company.id,
        bizCategory: BIZ_MAP[bizRaw] ?? "innovation",
        serviceType: SERVICE_MAP[serviceRaw] ?? null,
        serviceDetail: serviceRaw && !SERVICE_MAP[serviceRaw] ? serviceRaw : null,
        status: STATUS_MAP[statusRaw] ?? "request_received",
        pmCode: row["PM"] ? String(row["PM"]).trim() : null,
        managerId: manager?.id ?? null,
        confirmedRevenue,
        expectedRevenue,
        source: "discovery",
        confirmedYn,
        nurtureType: row["신규육성"] === "신규" ? "new" : row["신규육성"] === "육성" ? "nurture" : null,
        region: row["지역"] ?? null,
        content: row["내용"] ? String(row["내용"]) : null,
        selfFunding: row["자부담"] != null ? Number(row["자부담"]) : null,
        notes: row["비고"] ? String(row["비고"]) : null,
      },
    });
    count++;
  }
  console.log(`✓ projects (발굴) seeded: ${count}`);
}

async function backfillNurtureFlag() {
  // 기존 육성 행에 source/confirmedYn 채우기 (재시드 멱등성 보장)
  const r = await prisma.project.updateMany({
    where: { source: "nurture", confirmedYn: false },
    data: { confirmedYn: true },
  });
  console.log(`✓ backfilled 육성 confirmedYn: ${r.count}`);
}

async function main() {
  await seedUsers();
  await seedFromNurtureSheet();
  await backfillNurtureFlag();
  await seedFromDiscoverySheet();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
