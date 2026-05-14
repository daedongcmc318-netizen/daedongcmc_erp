/*
 * 구글시트_기업 DB.xlsx 동기화
 *
 * 컬럼 구성 (row1 헤더):
 *   0:구분 | 1:업체/기관명 | 2:지역 | 3:주소 | 4:PM | 5:대표자
 *   6:담당자 | 7:직위 | 8:메일 | 9:전화번호 | 10:매출액 | 11:업종 | 12:아이템
 *
 * 매칭 키: 이름(name) — 사업자번호가 시트에 없어서 이름으로만 매칭
 *   ㈜/(주) 표기 차이는 정규화해서 동일 회사로 인식
 *
 * 정책:
 *   - 기존 레코드가 있으면: 비어있는 필드만 채워넣기 (덮어쓰기 X)
 *   - notes 필드: 매출액/업종/아이템/구분이 들어있으면 누적 메모로 추가
 *   - 담당자 컨택: 이름이 같은 컨택이 없으면 신규 생성
 *   - 없으면 신규 회사 생성
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

const FILE = path.join(__dirname, "..", "..", "거래처 DB", "구글시트_기업 DB .xlsx");

function cleanStr(raw: any): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

/** 회사명 정규화 — ㈜/(주)/주식회사 표기 차이를 무시하고 매칭하기 위함 */
function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/\([주㈜재]\)/g, "")
    .replace(/[㈜㈐]/g, "")
    .replace(/주식회사/g, "")
    .replace(/유한회사/g, "")
    .replace(/유한책임회사/g, "")
    .toLowerCase();
}

function parseRevenue(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[^\d]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

async function main() {
  console.log("📂 파일:", FILE);
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets["시트1"];
  if (!ws) throw new Error("시트1 not found");
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  console.log(`📊 총 ${rows.length}행 (헤더 2행 포함)`);

  // 1) 기존 회사 전부 로드 → name 정규화 인덱스
  const all = await prisma.company.findMany({ select: { id: true, name: true, bizNo: true, repName: true, address: true, region: true, internalPmCode: true, industry: true, items: true, notes: true } });
  const byNorm = new Map<string, typeof all[number]>();
  for (const c of all) {
    const k = normalizeName(c.name);
    if (!byNorm.has(k)) byNorm.set(k, c);
  }
  console.log(`📚 기존 회사: ${all.length}개사`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let contactsCreated = 0;
  const seenNorm = new Set<string>();

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] as any[];
    const name = cleanStr(r[1]);
    if (!name) continue;

    const norm = normalizeName(name);
    if (seenNorm.has(norm)) continue; // 시트 내부 중복은 첫 행만 사용
    seenNorm.add(norm);

    const category = cleanStr(r[0]); // 25혁신 / 25수출 / 인바운드 ...
    const region = cleanStr(r[2]);
    const address = cleanStr(r[3]);
    const pm = cleanStr(r[4]);
    const repName = cleanStr(r[5]);
    const contactName = cleanStr(r[6]);
    const contactPos = cleanStr(r[7]);
    const email = cleanStr(r[8]);
    const phone = cleanStr(r[9]);
    const revenue = parseRevenue(r[10]);
    const industry = cleanStr(r[11]);
    const items = cleanStr(r[12]);

    // notes 누적 메모 (구글시트 부가 정보)
    const memoParts: string[] = [];
    if (category) memoParts.push(`[구분] ${category}`);
    if (revenue) memoParts.push(`[매출] ${formatKRW(revenue)} (₩${revenue.toLocaleString()})`);
    const sheetNote = memoParts.join(" · ") || null;

    const existing = byNorm.get(norm);

    if (existing) {
      // 빈 필드 채우기 (덮어쓰기 X)
      const patch: any = {};
      if (region && !existing.region) patch.region = region;
      if (address && !existing.address) patch.address = address;
      if (pm && !existing.internalPmCode) patch.internalPmCode = pm;
      if (repName && !existing.repName) patch.repName = repName;
      if (industry && !existing.industry) patch.industry = industry;
      if (items && !existing.items) patch.items = items;

      // 메모는 기존 notes에 누적 (이미 있으면 스킵)
      if (sheetNote) {
        const cur = existing.notes ?? "";
        if (!cur.includes("[구분]") && !cur.includes("[매출]")) {
          patch.notes = cur ? `${cur}\n${sheetNote}` : sheetNote;
        }
      }

      if (Object.keys(patch).length > 0) {
        await prisma.company.update({ where: { id: existing.id }, data: patch });
        updated++;
      } else {
        unchanged++;
      }

      // 컨택 — 동일 이름 컨택이 없으면 추가
      if (contactName) {
        const has = await prisma.companyContact.findFirst({
          where: { companyId: existing.id, name: contactName },
        });
        if (!has) {
          await prisma.companyContact.create({
            data: {
              companyId: existing.id,
              name: contactName,
              position: contactPos,
              phone,
              email,
              isPrimary: false,
            },
          });
          contactsCreated++;
        }
      }
    } else {
      // 신규 생성
      const newCo = await prisma.company.create({
        data: {
          name,
          region,
          address,
          internalPmCode: pm,
          repName,
          industry,
          items,
          notes: sheetNote,
          type: "client",
        },
      });
      created++;
      // 인덱스에 추가 — 시트에 동일 회사 중복이 있어도 두번째는 컨택만 보강하도록
      byNorm.set(norm, { id: newCo.id, name, bizNo: null, repName, address, region, internalPmCode: pm, industry, items, notes: sheetNote });

      if (contactName) {
        await prisma.companyContact.create({
          data: {
            companyId: newCo.id,
            name: contactName,
            position: contactPos,
            phone,
            email,
            isPrimary: true,
          },
        });
        contactsCreated++;
      }
    }
  }

  console.log(`\n✅ 동기화 완료`);
  console.log(`   신규 생성:  ${created}개사`);
  console.log(`   필드 보강:  ${updated}개사`);
  console.log(`   변동 없음:  ${unchanged}개사`);
  console.log(`   신규 컨택:  ${contactsCreated}건`);

  const finalCount = await prisma.company.count();
  console.log(`\n📊 최종 거래처: ${finalCount}개사`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
