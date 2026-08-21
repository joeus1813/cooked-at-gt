import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REASONS = [
  "EXAMS",
  "ASSIGNMENTS",
  "PROJECTS",
  "RECRUITING",
  "SLEEP",
  "MONEY",
  "DATING",
  "HEALTH",
  "TRAFFIC",
  "OTHER",
] as const;

const checkinSchema = z.object({
  programId: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  reason: z.enum(REASONS),
});

const ANON_COOKIE = "cooked_anon_id";

function isUuid(value: string | undefined): value is string {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = checkinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid check-in." },
        { status: 400 }
      );
    }

    const { programId, score, reason } = parsed.data;

    // 실제 GT 프로그램인지 서버에서 검증
    const { data: program, error: programError } =
      await supabaseAdmin
        .from("programs")
        .select("id, name, degree, academic_level")
        .eq("id", programId)
        .eq("active", true)
        .maybeSingle();

    if (programError) {
      console.error("Program lookup error:", programError);

      return NextResponse.json(
        { error: "Could not validate program." },
        { status: 500 }
      );
    }

    if (!program) {
      return NextResponse.json(
        { error: "Invalid Georgia Tech program." },
        { status: 400 }
      );
    }

    // 로그인 없는 사용자를 브라우저 cookie로 식별
    const existingCookie =
      request.cookies.get(ANON_COOKIE)?.value;

    const anonymousId = isUuid(existingCookie)
      ? existingCookie
      : randomUUID();

    // 실제 check-in 저장
    const { error: insertError } = await supabaseAdmin
      .from("checkins")
      .insert({
        anonymous_id: anonymousId,
        program_id: programId,
        score,
        reason,
      });

    if (insertError) {
      // 하루 1회 제한
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error: "ALREADY_CHECKED_IN",
            message: "You've already checked in today.",
          },
          { status: 409 }
        );
      }

      console.error("Check-in insert error:", insertError);

      return NextResponse.json(
        { error: "Could not save check-in." },
        { status: 500 }
      );
    }

    // 제출 후 최신 통계 가져오기
    const [
      campusPulseResult,
      leaderboardResult,
      reasonsResult,
    ] = await Promise.all([
      supabaseAdmin.rpc("get_guest_daily_pulse", {
        p_academic_level: null,
      }),

      supabaseAdmin.rpc(
        "get_guest_program_leaderboard",
        {
          p_academic_level: program.academic_level,
          p_min_count: 3,
        }
      ),

      supabaseAdmin.rpc("get_guest_reason_breakdown", {
        p_academic_level: null,
      }),
    ]);

    const response = NextResponse.json(
      {
        success: true,

        checkin: {
          score,
          reason,
          program,
        },

        campusPulse:
          campusPulseResult.data?.[0] ?? null,

        leaderboard:
          leaderboardResult.data ?? [],

        reasons:
          reasonsResult.data ?? [],
      },
      { status: 201 }
    );

    // 새 Guest라면 브라우저 식별 cookie 생성
    if (!isUuid(existingCookie)) {
      response.cookies.set({
        name: ANON_COOKIE,
        value: anonymousId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (error) {
    console.error("Check-in API error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}