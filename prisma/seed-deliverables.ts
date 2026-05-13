/*
 * 산출물·특이사항 시드 — '구글시트 DB/2026년 프로젝트 진행현황.xlsx' (2026 시트)
 * 업체명(title) 매칭으로 기존 프로젝트의 deliverables(seq 1/2/3)와 remarks를 채움.
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

function excelDateToISO(serial: any): Date | null {
  if (serial == null || serial === "") return null;
  if (typeof serial === "number") {
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof serial === "string") {
    const m = serial.match(/(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
    if (m) return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  return null;
}

// 산출물 셀 → { title, completedDate? }
// "근골격계보고서\n2025.05.30" 같은 형식 처리
function parseDeliverableCell(raw: any): { title: string; completedDate: Date | null } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const title = lines[0];
  let completedDate: Date | null = null;
  if (lines.length > 1) {
    completedDate = excelDateToISO(lines[1]);
  }
  return { title, completedDate };
}

function normalizeTitle(t: string): string {
  return t
    .replace(/[()（）주식회사주식株式]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

async function main() {
  const filePath = path.join(__dirname, "..", "..", "구글시트 DB", "2026년 프로젝트 진행현황.xlsx");
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["2026"];
  if (!ws) throw new Error("Sheet '2026' not found");
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  // 헤더는 row 10, 데이터는 11+ (앞서 확인됨)
  // 칼럼 인덱스: 구분(0), 사업(1), 진행현황(2), 업체명(3), 담당자(4), 사업비(5),
  //   수행일정(6), 선금여부(7), 수행(8), 산출물(9), 산출물1(10), 산출물2(11), 산출물3(12),
  //   중간보고(13), 완료보고(14), 특이사항(15), 업체담당자(16), 연락처(17), 이메일주소(18)

  // 2026년 nurture 프로젝트 캐시 (정규화 이름으로 검색용)
  const projects = await prisma.project.findMany({
    where: { year: 2026, source: "nurture" },
    select: { id: true, title: true },
  });
  const titleMap = new Map<string, string>(); // normTitle -> projectId
  for (const p of projects) titleMap.set(normalizeTitle(p.title), p.id);

  let matched = 0;
  let unmatched: string[] = [];
  let deliverablesCreated = 0;
  let remarksSet = 0;

  for (let i = 11; i < rows.length; i++) {
    const r = rows[i];
    const name = r[3] ? String(r[3]).trim() : "";
    if (!name) continue;

    const projectId = titleMap.get(normalizeTitle(name));
    if (!projectId) {
      unmatched.push(name);
      continue;
    }
    matched++;

    // 산출물 1/2/3
    for (let seq = 1; seq <= 3; seq++) {
      const cell = parseDeliverableCell(r[9 + seq]); // 산출물1=10, 산출물2=11, 산출물3=12
      if (!cell) continue;

      const existing = await prisma.projectDeliverable.findFirst({
        where: { projectId, seq },
      });
      const data = {
        projectId,
        seq,
        title: cell.title,
        completedDate: cell.completedDate,
        isCompleted: !!cell.completedDate,
      };
      if (existing) {
        await prisma.projectDeliverable.update({ where: { id: existing.id }, data });
      } else {
        await prisma.projectDeliverable.create({ data });
        deliverablesCreated++;
      }
    }

    // 특이사항
    const remarks = r[15] ? String(r[15]).trim() : null;
    if (remarks) {
      await prisma.project.update({ where: { id: projectId }, data: { remarks } });
      remarksSet++;
    }
  }

  console.log(`✓ 매칭된 프로젝트: ${matched}건`);
  console.log(`✓ 산출물 신규 생성: ${deliverablesCreated}건`);
  console.log(`✓ 특이사항 채움: ${remarksSet}건`);
  if (unmatched.length > 0) {
    console.log(`\n⚠ 매칭 실패 (${unmatched.length}건):`);
    for (const u of unmatched.slice(0, 15)) console.log(`  - ${u}`);
    if (unmatched.length > 15) console.log(`  ...외 ${unmatched.length - 15}건`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
