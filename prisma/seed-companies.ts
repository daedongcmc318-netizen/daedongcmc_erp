/*
 * 거래처(업체) 시드 — '(주)대동CMC_거래처 DB_최종.xlsx' + '거래처 정보.xlsx'
 * - 메인 DB: 풍부한 정보(등급/대표자/키맨/주소/업종/사업자번호 등)
 * - 이카운트 추출본: 거래처코드(=사업자번호) 매칭용 백업 데이터
 *
 * 멱등성: bizNo 또는 name 으로 기존 레코드를 찾아 머지/갱신
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

const BASE = path.join(__dirname, "..", "..", "거래처 DB");
const MAIN_FILE = path.join(BASE, "(주)대동CMC_거래처 DB_최종.xlsx");
const ECOUNT_FILE = path.join(BASE, "거래처 정보.xlsx");

function normBizNo(raw: any): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d]/g, "").trim();
  if (digits.length === 10) return digits;
  return null;
}

function parseDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    // Excel serial date
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    // "2020.08.24" or "2017.10.01"
    const m1 = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m1) return new Date(`${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`);
    // "2020.08" — partial
    const m2 = s.match(/(\d{4})[./-](\d{1,2})/);
    if (m2) return new Date(`${m2[1]}-${m2[2].padStart(2, "0")}-01`);
  }
  return null;
}

function extractRegion(address: string | null | undefined): string | null {
  if (!address) return null;
  const head = address.trim().split(/\s+/)[0] || "";
  // 첫 어절에서 시/도 추출
  const regions: Record<string, string> = {
    서울특별시: "서울",
    서울시: "서울",
    서울: "서울",
    부산광역시: "부산",
    부산시: "부산",
    부산: "부산",
    대구광역시: "대구",
    대구: "대구",
    인천광역시: "인천",
    인천: "인천",
    광주광역시: "광주",
    광주: "광주",
    대전광역시: "대전",
    대전: "대전",
    울산광역시: "울산",
    울산시: "울산",
    울산: "울산",
    세종특별자치시: "세종",
    세종: "세종",
    경기도: "경기",
    경기: "경기",
    강원도: "강원",
    강원: "강원",
    충청북도: "충북",
    충북: "충북",
    충청남도: "충남",
    충남: "충남",
    전라북도: "전북",
    전북특별자치도: "전북",
    전북: "전북",
    전라남도: "전남",
    전남: "전남",
    경상북도: "경북",
    경북: "경북",
    경상남도: "경남",
    경남: "경남",
    제주특별자치도: "제주",
    제주: "제주",
  };
  return regions[head] ?? null;
}

function cleanStr(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

async function findExisting(bizNo: string | null, name: string) {
  if (bizNo) {
    const byBiz = await prisma.company.findUnique({ where: { bizNo } });
    if (byBiz) return byBiz;
  }
  // bizNo 없거나 못 찾으면 이름으로 (placeholder bizNo 'temp-XXX' 포함)
  const byName = await prisma.company.findFirst({ where: { name } });
  return byName ?? null;
}

async function seedMainDB() {
  const wb = XLSX.readFile(MAIN_FILE);
  const ws = wb.Sheets["DB"];
  if (!ws) throw new Error("Sheet 'DB' not found in main file");

  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  // row 0 = group header, row 1 = sub-header, row 2+ = data

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let contactsCreated = 0;
  const seenBiz = new Set<string>();

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as any[];
    const name = cleanStr(r[0]);
    if (!name || name === "기업명") continue;

    const rating = cleanStr(r[1]);
    const repName = cleanStr(r[2]);
    const keyName = cleanStr(r[3]);
    const keyPos = cleanStr(r[4]);
    const keyField = cleanStr(r[5]); // 전문분야
    const phone1 = cleanStr(r[6]);
    const phone2 = cleanStr(r[7]);
    // const fax = cleanStr(r[8]);
    const email = cleanStr(r[9]);
    const website = cleanStr(r[10]);
    const address = cleanStr(r[11]);
    const bizNo = normBizNo(r[12]);
    const foundedAt = parseDate(r[13]);
    const industry = cleanStr(r[14]);
    const corpType = cleanStr(r[15]);
    const items = cleanStr(r[16]);
    const internalPm = cleanStr(r[29]);
    const memo = cleanStr(r[30]);

    if (bizNo && seenBiz.has(bizNo)) {
      skipped++;
      continue;
    }
    if (bizNo) seenBiz.add(bizNo);

    const region = extractRegion(address);
    const existing = await findExisting(bizNo, name);

    const data: any = {
      name,
      // bizNo는 충돌 위험이 있어 분리 처리
      repName,
      address,
      region,
      website,
      industry,
      corpType,
      foundedAt,
      rating,
      internalPmCode: internalPm,
      items,
      notes: memo,
      type: "client",
    };

    let companyId: string;
    if (existing) {
      // bizNo 갱신: 기존이 placeholder(temp-) 거나 비어있고 새 bizNo가 유효하면 교체
      const updateBizNo =
        bizNo &&
        bizNo !== existing.bizNo &&
        (!existing.bizNo || existing.bizNo.startsWith("temp-"));

      // 빈 값만 덮어쓰지 않고, 새 값이 있으면 갱신 (단, undefined는 제외)
      const update: any = {};
      for (const [k, v] of Object.entries(data)) {
        if (v != null && v !== "") update[k] = v;
      }
      if (updateBizNo) update.bizNo = bizNo;
      else if (bizNo && !existing.bizNo) update.bizNo = bizNo;

      await prisma.company.update({ where: { id: existing.id }, data: update });
      companyId = existing.id;
      updated++;
    } else {
      const createData: any = { ...data };
      if (bizNo) createData.bizNo = bizNo;
      const c = await prisma.company.create({ data: createData });
      companyId = c.id;
      created++;
    }

    // 키맨(담당자) 컨택 추가 — 이름/이메일/연락처가 있으면
    if (keyName || email || phone1) {
      const contactName = keyName ?? "(이름 없음)";
      const existingContact = await prisma.companyContact.findFirst({
        where: { companyId, name: contactName },
      });
      if (!existingContact) {
        await prisma.companyContact.create({
          data: {
            companyId,
            name: contactName,
            position: [keyPos, keyField].filter(Boolean).join(" / ") || null,
            phone: phone1 ?? phone2 ?? null,
            email,
            isPrimary: true,
          },
        });
        contactsCreated++;
      }
    }
  }

  console.log(`✓ 메인 DB — 신규 ${created}건 / 갱신 ${updated}건 / 중복 스킵 ${skipped}건 / 컨택 신규 ${contactsCreated}건`);
}

async function enrichFromEcount() {
  const wb = XLSX.readFile(ECOUNT_FILE);
  const ws = wb.Sheets["거래처등록"];
  if (!ws) throw new Error("Sheet '거래처등록' not found in ecount file");

  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  // row 0 = 회사명 헤더, row 1 = 칼럼명, row 2+ = data
  let enrichedBizNo = 0;
  let enrichedContact = 0;
  let created = 0;

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as any[];
    const bizNo = normBizNo(r[0]);
    const name = cleanStr(r[1]);
    if (!name) continue;
    const repName = cleanStr(r[2]);
    const contactName = cleanStr(r[3]);
    const phone = cleanStr(r[4]);
    const email = cleanStr(r[5]);
    const billingEmail = cleanStr(r[6]);
    const internalPm = cleanStr(r[8]);

    let existing = await findExisting(bizNo, name);

    if (!existing) {
      // 메인 DB에 없는 거래처는 이카운트 데이터로 신규 생성
      existing = await prisma.company.create({
        data: {
          name,
          bizNo,
          repName,
          internalPmCode: internalPm,
          type: "client",
        },
      });
      created++;
    } else {
      const update: any = {};
      if (bizNo && (!existing.bizNo || existing.bizNo.startsWith("temp-"))) {
        update.bizNo = bizNo;
        enrichedBizNo++;
      }
      if (repName && !existing.repName) update.repName = repName;
      if (internalPm && !existing.internalPmCode) update.internalPmCode = internalPm;
      if (Object.keys(update).length > 0) {
        await prisma.company.update({ where: { id: existing.id }, data: update });
      }
    }

    if (contactName || email || phone) {
      const has = await prisma.companyContact.findFirst({
        where: { companyId: existing.id, name: contactName ?? "(이름 없음)" },
      });
      if (!has) {
        await prisma.companyContact.create({
          data: {
            companyId: existing.id,
            name: contactName ?? "(이름 없음)",
            phone,
            email: email ?? billingEmail,
            isPrimary: true,
          },
        });
        enrichedContact++;
      }
    }
  }

  console.log(`✓ 이카운트 — 신규 ${created}건 / bizNo 보강 ${enrichedBizNo}건 / 컨택 신규 ${enrichedContact}건`);
}

async function main() {
  console.log("거래처 시드 시작...");
  await seedMainDB();
  await enrichFromEcount();

  const total = await prisma.company.count();
  const withBiz = await prisma.company.count({
    where: {
      AND: [{ bizNo: { not: null } }, { NOT: { bizNo: { startsWith: "temp-" } } }],
    },
  });
  console.log(`\n📊 최종 거래처: ${total}개사 / 사업자번호 확보 ${withBiz}개사`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
