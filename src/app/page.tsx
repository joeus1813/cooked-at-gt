"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

type AcademicLevel = "undergraduate" | "graduate";
type Screen = "intro" | "checkin";

type Program = {
  id: number;
  name: string;
  degree: string;
  academic_level: AcademicLevel;
};

type Pulse = {
  average_score: number | string | null;
  total_checkins: number | string;
};

type LeaderboardItem = {
  program_id: number;
  program_name: string;
  degree: string;
  academic_level: string;
  average_score: number | string;
  total_checkins: number | string;
};

type ReasonStat = {
  reason: string;
  total_checkins: number | string;
  percentage: number | string;
};

type CampusData = {
  programs: Program[];
  campusPulse: Pulse;
  levelPulse: Pulse;
  leaderboard: LeaderboardItem[];
  reasons: ReasonStat[];
  leaderboardLevel: AcademicLevel;
};

type ResultData = {
  score: number;
  reason: string;
  program: Program;
};

const REASONS = [
  { value: "EXAMS", label: "EXAMS", code: "DMG-01" },
  { value: "ASSIGNMENTS", label: "ASSIGNMENTS", code: "DMG-02" },
  { value: "PROJECTS", label: "PROJECTS", code: "DMG-03" },
  { value: "RECRUITING", label: "RECRUITING", code: "DMG-04" },
  { value: "SLEEP", label: "SLEEP", code: "DMG-05" },
  { value: "MONEY", label: "MONEY", code: "DMG-06" },
  { value: "DATING", label: "DATING", code: "DMG-07" },
  { value: "HEALTH", label: "HEALTH", code: "DMG-08" },
  { value: "TRAFFIC", label: "TRAFFIC", code: "DMG-09" },
  { value: "OTHER", label: "OTHER", code: "DMG-10" },
] as const;

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function padScore(value: number) {
  return String(Math.round(value)).padStart(3, "0");
}

function cookedLabel(score: number) {
  if (score <= 19) return "SUSPICIOUSLY THRIVING";
  if (score <= 39) return "FUNCTIONING CITIZEN";
  if (score <= 59) return "MEDIUM RARE";
  if (score <= 74) return "GETTING CRISPY";
  if (score <= 89) return "DEEP FRIED";
  if (score <= 97) return "ACADEMICALLY DECEASED";

  return "IT WAS NICE KNOWING YOU";
}

function easternDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function reasonLabel(reason: string) {
  return REASONS.find((item) => item.value === reason)?.label ?? reason;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const normalMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const iPadDesktopMode =
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1;

  return normalMobile || iPadDesktopMode;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");

  const [score, setScore] = useState(72);
  const [reason, setReason] = useState("EXAMS");

  const [academicLevel, setAcademicLevel] =
    useState<AcademicLevel>("undergraduate");

  const [programs, setPrograms] = useState<Program[]>([]);

  const [selectedProgramId, setSelectedProgramId] =
    useState<number | null>(null);

  const [campusData, setCampusData] =
    useState<CampusData | null>(null);

  const [result, setResult] =
    useState<ResultData | null>(null);

  const [programPickerOpen, setProgramPickerOpen] =
    useState(false);

  const [programSearch, setProgramSearch] =
    useState("");

  const [shareMenuOpen, setShareMenuOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [sharing, setSharing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const storyCardRef =
    useRef<HTMLDivElement>(null);

  async function loadCampus(level: AcademicLevel) {
    try {
      setError(null);

      const response = await fetch(
        `/api/campus?level=${level}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Campus API failed.");
      }

      const data: CampusData =
        await response.json();

      setCampusData(data);
      setPrograms(data.programs);
    } catch (err) {
      console.error(err);

      setError(
        "CONNECTION ERROR // CAMPUS PULSE OFFLINE"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedLevel =
      localStorage.getItem(
        "cooked_academic_level"
      );

    const level: AcademicLevel =
      savedLevel === "graduate"
        ? "graduate"
        : "undergraduate";

    setAcademicLevel(level);

    const savedProgram =
      localStorage.getItem(
        "cooked_program_id"
      );

    if (savedProgram) {
      const parsedProgram =
        Number(savedProgram);

      if (Number.isFinite(parsedProgram)) {
        setSelectedProgramId(
          parsedProgram
        );
      }
    }

    const savedCheckin =
      localStorage.getItem(
        "cooked_last_checkin"
      );

    if (savedCheckin) {
      try {
        const parsed =
          JSON.parse(savedCheckin);

        if (
          parsed.date ===
            easternDateKey() &&
          parsed.result
        ) {
          setResult(parsed.result);
        }
      } catch {
        localStorage.removeItem(
          "cooked_last_checkin"
        );
      }
    }

    loadCampus(level);
  }, []);

  const selectedProgram =
    programs.find(
      (program) =>
        program.id ===
        selectedProgramId
    );

  const filteredPrograms =
    useMemo(() => {
      return programs
        .filter(
          (program) =>
            program.academic_level ===
            academicLevel
        )
        .filter((program) => {
          const haystack =
            `${program.name} ${program.degree}`
              .toLowerCase();

          return haystack.includes(
            programSearch.toLowerCase()
          );
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );
    }, [
      programs,
      academicLevel,
      programSearch,
    ]);

  const campusScore =
    toNumber(
      campusData?.campusPulse
        .average_score
    ) ?? null;

  const campusCount =
    toNumber(
      campusData?.campusPulse
        .total_checkins
    ) ?? 0;

  async function changeLevel(
    level: AcademicLevel
  ) {
    setAcademicLevel(level);

    localStorage.setItem(
      "cooked_academic_level",
      level
    );

    if (
      selectedProgram &&
      selectedProgram.academic_level !==
        level
    ) {
      setSelectedProgramId(null);

      localStorage.removeItem(
        "cooked_program_id"
      );
    }

    setLoading(true);

    await loadCampus(level);
  }

  async function submitCheckin() {
    if (!selectedProgramId) {
      setError(
        academicLevel ===
          "undergraduate"
          ? "SELECT YOUR MAJOR BEFORE CONTINUING"
          : "SELECT YOUR PROGRAM BEFORE CONTINUING"
      );

      setProgramPickerOpen(true);

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/checkin",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            programId:
              selectedProgramId,
            score,
            reason,
          }),
        }
      );

      const data =
        await response.json();

      if (response.status === 409) {
        setError(
          "DAILY CHECK-IN ALREADY USED // RETURN TOMORROW"
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Check-in failed."
        );
      }

      const newResult: ResultData = {
        score:
          data.checkin.score,

        reason:
          data.checkin.reason,

        program:
          data.checkin.program,
      };

      setResult(newResult);

      localStorage.setItem(
        "cooked_program_id",
        String(selectedProgramId)
      );

      localStorage.setItem(
        "cooked_academic_level",
        data.checkin.program
          .academic_level
      );

      localStorage.setItem(
        "cooked_last_checkin",
        JSON.stringify({
          date: easternDateKey(),
          result: newResult,
        })
      );

      await loadCampus(
        data.checkin.program
          .academic_level
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(err);

      setError(
        "SYSTEM FAILURE // GEORGIA TECH MAY BE TOO COOKED"
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ===========================================
   * SHARE CARD GENERATION
   * ===========================================
   */

  async function generateStoryImage() {
    if (
      !storyCardRef.current ||
      !result
    ) {
      throw new Error(
        "Story card not ready."
      );
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const dataUrl =
      await toPng(
        storyCardRef.current,
        {
          cacheBust: true,

          pixelRatio: 1,

          width: 1080,
          height: 1920,

          backgroundColor:
            "#090a12",
        }
      );

    const response =
      await fetch(dataUrl);

    const blob =
      await response.blob();

    const filename =
      `cooked-at-gt-${result.score}-${easternDateKey()}.png`;

    const file =
      new File(
        [blob],
        filename,
        {
          type: "image/png",
        }
      );

    return {
      dataUrl,
      file,
      filename,
    };
  }

  async function saveScoreImage() {
    if (!result) return;

    setSharing(true);
    setError(null);

    try {
      const {
        dataUrl,
        filename,
      } =
        await generateStoryImage();

      const link =
        document.createElement("a");

      link.href =
        dataUrl;

      link.download =
        filename;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      setShareMenuOpen(false);
    } catch (err) {
      console.error(
        "Image save error:",
        err
      );

      setError(
        "IMAGE SAVE FAILED"
      );
    } finally {
      setSharing(false);
    }
  }

  async function shareToInstagram() {
    if (!result) return;

    setSharing(true);
    setError(null);

    try {
      const {
        file,
        dataUrl,
        filename,
      } =
        await generateStoryImage();

      const mobile =
        isMobileDevice();

      const nativeShareAvailable =
        typeof navigator.share ===
        "function";

      const fileSharingAvailable =
        nativeShareAvailable &&
        (
          typeof navigator.canShare !==
            "function" ||
          navigator.canShare({
            files: [file],
          })
        );

      /*
       * Mobile:
       * Native share sheet.
       * Instagram may be selected here.
       */
      if (
        mobile &&
        fileSharingAvailable
      ) {
        await navigator.share({
          title:
            "Cooked @ GT",

          text:
            `I'm ${result.score}% cooked at GT 🔥\n` +
            `${cookedLabel(result.score)}\n` +
            `#CookedAtGT`,

          files: [file],
        });

        setShareMenuOpen(false);

        return;
      }

      /*
       * Desktop fallback:
       * download Story PNG.
       */
      const link =
        document.createElement("a");

      link.href =
        dataUrl;

      link.download =
        filename;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      setShareMenuOpen(false);

      setError(
        "STORY IMAGE SAVED // OPEN ON MOBILE TO SHARE TO INSTAGRAM"
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(
        "Instagram share error:",
        err
      );

      setError(
        "INSTAGRAM SHARE FAILED"
      );
    } finally {
      setSharing(false);
    }
  }

  /*
   * ===========================================
   * RESULT SCREEN
   * ===========================================
   */

  if (result) {
    const resultCampusScore =
      campusScore === null
        ? null
        : Math.round(campusScore);

    return (
      <main className="arcade-app">
        <div className="scanlines" />

        <div className="top-scoreboard">
          <div>
            <span>1UP</span>

            <strong>
              {padScore(
                result.score
              )}
            </strong>
          </div>

          <div>
            <span>
              HI-SCORE
            </span>

            <strong>
              {campusScore === null
                ? "---"
                : padScore(
                    campusScore
                  )}
            </strong>
          </div>

          <div>
            <span>GT</span>

            <strong>
              {String(
                campusCount
              ).padStart(
                3,
                "0"
              )}
            </strong>
          </div>
        </div>

        <section className="result-hero">
          <p className="green-label">
            ★ GAME OVER ★
          </p>

          <h1>
            COOKED
          </h1>

          <div className="player-score">
            {padScore(
              result.score
            )}
          </div>

          <div className="status-window">
            <span>
              PLAYER STATUS
            </span>

            <strong>
              {cookedLabel(
                result.score
              )}
            </strong>
          </div>

          <p className="player-program">
            {result.program.name} /{" "}
            {result.program.degree}
          </p>

          <p className="damage-code">
            PRIMARY DAMAGE:{" "}
            {reasonLabel(
              result.reason
            )}
          </p>
        </section>

        <section className="arcade-section">
          <div className="section-heading pink-heading">
            LIVE CAMPUS PULSE
          </div>

          <div className="campus-score-window">
            <span>
              GEORGIA TECH
            </span>

            <strong>
              {campusScore === null
                ? "---"
                : `${Math.round(
                    campusScore
                  )}%`}
            </strong>

            <p>
              COOKED TODAY
            </p>

            <small>
              {campusCount} ANONYMOUS
              CHECK-IN
              {campusCount === 1
                ? ""
                : "S"}
            </small>
          </div>
        </section>

        <section className="arcade-section">
          <div className="section-heading">
            ★ HIGH SCORE TABLE ★
          </div>

          {campusData?.leaderboard
            .length ? (
            <div className="high-score-table">
              <div className="high-score-row heading-row">
                <span>
                  RANK
                </span>

                <span>
                  MAJOR
                </span>

                <span>
                  SCORE
                </span>
              </div>

              {campusData.leaderboard
                .slice(0, 8)
                .map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      className="high-score-row"
                      key={
                        item.program_id
                      }
                    >
                      <span>
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span>
                        {
                          item.program_name
                        }
                      </span>

                      <span>
                        {padScore(
                          Number(
                            item.average_score
                          )
                        )}
                      </span>
                    </div>
                  )
                )}
            </div>
          ) : (
            <div className="empty-arcade-window">
              <strong>
                TABLE NOT READY
              </strong>

              <span>
                3 CHECK-INS REQUIRED
                PER MAJOR
              </span>

              <span className="blink-text">
                WAITING FOR MORE
                PLAYERS...
              </span>
            </div>
          )}
        </section>

        <section className="arcade-section">
          <div className="section-heading yellow-heading">
            WHAT&apos;S COOKING GT?
          </div>

          <div className="damage-stats">
            {campusData?.reasons
              .length ? (
              campusData.reasons.map(
                (item) => {
                  const percentage =
                    Number(
                      item.percentage
                    );

                  return (
                    <div
                      className="damage-stat-row"
                      key={
                        item.reason
                      }
                    >
                      <div className="damage-stat-label">
                        <span>
                          {
                            item.reason
                          }
                        </span>

                        <strong>
                          {Math.round(
                            percentage
                          )}
                          %
                        </strong>
                      </div>

                      <div className="pixel-bar">
                        <div
                          style={{
                            width:
                              `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )
            ) : (
              <p className="terminal-message">
                NO DAMAGE DATA FOUND.
              </p>
            )}
          </div>
        </section>

        {/* =====================================
            VISIBLE PLAYER CARD
        ====================================== */}

        <section className="arcade-section">
          <div className="section-heading">
            PLAYER CARD
          </div>

          <div className="share-card">
            <div className="share-card-top">
              COOKED @ GT
            </div>

            <p className="share-kicker">
              YOU&apos;RE
            </p>

            <strong className="share-player-score">
              {Math.round(
                result.score
              )}
              %
            </strong>

            <div className="share-cooked-word">
              COOKED
            </div>

            <span className="share-status">
              {cookedLabel(
                result.score
              )}
            </span>

            <div className="share-context">
              <span>
                PRIMARY DAMAGE
              </span>

              <strong>
                {reasonLabel(
                  result.reason
                )}
              </strong>

              <span>
                MAJOR
              </span>

              <strong>
                {
                  result.program
                    .name
                }
              </strong>
            </div>

            <div className="share-divider" />

            <div className="share-gt-block">
              <span>
                GT TODAY
              </span>

              <strong>
                {resultCampusScore ===
                null
                  ? "---"
                  : `${resultCampusScore}% COOKED`}
              </strong>

              <small>
                {campusCount} CHECK-IN
                {campusCount === 1
                  ? ""
                  : "S"}{" "}
                TODAY
              </small>
            </div>

            <div className="share-card-footer">
              HOW COOKED ARE YOU?
            </div>
          </div>

          <button
            className="arcade-main-button share-score-button"
            onClick={() => {
              setError(null);
              setShareMenuOpen(
                true
              );
            }}
            disabled={sharing}
          >
            SHARE SCORE
          </button>
        </section>

        {/* =====================================
            1080 x 1920 EXPORT-ONLY CARD
        ====================================== */}

        <div className="story-export-stage">
          <div
            ref={storyCardRef}
            className="story-export-card"
          >
            <div className="story-export-header">
              <span>
                COOKED @ GT
              </span>

              <span>
                PLAYER 1
              </span>
            </div>

            <div className="story-export-main">
              <div className="story-export-hero">
                <p>
                  YOU&apos;RE
                </p>

                <strong>
                  {Math.round(
                    result.score
                  )}
                  %
                </strong>

                <h2>
                  COOKED
                </h2>

                <span>
                  {cookedLabel(
                    result.score
                  )}
                </span>
              </div>

              <div className="story-export-context">
                <span>
                  PRIMARY DAMAGE
                </span>

                <strong className="story-export-damage">
                  {reasonLabel(
                    result.reason
                  )}
                </strong>

                <div className="story-export-context-line" />

                <span>
                  MAJOR
                </span>

                <strong className="story-export-major">
                  {
                    result.program
                      .name
                  }
                </strong>
              </div>

              <div className="story-export-divider" />

              <div className="story-export-gt-panel">
                <span>
                  GT TODAY
                </span>

                <strong>
                  {resultCampusScore ===
                  null
                    ? "---"
                    : `${resultCampusScore}% COOKED`}
                </strong>

                <small>
                  {campusCount} CHECK-IN
                  {campusCount === 1
                    ? ""
                    : "S"}{" "}
                  TODAY
                </small>
              </div>
            </div>

            <div className="story-export-footer">
              <strong>
                HOW COOKED ARE YOU?
              </strong>

              <span>
                COOKED @ GT
              </span>

              <small>
                NOT AFFILIATED WITH
                GEORGIA TECH
              </small>
            </div>
          </div>
        </div>

        {error && (
          <div className="system-error">
            ERROR: {error}
          </div>
        )}

        {/* =====================================
            SHARE MODAL
        ====================================== */}

        {shareMenuOpen && (
          <div
            className="share-modal-backdrop"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShareMenuOpen(
                  false
                );
              }
            }}
          >
            <div className="share-modal">
              <div className="share-modal-header">
                <div>
                  <small>
                    SYSTEM / SHARE
                    MODULE
                  </small>

                  <strong>
                    SHARE SCORE
                  </strong>
                </div>

                <button
                  className="share-modal-close"
                  onClick={() =>
                    setShareMenuOpen(
                      false
                    )
                  }
                  disabled={
                    sharing
                  }
                >
                  X
                </button>
              </div>

              <div className="share-modal-preview">
                <span>
                  PLAYER SCORE
                </span>

                <strong>
                  {Math.round(
                    result.score
                  )}
                  %
                </strong>

                <p>
                  {cookedLabel(
                    result.score
                  )}
                </p>
              </div>

              <div className="share-modal-options">
                <button
                  className="share-option save"
                  onClick={
                    saveScoreImage
                  }
                  disabled={
                    sharing
                  }
                >
                  <span className="share-option-icon">
                    ↓
                  </span>

                  <div>
                    <strong>
                      {sharing
                        ? "GENERATING..."
                        : "SAVE IMAGE"}
                    </strong>

                    <small>
                      1080 × 1920 STORY
                      PNG
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>

                <button
                  className="share-option instagram"
                  onClick={
                    shareToInstagram
                  }
                  disabled={
                    sharing
                  }
                >
                  <span className="share-option-icon">
                    ◎
                  </span>

                  <div>
                    <strong>
                      {sharing
                        ? "GENERATING..."
                        : "INSTAGRAM"}
                    </strong>

                    <small>
                      SHARE STORY CARD
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>
              </div>

              <button
                className="share-cancel-button"
                onClick={() =>
                  setShareMenuOpen(
                    false
                  )
                }
                disabled={sharing}
              >
                CANCEL
              </button>

              <p className="share-modal-hint">
                ★ INSTAGRAM SHARING
                WORKS BEST ON MOBILE ★
              </p>
            </div>
          </div>
        )}

        <footer className="arcade-footer">
          <span>
            COOKED @ GT / 2026
          </span>

          <span>
            NOT AFFILIATED WITH
            GEORGIA TECH
          </span>
        </footer>
      </main>
    );
  }

  /*
   * ===========================================
   * INTRO
   * ===========================================
   */

  if (screen === "intro") {
    return (
      <main className="arcade-app intro-screen">
        <div className="scanlines" />

        <div className="top-scoreboard">
          <div>
            <span>1UP</span>
            <strong>000</strong>
          </div>

          <div>
            <span>
              HI-SCORE
            </span>

            <strong>
              {campusScore === null
                ? "---"
                : padScore(
                    campusScore
                  )}
            </strong>
          </div>

          <div>
            <span>
              PLAYERS
            </span>

            <strong>
              {String(
                campusCount
              ).padStart(
                3,
                "0"
              )}
            </strong>
          </div>
        </div>

        <section className="intro-hero">
          <p className="green-label">
            PLAYER 1 / DAILY
            CHECK-IN
          </p>

          <h1>
            HOW COOKED
            <br />
            ARE YOU?
          </h1>

          <p className="intro-copy">
            GEORGIA TECH&apos;S
            UNOFFICIAL
            <br />
            DAILY DAMAGE REPORT
          </p>

          <button
            className="arcade-main-button"
            onClick={() =>
              setScreen(
                "checkin"
              )
            }
          >
            START GAME
          </button>

          <p className="blink-text insert-sanity">
            ▼ INSERT YOUR SANITY ▼
          </p>
        </section>

        <div className="intro-grid-floor" />
      </main>
    );
  }

  /*
   * ===========================================
   * CHECK-IN
   * ===========================================
   */

  return (
    <main className="arcade-app">
      <div className="scanlines" />

      <div className="top-scoreboard">
        <div>
          <span>1UP</span>

          <strong>
            {padScore(score)}
          </strong>
        </div>

        <div>
          <span>
            GT SCORE
          </span>

          <strong>
            {campusScore === null
              ? "---"
              : padScore(
                  campusScore
                )}
          </strong>
        </div>

        <div>
          <span>
            PLAYERS
          </span>

          <strong>
            {String(
              campusCount
            ).padStart(
              3,
              "0"
            )}
          </strong>
        </div>
      </div>

      <section className="checkin-hero">
        <p className="green-label">
          STAGE 01 /
          COOK-O-METER
        </p>

        <h1>
          HOW COOKED
          <br />
          ARE YOU?
        </h1>

        <div className="meter-score">
          {padScore(score)}
        </div>

        <div className="arcade-slider-wrap">
          <input
            className="arcade-slider"
            type="range"
            min="0"
            max="100"
            value={score}
            onChange={(
              event
            ) =>
              setScore(
                Number(
                  event.target
                    .value
                )
              )
            }
          />

          <div className="slider-labels">
            <span>
              CHILLING
            </span>

            <span>
              COOKED
            </span>
          </div>
        </div>

        <div className="status-window">
          <span>
            SYSTEM STATUS
          </span>

          <strong>
            {cookedLabel(score)}
          </strong>
        </div>
      </section>

      <section className="arcade-section">
        <div className="section-heading pink-heading">
          SELECT YOUR DAMAGE
        </div>

        <div className="damage-menu">
          {REASONS.map(
            (item) => {
              const selected =
                item.value ===
                reason;

              return (
                <button
                  key={
                    item.value
                  }
                  className={
                    selected
                      ? "damage-option selected"
                      : "damage-option"
                  }
                  onClick={() =>
                    setReason(
                      item.value
                    )
                  }
                >
                  <span className="selector">
                    {selected
                      ? "▶"
                      : " "}
                  </span>

                  <span>
                    {
                      item.label
                    }
                  </span>

                  <small>
                    {
                      item.code
                    }
                  </small>
                </button>
              );
            }
          )}
        </div>
      </section>

      <section className="arcade-section">
        <div className="section-heading yellow-heading">
          {academicLevel ===
          "undergraduate"
            ? "SELECT YOUR MAJOR"
            : "SELECT YOUR PROGRAM"}
        </div>

        <div className="level-tabs">
          <button
            className={
              academicLevel ===
              "undergraduate"
                ? "active"
                : ""
            }
            onClick={() =>
              changeLevel(
                "undergraduate"
              )
            }
          >
            UNDERGRAD
          </button>

          <button
            className={
              academicLevel ===
              "graduate"
                ? "active"
                : ""
            }
            onClick={() =>
              changeLevel(
                "graduate"
              )
            }
          >
            GRAD
          </button>
        </div>

        <button
          className="program-select-button"
          onClick={() =>
            setProgramPickerOpen(
              true
            )
          }
        >
          <span>
            {selectedProgram
              ? selectedProgram.name
              : academicLevel ===
                  "undergraduate"
                ? "CHOOSE MAJOR..."
                : "CHOOSE PROGRAM..."}
          </span>

          <strong>
            {selectedProgram
              ? selectedProgram.degree
              : "▼"}
          </strong>
        </button>

        {error && (
          <div className="system-error">
            ERROR: {error}
          </div>
        )}

        <button
          className="arcade-main-button checkin-button"
          onClick={
            submitCheckin
          }
          disabled={
            submitting ||
            loading
          }
        >
          {submitting
            ? "SAVING..."
            : "CHECK IN"}
        </button>

        <p className="blink-text continue-message">
          ★ ONE PLAY PER DAY /
          ATLANTA TIME ★
        </p>
      </section>

      <footer className="arcade-footer">
        <span>
          COOKED @ GT / 2026
        </span>

        <span>
          NOT AFFILIATED WITH
          GEORGIA TECH
        </span>
      </footer>

      {programPickerOpen && (
        <div
          className="program-modal-backdrop"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setProgramPickerOpen(
                false
              );
            }
          }}
        >
          <div className="program-modal">
            <div className="program-modal-header">
              <div>
                <small>
                  DATABASE / GT
                  PROGRAMS
                </small>

                <strong>
                  {academicLevel ===
                  "undergraduate"
                    ? "SELECT MAJOR"
                    : "SELECT PROGRAM"}
                </strong>
              </div>

              <button
                onClick={() =>
                  setProgramPickerOpen(
                    false
                  )
                }
              >
                X
              </button>
            </div>

            <div className="program-search-wrap">
              <span>&gt;</span>

              <input
                autoFocus
                value={
                  programSearch
                }
                onChange={(
                  event
                ) =>
                  setProgramSearch(
                    event.target
                      .value
                  )
                }
                placeholder="TYPE TO SEARCH..."
              />
            </div>

            <div className="program-list">
              {filteredPrograms.map(
                (program) => (
                  <button
                    key={
                      program.id
                    }
                    onClick={() => {
                      setSelectedProgramId(
                        program.id
                      );

                      localStorage.setItem(
                        "cooked_program_id",
                        String(
                          program.id
                        )
                      );

                      setProgramSearch(
                        ""
                      );

                      setError(
                        null
                      );

                      setProgramPickerOpen(
                        false
                      );
                    }}
                  >
                    <span>
                      {
                        program.name
                      }
                    </span>

                    <strong>
                      {
                        program.degree
                      }
                    </strong>
                  </button>
                )
              )}

              {!filteredPrograms
                .length && (
                <div className="program-empty">
                  NO MATCH FOUND
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}