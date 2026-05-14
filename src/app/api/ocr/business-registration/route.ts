/**
 * 사업자등록증 / 사업자등록증명 OCR
 * - OpenAI GPT-4o-mini Vision API로 이미지에서 회사정보 추출
 * - 환경변수 OPENAI_API_KEY 필요
 * - 비용: 약 ₩2/장
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `당신은 한국 사업자등록증(또는 사업자등록증명, 부가가치세 사업자등록증) 이미지에서 정보를 추출하는 전문가입니다.
이미지에서 정확히 다음 JSON 스키마로만 응답하세요. 인쇄 도장이 있어도 그 아래/주변 텍스트를 정확히 읽어주세요.
값이 명확하지 않으면 null. 사업자등록번호는 반드시 "000-00-00000" 형식. 일자는 "YYYY-MM-DD" 형식.

{
  "name": "회사명 또는 상호 (예: 주식회사 대동씨엠씨)",
  "bizNo": "사업자등록번호 (예: 829-88-01029)",
  "repName": "대표자명 (예: 최진혁)",
  "address": "사업장 소재지 전체 주소",
  "industry": "업태 (예: 제조업, 도매업, 서비스업)",
  "corpType": "법인구분 (법인사업자/일반과세자/면세사업자/간이과세자 등)",
  "foundedAt": "개업연월일 (YYYY-MM-DD)",
  "items": "종목 (예: 컨설팅, 시제품 제작)"
}`;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "OCR 기능을 사용하려면 OPENAI_API_KEY 환경변수를 설정해야 합니다.",
        setup: "Vercel Project Settings → Environment Variables에서 OPENAI_API_KEY 추가",
      },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지가 너무 큽니다 (최대 8MB)" }, { status: 413 });
    }
    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/") && mime !== "application/pdf") {
      return NextResponse.json(
        { error: "이미지 파일(JPG/PNG/WEBP)만 지원합니다. PDF는 이미지로 변환해서 올려주세요." },
        { status: 400 }
      );
    }
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 이미지(사업자등록증 또는 사업자등록증명)에서 정보를 추출해 JSON으로만 응답하세요.",
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ] as any,
        },
      ],
      max_tokens: 800,
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "OCR 응답 파싱 실패", raw }, { status: 500 });
    }

    // 사업자번호 정규화
    if (parsed.bizNo) {
      const digits = String(parsed.bizNo).replace(/[^\d]/g, "");
      if (digits.length === 10) {
        parsed.bizNo = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
      }
    }

    // 지역 자동 추출
    if (parsed.address) {
      const head = String(parsed.address).trim().split(/\s+/)[0] || "";
      const regions: Record<string, string> = {
        서울특별시: "서울", 서울시: "서울", 서울: "서울",
        부산광역시: "부산", 부산시: "부산", 부산: "부산",
        대구광역시: "대구", 대구: "대구",
        인천광역시: "인천", 인천: "인천",
        광주광역시: "광주", 광주: "광주",
        대전광역시: "대전", 대전: "대전",
        울산광역시: "울산", 울산시: "울산", 울산: "울산",
        세종특별자치시: "세종", 세종: "세종",
        경기도: "경기", 경기: "경기",
        강원도: "강원", 강원특별자치도: "강원", 강원: "강원",
        충청북도: "충북", 충북: "충북",
        충청남도: "충남", 충남: "충남",
        전라북도: "전북", 전북특별자치도: "전북", 전북: "전북",
        전라남도: "전남", 전남: "전남",
        경상북도: "경북", 경북: "경북",
        경상남도: "경남", 경남: "경남",
        제주특별자치도: "제주", 제주: "제주",
      };
      parsed.region = regions[head] ?? null;
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err: any) {
    console.error("[OCR ERROR]", err);
    return NextResponse.json(
      {
        error: "OCR 처리 중 오류가 발생했습니다.",
        detail: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
