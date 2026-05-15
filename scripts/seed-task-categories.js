// task_category 기본 9개 시드: 혁신/수출/TP/용역/인증/기타/다미엑스/사업준비/기관등록
// DropdownOption(category="task_category") 에 upsert. 이미 있으면 색상만 갱신.
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

const DEFAULTS = [
  { value: "innovation", label: "혁신", color: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "export", label: "수출", color: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  { value: "tp", label: "TP", color: "bg-teal-50 text-teal-700 ring-teal-200" },
  { value: "service", label: "용역", color: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "certification", label: "인증", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "etc", label: "기타", color: "bg-slate-100 text-slate-700 ring-slate-200" },
  { value: "damiex", label: "다미엑스", color: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "prep", label: "사업준비", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "register", label: "기관등록", color: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
];

(async () => {
  const p = new PrismaClient();
  let created = 0;
  let updated = 0;
  for (let i = 0; i < DEFAULTS.length; i++) {
    const d = DEFAULTS[i];
    const existing = await p.dropdownOption.findUnique({
      where: { category_value: { category: "task_category", value: d.value } },
    });
    if (existing) {
      await p.dropdownOption.update({
        where: { id: existing.id },
        data: { label: d.label, color: d.color, sortOrder: i + 1 },
      });
      updated++;
    } else {
      await p.dropdownOption.create({
        data: {
          category: "task_category",
          value: d.value,
          label: d.label,
          color: d.color,
          sortOrder: i + 1,
        },
      });
      created++;
    }
    console.log(`  ${d.label.padEnd(8)} → ${d.value.padEnd(15)} ${d.color.split(" ")[0]}`);
  }
  console.log(`\nDONE: created=${created}, updated=${updated}`);
  await p.$disconnect();
})();
