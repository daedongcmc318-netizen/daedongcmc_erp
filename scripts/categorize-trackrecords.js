// 기존 TrackRecord 497건에 category 자동 부여 (serviceName 키워드 기반)
//   카테고리: consulting / tech_support / marketing / service / certification / etc
//   매칭 규칙:
//     - 시제품, 금형, 가공, CAD, 설계, 시설구축, 인프라, 연구시설 → tech_support
//     - 홈페이지, 브로슈어, 리플렛, 카탈로그, 영상, SNS, 광고, 마케팅 전략, 디자인 → marketing
//     - 컨설팅, 경영, 인사노무, 회계, 전략수립, 시장분석, 진출 → consulting
//     - 용역, 운영지원 → service
//     - 그 외 → null (수동 분류 필요)
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { PrismaClient } = require("@prisma/client");

function categorize(serviceName, notes) {
  const t = `${serviceName ?? ""} ${notes ?? ""}`.toLowerCase();
  // 마케팅 키워드 (홍보/디자인)
  const marketingKw = ["홈페이지", "브로슈어", "리플렛", "카탈로그", "영상제작", "광고", "디자인", "sns", "패키지디자인", "패키지 디자인", "마케팅전략", "마케팅 전략", "콘텐츠"];
  // 기술지원 키워드 (시제품/시설)
  const techKw = ["시제품", "금형", "가공", "cad", "설계", "시설구축", "인프라", "연구시설", "프린팅", "프로토타입", "지그", "회로", "사출", "기술지원"];
  // 컨설팅 키워드
  const consKw = ["컨설팅", "경영", "전략수립", "인사노무", "회계", "시장분석", "시장조사", "수출전략", "진출", "esg", "esg경영", "재무"];
  // 용역 키워드
  const svcKw = ["용역", "운영지원", "사업운영", "기획용역"];
  // 인증 키워드
  const certKw = ["iso", "인증서", "iso인증", "원전기업"];

  if (certKw.some((k) => t.includes(k))) return "certification";
  if (techKw.some((k) => t.includes(k))) return "tech_support";
  if (marketingKw.some((k) => t.includes(k))) return "marketing";
  if (consKw.some((k) => t.includes(k))) return "consulting";
  if (svcKw.some((k) => t.includes(k))) return "service";
  return null;
}

(async () => {
  const p = new PrismaClient();
  const records = await p.trackRecord.findMany({
    select: { id: true, serviceName: true, notes: true, type: true },
  });
  const counts = { consulting: 0, tech_support: 0, marketing: 0, service: 0, certification: 0, etc: 0, _null: 0 };

  for (const r of records) {
    const cat = categorize(r.serviceName, r.notes);
    if (cat) {
      await p.trackRecord.update({ where: { id: r.id }, data: { category: cat } });
      counts[cat]++;
    } else {
      counts._null++;
    }
  }

  console.log("\n=== 자동 카테고리 부여 결과 ===");
  console.log(`  컨설팅 (consulting): ${counts.consulting}`);
  console.log(`  기술지원 (tech_support): ${counts.tech_support}`);
  console.log(`  마케팅 (marketing): ${counts.marketing}`);
  console.log(`  용역 (service): ${counts.service}`);
  console.log(`  인증 (certification): ${counts.certification}`);
  console.log(`  미분류 (null): ${counts._null}`);
  console.log(`  합계: ${records.length}`);
  await p.$disconnect();
})();
