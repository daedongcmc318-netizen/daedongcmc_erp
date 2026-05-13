# 대동CMC ERP — Vercel 배포 가이드

## 사전 체크리스트

- [ ] GitHub 계정 + 신규 리포지토리 생성 권한
- [ ] Vercel 계정 (GitHub OAuth 연동)
- [ ] PostgreSQL DB 인스턴스 (아래 중 택1)
  - **Vercel Postgres** (Vercel 대시보드에서 1클릭)
  - **Neon** (무료 티어 권장, https://neon.tech)
  - **Supabase** (https://supabase.com)

---

## 1단계: GitHub 리포지토리 생성 & 푸시

```bash
cd "C:\Users\DAEDONGCMC_10\Desktop\대동 통합 ERP\erp-app"

git init
git add .
git commit -m "초기 ERP 시스템 구축"

# GitHub에서 daedong-erp 리포지토리 생성 후 (Private 권장):
git remote add origin https://github.com/<당신의계정>/daedong-erp.git
git branch -M main
git push -u origin main
```

> ⚠️ `.gitignore`에 `.env.local`, `dev.db`, `public/uploads/`가 포함되어 있어 비밀정보·로컬 데이터는 자동 제외됩니다.

---

## 2단계: PostgreSQL DB 준비

### Neon 사용 (권장 — 무료 + 빠름)
1. https://neon.tech 가입
2. New Project → 이름: `daedong-erp`
3. 생성된 Connection String 복사
   - 형식: `postgres://USER:PASS@HOST/DB?sslmode=require`

### Vercel Postgres 사용
1. Vercel 프로젝트 생성 후 Storage → Create Database → Postgres
2. DATABASE_URL 자동 주입됨

---

## 3단계: 로컬에서 DB 스키마 생성 + 데이터 시드

> 운영 DB에 schema + 초기 데이터를 한 번에 채워 넣습니다. 로컬 PC에서 실행:

```bash
cd erp-app

# 운영 DB URL 임시 환경변수로 설정 (Windows PowerShell)
$env:DATABASE_URL = "postgresql://user:pass@host/db?sslmode=require"

# 스키마 생성
npx prisma db push

# 전체 시드 (직원 + 거래처 + 프로젝트 + 세금계산서 + 산출물 + 비밀번호)
npm run db:seed-all
```

> 시드 스크립트들은 부모 폴더(`../거래처 DB/`, `../세금계산서 DB/`, `../노션 프로젝트 관리 DB/`, `../구글시트 DB/`)의 엑셀 파일을 읽으므로 로컬에서 실행해야 합니다.

---

## 4단계: Vercel 프로젝트 생성 & 환경변수 설정

1. https://vercel.com/new
2. **Import GitHub Repository** → `daedong-erp` 선택
3. Framework: Next.js (자동 인식)
4. **Environment Variables**에 다음 2개 추가:

| Key | Value | 비고 |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | 3단계의 URL |
| `SESSION_SECRET` | 32자+ 랜덤 문자열 | 예: `openssl rand -base64 48` 또는 `0H7Yk3v...` |

5. **Deploy** 클릭

빌드 명령은 `package.json`의 `build` (= `prisma generate && next build`)가 자동 사용됩니다.

---

## 5단계: 첫 로그인

배포 완료 후:
1. 배포된 URL (예: `daedong-erp.vercel.app`) 접속
2. 자동으로 `/login` 리다이렉트
3. 계정:
   - 대표이사: `jhchoi` / `#choi421342#`
   - 시스템 관리자: `admin` / `#choi421342#`

---

## 운영 후 데이터 추가 (엑셀 업로드)

세금계산서 / 카드매입 엑셀 파일은 운영 사이트의 「엑셀 업로드」 버튼으로 그대로 올리면 됩니다. DB에 누적됩니다.

---

## 운영 후 주의사항

### 파일 업로드 (전자근로계약 PDF)
Vercel은 파일시스템이 읽기전용이라 현재 `public/uploads/`에 저장하는 방식이 운영에선 작동하지 않습니다. 운영 사이트에서 파일 업로드 시 `501` 에러 반환됩니다.

**해결 방법** (필요시):
- **@vercel/blob** 설치 후 `/api/uploads/route.ts` 수정 (Vercel Blob 스토리지 사용)
- 또는 외부 S3 / Cloudflare R2 등 사용

### 비밀번호 변경
배포 후 다른 직원에게도 로그인을 열어주려면:
```bash
# 로컬에서 운영 DB에 연결한 상태로
DATABASE_URL="postgresql://..." npx tsx prisma/seed-passwords.ts
```
또는 직접 코드 수정 → `prisma/seed-passwords.ts` 사용자별 비밀번호 추가 후 실행.

### 데이터베이스 직접 조회
```bash
DATABASE_URL="postgresql://..." npx prisma studio
```

---

## 로컬 개발으로 돌아가기 (SQLite)

운영 배포 후에도 로컬에선 SQLite로 빠르게 개발하려면 임시로 `prisma/schema.prisma`의 datasource를:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

로 바꾸고 `prisma generate` → `prisma db push` → 시드. 단 운영 배포 직전에 다시 `postgresql`로 되돌려야 합니다.

---

## 트러블슈팅

### "Type error: ..." 빌드 실패
- 보통 `node_modules` 재설치하면 해결: `rm -rf node_modules .next && npm install`

### `P3009` Prisma migration error
- 운영 DB에 이미 다른 스키마가 있는 경우. `npx prisma db push --force-reset`로 초기화 (데이터 삭제됨!)

### 로그인이 안 됨 ("아이디 또는 비밀번호가 일치하지 않습니다")
- 비밀번호 시드가 운영 DB에 안 들어간 경우. 3단계 `npm run db:seed-all` 다시 실행.

### Vercel 빌드 로그에서 `bcryptjs` 관련 에러
- bcryptjs는 순수 JS라 Node/Edge 모두 OK. 만약 native bcrypt를 사용 중이면 bcryptjs로 교체해야 함 (이미 적용됨).

---

## 다음 V2 계획

- [ ] Vercel Blob 연동 (파일 업로드)
- [ ] 결재 알림 (이메일 / Slack)
- [ ] 전자근로계약 PDF 서명 (PDF.js + 서명 캡쳐)
- [ ] 카드매입 자동 매칭 (지출결의서와 연결)
- [ ] 모바일 PWA (next-pwa)
- [ ] 권한 세분화 (RBAC)
