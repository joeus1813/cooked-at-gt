"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type PreparedStory = {
  dataUrl: string;
  file: File;
  filename: string;
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
  if (value === null || value === undefined) {
    return null;
  }

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
  return (
    REASONS.find((item) => item.value === reason)?.label ??
    reason
  );
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

  const [programSearch, setProgramSearch] = useState("");

  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const [preparingStory, setPreparingStory] = useState(false);

  const [preparedStory, setPreparedStory] =
    useState<PreparedStory | null>(null);

  const [siteHost, setSiteHost] = useState("COOKED @ GT");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const storyCardRef = useRef<HTMLDivElement>(null);

  const loadCampus = useCallback(
    async (level: AcademicLevel) => {
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

        const data: CampusData = await response.json();

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
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    setSiteHost(
      window.location.host.replace(/^www\./, "")
    );
  }, []);

  useEffect(() => {
    const savedLevel = localStorage.getItem(
      "cooked_academic_level"
    );

    const level: AcademicLevel =
      savedLevel === "graduate"
        ? "graduate"
        : "undergraduate";

    setAcademicLevel(level);

    const savedProgram = localStorage.getItem(
      "cooked_program_id"
    );

    if (savedProgram) {
      const parsedProgram = Number(savedProgram);

      if (Number.isFinite(parsedProgram)) {
        setSelectedProgramId(parsedProgram);
      }
    }

    const savedCheckin = localStorage.getItem(
      "cooked_last_checkin"
    );

    if (savedCheckin) {
      try {
        const parsed = JSON.parse(savedCheckin);

        if (
          parsed.date === easternDateKey() &&
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
  }, [loadCampus]);

  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId
  );

  const filteredPrograms = useMemo(() => {
    return programs
      .filter(
        (program) =>
          program.academic_level === academicLevel
      )
      .filter((program) => {
        const haystack =
          `${program.name} ${program.degree}`.toLowerCase();

        return haystack.includes(
          programSearch.toLowerCase()
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, academicLevel, programSearch]);

  const campusScore =
    toNumber(campusData?.campusPulse.average_score) ??
    null;

  const campusCount =
    toNumber(campusData?.campusPulse.total_checkins) ??
    0;

  async function changeLevel(level: AcademicLevel) {
    setAcademicLevel(level);

    localStorage.setItem(
      "cooked_academic_level",
      level
    );

    if (
      selectedProgram &&
      selectedProgram.academic_level !== level
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
        academicLevel === "undergraduate"
          ? "SELECT YOUR MAJOR BEFORE CONTINUING"
          : "SELECT YOUR PROGRAM BEFORE CONTINUING"
      );

      setProgramPickerOpen(true);

      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          programId: selectedProgramId,
          score,
          reason,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        setError(
          "DAILY CHECK-IN ALREADY USED // RETURN TOMORROW"
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Check-in failed."
        );
      }

      const newResult: ResultData = {
        score: data.checkin.score,
        reason: data.checkin.reason,
        program: data.checkin.program,
      };

      setResult(newResult);

      localStorage.setItem(
        "cooked_program_id",
        String(selectedProgramId)
      );

      localStorage.setItem(
        "cooked_academic_level",
        data.checkin.program.academic_level
      );

      localStorage.setItem(
        "cooked_last_checkin",
        JSON.stringify({
          date: easternDateKey(),
          result: newResult,
        })
      );

      await loadCampus(
        data.checkin.program.academic_level
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
   * ============================================
   * SHARE SYSTEM
   * ============================================
   */

  function getShareUrl() {
    if (typeof window === "undefined") {
      return "";
    }

    return new URL("/", window.location.origin).toString();
  }

  async function copyText(text: string) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea =
      document.createElement("textarea");

    textarea.value = text;

    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const copied =
      document.execCommand("copy");

    textarea.remove();

    if (!copied) {
      throw new Error("Copy failed.");
    }
  }

  const generateStoryImage = useCallback(
    async (): Promise<PreparedStory> => {
      if (!storyCardRef.current || !result) {
        throw new Error(
          "Story card not ready."
        );
      }

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const dataUrl = await toPng(
        storyCardRef.current,
        {
          cacheBust: true,
          pixelRatio: 1,

          width: 1080,
          height: 1920,

          backgroundColor: "#090a12",
        }
      );

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const filename =
        `cooked-at-gt-${result.score}-${easternDateKey()}.png`;

      const file = new File(
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
    },
    [result]
  );

  /*
   * 핵심:
   *
   * SHARE SCORE 모달을 여는 순간
   * Story PNG를 미리 생성한다.
   *
   * 그래서 Instagram 버튼을 누른 순간에는
   * 이미지 생성 await 없이 바로 navigator.share()를 호출한다.
   */

  useEffect(() => {
    if (
      !shareMenuOpen ||
      !result ||
      !storyCardRef.current
    ) {
      return;
    }

    let cancelled = false;

    setPreparedStory(null);
    setPreparingStory(true);

    async function prepareStory() {
      try {
        const story =
          await generateStoryImage();

        if (!cancelled) {
          setPreparedStory(story);
        }
      } catch (err) {
        console.error(
          "Story preparation failed:",
          err
        );

        if (!cancelled) {
          setError(
            "STORY GENERATION FAILED"
          );
        }
      } finally {
        if (!cancelled) {
          setPreparingStory(false);
        }
      }
    }

    prepareStory();

    return () => {
      cancelled = true;
    };
  }, [
    shareMenuOpen,
    result,
    campusScore,
    campusCount,
    siteHost,
    generateStoryImage,
  ]);

  function openShareMenu() {
    setError(null);
    setNotice(null);

    setPreparedStory(null);
    setPreparingStory(true);

    setShareMenuOpen(true);
  }

  async function saveScoreImage() {
    if (!result) return;

    setSharing(true);
    setError(null);
    setNotice(null);

    try {
      const story =
        preparedStory ??
        (await generateStoryImage());

      const link =
        document.createElement("a");

      link.href = story.dataUrl;
      link.download = story.filename;

      document.body.appendChild(link);

      link.click();
      link.remove();

      setShareMenuOpen(false);

      setNotice(
        "STORY IMAGE SAVED // READY TO POST"
      );
    } catch (err) {
      console.error(
        "Image save error:",
        err
      );

      setError("IMAGE SAVE FAILED");
    } finally {
      setSharing(false);
    }
  }

  /*
   * INSTAGRAM / STORY SHARE
   *
   * 중요:
   * 여기서는 이미지 생성 작업을 하지 않는다.
   *
   * 사용자 클릭 -> navigator.share()
   * 순서가 즉시 이어져야 iPhone Safari에서 안정적이다.
   */

  async function shareToInstagram() {
    if (!result) return;

    if (!preparedStory) {
      setError(
        "STORY IS STILL RENDERING // TRY AGAIN"
      );

      return;
    }

    setError(null);
    setNotice(null);

    const shareData = {
      files: [preparedStory.file],
    };

    if (
      typeof navigator.share !== "function"
    ) {
      setError(
        "NATIVE SHARE NOT AVAILABLE // USE SAVE IMAGE"
      );

      return;
    }

    if (
      typeof navigator.canShare === "function" &&
      !navigator.canShare(shareData)
    ) {
      setError(
        "IMAGE SHARING NOT SUPPORTED // USE SAVE IMAGE"
      );

      return;
    }

    try {
      /*
       * 절대로 이 위에 await 넣지 말 것.
       *
       * navigator.share()를 사용자의 탭과
       * 같은 activation 안에서 바로 호출한다.
       */
      const sharePromise =
        navigator.share(shareData);

      setSharing(true);

      await sharePromise;

      setShareMenuOpen(false);
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Instagram share error:",
        err
      );

      if (
        err instanceof Error &&
        err.name === "NotAllowedError"
      ) {
        setError(
          "SHARE BLOCKED // OPEN IN SAFARI AND TAP AGAIN"
        );

        return;
      }

      setError(
        "INSTAGRAM SHARE FAILED // USE SAVE IMAGE"
      );
    } finally {
      setSharing(false);
    }
  }

  /*
   * 실제 플레이 가능한 사이트 링크 공유
   */

  async function shareLink() {
    if (!result) return;

    const shareUrl = getShareUrl();

    const shareText =
      `I'm ${Math.round(result.score)}% COOKED at GT 🔥\n` +
      `${cookedLabel(result.score)}\n\n` +
      `How cooked are you?`;

    const shareData = {
      title: "Cooked @ GT",
      text: shareText,
      url: shareUrl,
    };

    setError(null);
    setNotice(null);

    try {
      if (
        typeof navigator.share === "function"
      ) {
        /*
         * 링크 공유도 사용자 클릭 직후 바로 호출.
         */
        const sharePromise =
          navigator.share(shareData);

        setSharing(true);

        await sharePromise;

        setShareMenuOpen(false);

        return;
      }

      await copyText(
        `${shareText}\n${shareUrl}`
      );

      setShareMenuOpen(false);

      setNotice(
        "SHARE LINK COPIED // CHALLENGE SOMEONE"
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Link share error:",
        err
      );

      try {
        await copyText(
          `${shareText}\n${shareUrl}`
        );

        setShareMenuOpen(false);

        setNotice(
          "SHARE LINK COPIED // CHALLENGE SOMEONE"
        );
      } catch {
        setError(
          "LINK SHARE FAILED"
        );
      }
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    const shareUrl = getShareUrl();

    setError(null);
    setNotice(null);

    try {
      await copyText(shareUrl);

      setShareMenuOpen(false);

      setNotice(
        "LINK COPIED // CHALLENGE SOMEONE"
      );
    } catch (err) {
      console.error(
        "Copy link error:",
        err
      );

      setError(
        "COPY LINK FAILED"
      );
    }
  }

  /*
   * ============================================
   * RESULT SCREEN
   * ============================================
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
              {padScore(result.score)}
            </strong>
          </div>

          <div>
            <span>HI-SCORE</span>

            <strong>
              {campusScore === null
                ? "---"
                : padScore(campusScore)}
            </strong>
          </div>

          <div>
            <span>GT</span>

            <strong>
              {String(campusCount).padStart(
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

          <h1>COOKED</h1>

          <div className="player-score">
            {padScore(result.score)}
          </div>

          <div className="status-window">
            <span>PLAYER STATUS</span>

            <strong>
              {cookedLabel(result.score)}
            </strong>
          </div>

          <p className="player-program">
            {result.program.name} /{" "}
            {result.program.degree}
          </p>

          <p className="damage-code">
            PRIMARY DAMAGE:{" "}
            {reasonLabel(result.reason)}
          </p>
        </section>

        <section className="arcade-section">
          <div className="section-heading pink-heading">
            LIVE CAMPUS PULSE
          </div>

          <div className="campus-score-window">
            <span>GEORGIA TECH</span>

            <strong>
              {campusScore === null
                ? "---"
                : `${Math.round(
                    campusScore
                  )}%`}
            </strong>

            <p>COOKED TODAY</p>

            <small>
              {campusCount} ANONYMOUS CHECK-IN
              {campusCount === 1 ? "" : "S"}
            </small>
          </div>
        </section>

        <section className="arcade-section">
          <div className="section-heading">
            ★ HIGH SCORE TABLE ★
          </div>

          {campusData?.leaderboard.length ? (
            <div className="high-score-table">
              <div className="high-score-row heading-row">
                <span>RANK</span>
                <span>MAJOR</span>
                <span>SCORE</span>
              </div>

              {campusData.leaderboard
                .slice(0, 8)
                .map((item, index) => (
                  <div
                    className="high-score-row"
                    key={item.program_id}
                  >
                    <span>
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </span>

                    <span>
                      {item.program_name}
                    </span>

                    <span>
                      {padScore(
                        Number(
                          item.average_score
                        )
                      )}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-arcade-window">
              <strong>
                TABLE NOT READY
              </strong>

              <span>
                3 CHECK-INS REQUIRED PER MAJOR
              </span>

              <span className="blink-text">
                WAITING FOR MORE PLAYERS...
              </span>
            </div>
          )}
        </section>

        <section className="arcade-section">
          <div className="section-heading yellow-heading">
            WHAT&apos;S COOKING GT?
          </div>

          <div className="damage-stats">
            {campusData?.reasons.length ? (
              campusData.reasons.map(
                (item) => {
                  const percentage =
                    Number(item.percentage);

                  return (
                    <div
                      className="damage-stat-row"
                      key={item.reason}
                    >
                      <div className="damage-stat-label">
                        <span>
                          {item.reason}
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
                            width: `${percentage}%`,
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

        {/* ====================================
            VISIBLE PLAYER CARD
        ==================================== */}

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
              {Math.round(result.score)}%
            </strong>

            <div className="share-cooked-word">
              COOKED
            </div>

            <span className="share-status">
              {cookedLabel(result.score)}
            </span>

            <div className="share-context">
              <span>PRIMARY DAMAGE</span>

              <strong>
                {reasonLabel(result.reason)}
              </strong>

              <span>MAJOR</span>

              <strong>
                {result.program.name}
              </strong>
            </div>

            <div className="share-divider" />

            <div className="share-gt-block">
              <span>GT TODAY</span>

              <strong>
                {resultCampusScore === null
                  ? "---"
                  : `${resultCampusScore}% COOKED`}
              </strong>

              <small>
                {campusCount} CHECK-IN
                {campusCount === 1 ? "" : "S"}{" "}
                TODAY
              </small>
            </div>

            <div className="share-card-footer">
              HOW COOKED ARE YOU?
            </div>
          </div>

          <button
            type="button"
            className="arcade-main-button share-score-button"
            onClick={openShareMenu}
            disabled={sharing}
          >
            SHARE SCORE
          </button>
        </section>

        {/* ====================================
            HIDDEN 1080 x 1920 STORY CARD
        ==================================== */}

        <div className="story-export-stage">
          <div
            ref={storyCardRef}
            className="story-export-card"
          >
            <div className="story-export-header">
              <span>COOKED @ GT</span>
              <span>PLAYER 1</span>
            </div>

            <div className="story-export-main">
              <div className="story-export-hero">
                <p>YOU&apos;RE</p>

                <strong>
                  {Math.round(result.score)}%
                </strong>

                <h2>COOKED</h2>

                <span>
                  {cookedLabel(result.score)}
                </span>
              </div>

              <div className="story-export-context">
                <span>PRIMARY DAMAGE</span>

                <strong className="story-export-damage">
                  {reasonLabel(result.reason)}
                </strong>

                <div className="story-export-context-line" />

                <span>MAJOR</span>

                <strong className="story-export-major">
                  {result.program.name}
                </strong>
              </div>

              <div className="story-export-divider" />

              <div className="story-export-gt-panel">
                <span>GT TODAY</span>

                <strong>
                  {resultCampusScore === null
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
                PLAY NOW ↓
              </span>

              <b>{siteHost}</b>

              <small>
                NOT AFFILIATED WITH GEORGIA TECH
              </small>
            </div>
          </div>
        </div>

        {notice && (
          <div className="system-notice">
            {notice}
          </div>
        )}

        {error && (
          <div className="system-error">
            ERROR: {error}
          </div>
        )}

        {/* ====================================
            SHARE MODAL
        ==================================== */}

        {shareMenuOpen && (
          <div
            className="share-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShareMenuOpen(false);
              }
            }}
          >
            <div className="share-modal">
              <div className="share-modal-header">
                <div>
                  <small>
                    SYSTEM / SHARE MODULE
                  </small>

                  <strong>
                    SHARE SCORE
                  </strong>
                </div>

                <button
                  type="button"
                  className="share-modal-close"
                  onClick={() =>
                    setShareMenuOpen(false)
                  }
                  disabled={sharing}
                >
                  X
                </button>
              </div>

              <div className="share-modal-preview">
                <span>PLAYER SCORE</span>

                <strong>
                  {Math.round(result.score)}%
                </strong>

                <p>
                  {cookedLabel(result.score)}
                </p>
              </div>

              <div className="share-modal-options">
                {/* INSTAGRAM */}

                <button
                  type="button"
                  className="share-option instagram"
                  onClick={shareToInstagram}
                  disabled={
                    sharing ||
                    preparingStory ||
                    !preparedStory
                  }
                >
                  <span className="share-option-icon">
                    ◎
                  </span>

                  <div>
                    <strong>
                      {preparingStory
                        ? "PREPARING STORY..."
                        : "INSTAGRAM STORY"}
                    </strong>

                    <small>
                      {preparingStory
                        ? "RENDERING 1080 × 1920"
                        : "CHOOSE INSTAGRAM IN SHARE SHEET"}
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>

                {/* SHARE LINK */}

                <button
                  type="button"
                  className="share-option link"
                  onClick={shareLink}
                  disabled={sharing}
                >
                  <span className="share-option-icon">
                    ↗
                  </span>

                  <div>
                    <strong>
                      SHARE LINK
                    </strong>

                    <small>
                      CHALLENGE YOUR FRIENDS
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>

                {/* SAVE IMAGE */}

                <button
                  type="button"
                  className="share-option save"
                  onClick={saveScoreImage}
                  disabled={
                    sharing ||
                    preparingStory ||
                    !preparedStory
                  }
                >
                  <span className="share-option-icon">
                    ↓
                  </span>

                  <div>
                    <strong>
                      {preparingStory
                        ? "PREPARING..."
                        : "SAVE IMAGE"}
                    </strong>

                    <small>
                      1080 × 1920 STORY PNG
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>

                {/* COPY LINK */}

                <button
                  type="button"
                  className="share-option copy"
                  onClick={copyLink}
                  disabled={sharing}
                >
                  <span className="share-option-icon">
                    ⧉
                  </span>

                  <div>
                    <strong>
                      COPY LINK
                    </strong>

                    <small>
                      COPY GAME URL
                    </small>
                  </div>

                  <span className="share-option-arrow">
                    &gt;
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="share-cancel-button"
                onClick={() =>
                  setShareMenuOpen(false)
                }
                disabled={sharing}
              >
                CANCEL
              </button>

              <p className="share-modal-hint">
                ★ FOR INSTAGRAM, USE SAFARI ON
                IPHONE ★
              </p>
            </div>
          </div>
        )}

        <footer className="arcade-footer">
          <span>
            COOKED @ GT / 2026
          </span>

          <span>
            NOT AFFILIATED WITH GEORGIA TECH
          </span>
        </footer>
      </main>
    );
  }

  /*
   * ============================================
   * INTRO SCREEN
   * ============================================
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
            <span>HI-SCORE</span>

            <strong>
              {campusScore === null
                ? "---"
                : padScore(campusScore)}
            </strong>
          </div>

          <div>
            <span>PLAYERS</span>

            <strong>
              {String(campusCount).padStart(
                3,
                "0"
              )}
            </strong>
          </div>
        </div>

        <section className="intro-hero">
          <p className="green-label">
            PLAYER 1 / DAILY CHECK-IN
          </p>

          <h1>
            HOW COOKED
            <br />
            ARE YOU?
          </h1>

          <p className="intro-copy">
            GEORGIA TECH&apos;S UNOFFICIAL
            <br />
            DAILY DAMAGE REPORT
          </p>

          <button
            type="button"
            className="arcade-main-button"
            onClick={() =>
              setScreen("checkin")
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
   * ============================================
   * CHECK-IN SCREEN
   * ============================================
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
          <span>GT SCORE</span>

          <strong>
            {campusScore === null
              ? "---"
              : padScore(campusScore)}
          </strong>
        </div>

        <div>
          <span>PLAYERS</span>

          <strong>
            {String(campusCount).padStart(
              3,
              "0"
            )}
          </strong>
        </div>
      </div>

      <section className="checkin-hero">
        <p className="green-label">
          STAGE 01 / COOK-O-METER
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
            onChange={(event) =>
              setScore(
                Number(event.target.value)
              )
            }
          />

          <div className="slider-labels">
            <span>CHILLING</span>
            <span>COOKED</span>
          </div>
        </div>

        <div className="status-window">
          <span>SYSTEM STATUS</span>

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
          {REASONS.map((item) => {
            const selected =
              item.value === reason;

            return (
              <button
                type="button"
                key={item.value}
                className={
                  selected
                    ? "damage-option selected"
                    : "damage-option"
                }
                onClick={() =>
                  setReason(item.value)
                }
              >
                <span className="selector">
                  {selected ? "▶" : " "}
                </span>

                <span>
                  {item.label}
                </span>

                <small>
                  {item.code}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="arcade-section">
        <div className="section-heading yellow-heading">
          {academicLevel === "undergraduate"
            ? "SELECT YOUR MAJOR"
            : "SELECT YOUR PROGRAM"}
        </div>

        <div className="level-tabs">
          <button
            type="button"
            className={
              academicLevel === "undergraduate"
                ? "active"
                : ""
            }
            onClick={() =>
              changeLevel("undergraduate")
            }
          >
            UNDERGRAD
          </button>

          <button
            type="button"
            className={
              academicLevel === "graduate"
                ? "active"
                : ""
            }
            onClick={() =>
              changeLevel("graduate")
            }
          >
            GRAD
          </button>
        </div>

        <button
          type="button"
          className="program-select-button"
          onClick={() =>
            setProgramPickerOpen(true)
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
          type="button"
          className="arcade-main-button checkin-button"
          onClick={submitCheckin}
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
          ★ ONE PLAY PER DAY / ATLANTA TIME ★
        </p>
      </section>

      <footer className="arcade-footer">
        <span>
          COOKED @ GT / 2026
        </span>

        <span>
          NOT AFFILIATED WITH GEORGIA TECH
        </span>
      </footer>

      {programPickerOpen && (
        <div
          className="program-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setProgramPickerOpen(false);
            }
          }}
        >
          <div className="program-modal">
            <div className="program-modal-header">
              <div>
                <small>
                  DATABASE / GT PROGRAMS
                </small>

                <strong>
                  {academicLevel ===
                  "undergraduate"
                    ? "SELECT MAJOR"
                    : "SELECT PROGRAM"}
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setProgramPickerOpen(false)
                }
              >
                X
              </button>
            </div>

            <div className="program-search-wrap">
              <span>&gt;</span>

              <input
                autoFocus
                value={programSearch}
                onChange={(event) =>
                  setProgramSearch(
                    event.target.value
                  )
                }
                placeholder="TYPE TO SEARCH..."
              />
            </div>

            <div className="program-list">
              {filteredPrograms.map(
                (program) => (
                  <button
                    type="button"
                    key={program.id}
                    onClick={() => {
                      setSelectedProgramId(
                        program.id
                      );

                      localStorage.setItem(
                        "cooked_program_id",
                        String(program.id)
                      );

                      setProgramSearch("");
                      setError(null);

                      setProgramPickerOpen(
                        false
                      );
                    }}
                  >
                    <span>
                      {program.name}
                    </span>

                    <strong>
                      {program.degree}
                    </strong>
                  </button>
                )
              )}

              {!filteredPrograms.length && (
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