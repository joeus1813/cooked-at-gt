import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_LEVELS = ["undergraduate", "graduate"] as const;

export async function GET(request: NextRequest) {
  try {
    const levelParam = request.nextUrl.searchParams.get("level");

    const level = VALID_LEVELS.includes(
      levelParam as (typeof VALID_LEVELS)[number]
    )
      ? levelParam
      : "undergraduate";

    const [
      programsResult,
      campusPulseResult,
      levelPulseResult,
      leaderboardResult,
      reasonsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("programs")
        .select("id, name, degree, academic_level")
        .eq("active", true)
        .order("academic_level")
        .order("name")
        .order("degree"),

      supabaseAdmin.rpc("get_guest_daily_pulse", {
        p_academic_level: null,
      }),

      supabaseAdmin.rpc("get_guest_daily_pulse", {
        p_academic_level: level,
      }),

      supabaseAdmin.rpc("get_guest_program_leaderboard", {
        p_academic_level: level,
        p_min_count: 3,
      }),

      supabaseAdmin.rpc("get_guest_reason_breakdown", {
        p_academic_level: null,
      }),
    ]);

    const errors = [
      programsResult.error,
      campusPulseResult.error,
      levelPulseResult.error,
      leaderboardResult.error,
      reasonsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Campus API Supabase error:", errors);

      return NextResponse.json(
        { error: "Failed to load campus data." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      programs: programsResult.data ?? [],

      campusPulse: campusPulseResult.data?.[0] ?? {
        average_score: null,
        total_checkins: 0,
      },

      levelPulse: levelPulseResult.data?.[0] ?? {
        average_score: null,
        total_checkins: 0,
      },

      leaderboard: leaderboardResult.data ?? [],

      reasons: reasonsResult.data ?? [],

      leaderboardLevel: level,
    });
  } catch (error) {
    console.error("Campus API error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}