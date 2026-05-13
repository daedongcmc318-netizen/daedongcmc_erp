import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 단일 파일 업로드 — 로컬 개발은 public/uploads 사용.
// 운영(Vercel)은 파일시스템이 읽기전용이라 안내 메시지 반환.
// 추후 @vercel/blob 또는 S3 연결 권장.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  // Vercel 환경 감지
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error:
          "운영 환경에서 파일 업로드는 추후 Vercel Blob 또는 S3 연동 필요. 임시로 외부 파일 URL을 사용하세요.",
      },
      { status: 501 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const safeBase = path.basename(file.name, ext).replace(/[^\w가-힣.\-]/g, "_").slice(0, 60);
  const hash = crypto.randomBytes(6).toString("hex");
  const filename = `${Date.now()}_${hash}_${safeBase}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buf);
  return NextResponse.json({
    fileUrl: `/uploads/${filename}`,
    fileName: file.name,
    size: buf.byteLength,
  });
}
