import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 섹션 정의
const SECTIONS = [
  "dashboard",
  "projects",
  "managers",
  "companies",
  "invoices",
  "card_purchases",
  "expenses",
  "contracts",
  "users",
  "accounts",
  "permissions",
  "settings",
] as const;

// 역할별 기본 권한
const DEFAULTS: Record<string, Record<string, { view: boolean; edit: boolean; del: boolean }>> = {
  admin: Object.fromEntries(SECTIONS.map((s) => [s, { view: true, edit: true, del: true }])),
  manager: Object.fromEntries(
    SECTIONS.map((s) => {
      // manager: 모든 섹션 조회 + 사업 영역 편집 / 결재 가능. 계정·권한·설정은 조회만
      if (["accounts", "permissions", "settings"].includes(s)) {
        return [s, { view: true, edit: false, del: false }];
      }
      if (["dashboard", "managers"].includes(s)) {
        return [s, { view: true, edit: false, del: false }];
      }
      return [s, { view: true, edit: true, del: false }];
    })
  ),
  staff: Object.fromEntries(
    SECTIONS.map((s) => {
      // staff: 기본 조회만, 자기 업무 영역만 편집
      if (["accounts", "permissions", "settings", "users"].includes(s)) {
        return [s, { view: false, edit: false, del: false }];
      }
      if (["projects", "expenses", "contracts"].includes(s)) {
        return [s, { view: true, edit: true, del: false }];
      }
      return [s, { view: true, edit: false, del: false }];
    })
  ),
};

async function main() {
  for (const [role, sections] of Object.entries(DEFAULTS)) {
    for (const [section, p] of Object.entries(sections)) {
      await prisma.permission.upsert({
        where: { role_section: { role, section } },
        update: {},  // 기존 값 보존 (관리자가 수동 변경한 것을 덮어쓰지 않음)
        create: { role, section, canView: p.view, canEdit: p.edit, canDelete: p.del },
      });
    }
  }
  const total = await prisma.permission.count();
  console.log(`✓ 권한 시드 — ${total}건 (${Object.keys(DEFAULTS).length}개 역할 × ${SECTIONS.length}개 섹션)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
