# 대동CMC 통합 ERP

Next.js 14 + Prisma + PostgreSQL 기반 사내 통합 관리 시스템.

## 모듈

| 영역 | 기능 |
|---|---|
| 🔐 인증 | bcrypt + HMAC 서명 쿠키, 미들웨어 라우트 가드 |
| 📊 대시보드 | 매출/매입 KPI, 진행현황 파이프라인, 월별 마감, 보고 D-day |
| 📁 프로젝트 관리 | 발굴/육성 탭, 노션·구글시트 호환 36+ 컬럼, 인라인 편집, 드래그 정렬 |
| 🏢 거래처 (3,600+) | 사업자번호·키맨 통합 관리, 세금계산서 거래이력 모달 연동 |
| 📄 세금계산서 (3,100+) | 매출/매입 엑셀 업로드, 연도 버튼, 다중 필드 검색 |
| 💳 카드매입 | 법인카드 명세서 엑셀 업로드 (헤더 자동 매핑) |
| 📑 지출결의 | 프로젝트·세금계산서 매칭, 결재자 지정 → 승인/반려 흐름 |
| ✍️ 전자근로계약 | 계약서 작성 → 수신자(직원) 검색 → 서명 요청 단계 |
| 👥 직원 관리 | 4대보험 22명 시드, 이카운트 스타일 인사카드 모달 |

## 로컬 개발

```bash
npm install
cp .env.example .env.local      # 그리고 DATABASE_URL / SESSION_SECRET 설정

npx prisma db push
npm run db:seed-all              # 초기 데이터 일괄 시드
npm run dev                      # http://localhost:3001
```

## 배포

`DEPLOYMENT.md` 참고. 요약:
1. GitHub 푸시
2. Neon/Vercel Postgres 생성
3. 로컬에서 `DATABASE_URL` 설정 후 `npm run db:seed-all`
4. Vercel에서 환경변수 등록 후 Deploy

## 기본 로그인

| 계정 | 비번 | 비고 |
|---|---|---|
| `jhchoi` | `#choi421342#` | 대표이사 (admin) |
| `admin` | `#choi421342#` | 시스템 관리자 |

## 기술 스택

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM, PostgreSQL (운영) / SQLite (로컬 옵션)
- bcryptjs, lucide-react, xlsx
