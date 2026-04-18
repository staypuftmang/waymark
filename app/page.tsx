"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { track } from "@vercel/analytics";
import { Photo, VisualStyleKey, WordStyleKey, LayoutKey, Mode } from "@/app/lib/types";
import { VS, WS, LO, formatDate, cleanJson } from "@/app/lib/constants";
import { quickCreatePrompt } from "@/app/lib/prompts";
import { aiCall, setFallbackListener, setRateLimitListener } from "@/app/lib/ai";
import { saveState, loadState, clearState, SavedState } from "@/app/lib/storage";
import { compressImage } from "@/app/lib/compress";
import DatePicker from "@/app/components/DatePicker";
import PhotoCard from "@/app/components/PhotoCard";
import PhotoStyleRow from "@/app/components/PhotoStyleRow";
import StylePreview from "@/app/components/StylePreview";
import RewriteAll from "@/app/components/RewriteAll";
import JournalPreview from "@/app/components/JournalPreview";
import HelperText from "@/app/components/HelperText";
import CoverEditor from "@/app/components/CoverEditor";

/* ── Shared inline styles ── */
const iStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  fontSize: 14,
  fontFamily: "var(--font-body)",
  background: "var(--color-card)",
  outline: "none",
  color: "var(--color-ink)",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  border: "none",
  borderRadius: 5,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  background: "var(--color-ink)",
  color: "var(--color-paper)",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "none",
  color: "var(--color-ink)",
  border: "1px solid var(--color-border)",
};

/* ── Header ── */
function Header({ children, right, onLogoClick }: { children?: React.ReactNode; right?: React.ReactNode; onLogoClick?: () => void }) {
  return (
    <div
      className="sticky top-0 z-[100] flex items-center justify-between"
      style={{ background: "var(--color-ink)", padding: "16px 24px" }}
    >
      <button
        onClick={onLogoClick}
        className="font-title bg-transparent border-none cursor-pointer"
        style={{
          fontSize: 15,
          fontWeight: 400,
          color: "var(--color-paper)",
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.9,
          padding: 0,
        }}
      >
        Waymark
      </button>
      {right || null}
      {children || null}
    </div>
  );
}

function HeaderBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border-none cursor-pointer text-warm font-body"
      style={{ fontSize: 12, fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

/* ── Main App ── */
export default function Page() {
  const [mode, setMode] = useState<Mode>(null);
  const [step, setStep] = useState(0);
  const [tripTitle, setTripTitle] = useState("");
  const [tripBrief, setTripBrief] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [vk, setVk] = useState<VisualStyleKey>("editorial");
  const [ws, setWs] = useState<WordStyleKey>("poetic");
  const [lo, setLo] = useState<LayoutKey>("classic");
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [savedJournal, setSavedJournal] = useState<SavedState | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; current: number; total: number }>({ active: false, current: 0, total: 0 });
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [showPhotoLimitWarning, setShowPhotoLimitWarning] = useState<{ files: File[]; count: number } | null>(null);
  // Cover photo state
  const [coverPhotoId, setCoverPhotoId] = useState<number | null>(null);
  const [coverTitle, setCoverTitle] = useState<string>("");
  const [coverSubtitle, setCoverSubtitle] = useState<string>("");
  const [coverTitleEdited, setCoverTitleEdited] = useState(false);

  const fullRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load saved state on mount + register fallback + rate-limit listeners ──
  useEffect(() => {
    setFallbackListener(() => {
      setToast("AI model busy — using faster fallback model");
      setTimeout(() => setToast(null), 5000);
    });
    setRateLimitListener((msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 10000);
    });
    loadState().then((saved) => {
      if (saved && saved.tripTitle) {
        setSavedJournal(saved);
        setShowResumePrompt(true);
      }
      setAppReady(true);
    });
  }, []);

  // ── Track journal_completed when reaching the preview page ──
  useEffect(() => {
    if (step === 99 && photos.length > 0) {
      track("journal_completed", {
        visualStyle: vk,
        layout: lo,
        wordStyle: ws,
        photoCount: photos.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Auto-save with 2s debounce ──
  useEffect(() => {
    if (!appReady || mode === null) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const state: SavedState = {
        mode: mode as "quick" | "full",
        step,
        tripTitle,
        tripBrief,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        visualStyleKey: vk,
        wordStyle: ws,
        layoutKey: lo,
        photos,
        coverPhotoId,
        coverTitle,
        coverSubtitle,
        coverTitleEdited,
      };
      saveState(state);
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [appReady, mode, step, tripTitle, tripBrief, startDate, endDate, vk, ws, lo, photos, coverPhotoId, coverTitle, coverSubtitle, coverTitleEdited]);

  const resumeJournal = () => {
    if (!savedJournal) return;
    setMode(savedJournal.mode);
    setStep(savedJournal.step);
    setTripTitle(savedJournal.tripTitle);
    setTripBrief(savedJournal.tripBrief);
    setStartDate(savedJournal.startDate ? new Date(savedJournal.startDate) : null);
    setEndDate(savedJournal.endDate ? new Date(savedJournal.endDate) : null);
    setVk(savedJournal.visualStyleKey as VisualStyleKey);
    setWs(savedJournal.wordStyle as WordStyleKey);
    setLo(savedJournal.layoutKey as LayoutKey);
    setPhotos(savedJournal.photos);
    setCoverPhotoId(savedJournal.coverPhotoId ?? null);
    setCoverTitle(savedJournal.coverTitle ?? "");
    setCoverSubtitle(savedJournal.coverSubtitle ?? "");
    setCoverTitleEdited(savedJournal.coverTitleEdited ?? false);
    setShowResumePrompt(false);
    setSavedJournal(null);
  };

  const startFresh = () => {
    setConfirmAction(() => () => {
      clearState();
      setSavedJournal(null);
      setShowResumePrompt(false);
    });
  };

  const validImageTypes = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter((f) => validImageTypes.includes(f.type));
    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      setUploadErrors((prev) => [...prev, `${invalidCount} file${invalidCount > 1 ? "s" : ""} skipped (not images)`]);
    }

    setUploadProgress({ active: true, current: 0, total: validFiles.length });
    const errors: string[] = [];

    // Process sequentially to avoid memory spikes from parallel canvas operations
    for (let i = 0; i < validFiles.length; i++) {
      setUploadProgress({ active: true, current: i + 1, total: validFiles.length });
      try {
        const src = await compressImage(validFiles[i]);
        setPhotos((p) => [
          ...p,
          {
            id: Date.now() + Math.random(),
            src,
            caption: "",
            notes: "",
            paragraph: "",
            aiCaption: "",
            aiNotes: "",
            aiParagraph: "",
          },
        ]);
      } catch {
        errors.push(validFiles[i].name);
      }
    }

    setUploadProgress({ active: false, current: 0, total: 0 });
    if (errors.length > 0) {
      setUploadErrors((prev) => [...prev, `${errors.length} photo${errors.length > 1 ? "s" : ""} couldn't be processed`]);
    }
    const successCount = validFiles.length - errors.length;
    if (successCount > 0) {
      track("photos_uploaded", { count: successCount });
    }
  }, []);

  const addPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploadErrors([]);

    // Hard warning at 30+ total photos
    if (files.length + photos.length > 30) {
      setShowPhotoLimitWarning({ files, count: files.length + photos.length });
      return;
    }

    // Soft warning at 20+
    if (files.length + photos.length > 20) {
      setToast("For best results, we recommend 20 photos or fewer.");
      setTimeout(() => setToast(null), 5000);
    }

    processFiles(files);
  }, [photos.length, processFiles]);

  const updatePhoto = (id: number, field: string, value: string) =>
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const removePhoto = (id: number) => {
    setPhotos((p) => p.filter((x) => x.id !== id));
    // Clear cover selection if the cover photo is deleted (keep title/subtitle)
    if (coverPhotoId === id) setCoverPhotoId(null);
  };

  const toggleCover = (id: number) => {
    setCoverPhotoId((current) => (current === id ? null : id));
  };

  // Auto-sync coverTitle ← tripTitle until user manually edits coverTitle
  useEffect(() => {
    if (!coverTitleEdited) {
      setCoverTitle(tripTitle);
    }
  }, [tripTitle, coverTitleEdited]);

  const updateCoverTitle = (value: string) => {
    setCoverTitle(value);
    setCoverTitleEdited(true);
  };

  const movePhoto = (id: number, dir: number) =>
    setPhotos((p) => {
      const i = p.findIndex((x) => x.id === id);
      if ((dir === -1 && i === 0) || (dir === 1 && i === p.length - 1)) return p;
      const c = [...p];
      [c[i], c[i + dir]] = [c[i + dir], c[i]];
      return c;
    });

  const doReset = () => {
    clearState();
    setMode(null);
    setStep(0);
    setPhotos([]);
    setTripTitle("");
    setTripBrief("");
    setStartDate(null);
    setEndDate(null);
    setCoverPhotoId(null);
    setCoverTitle("");
    setCoverSubtitle("");
    setCoverTitleEdited(false);
  };

  const reset = () => {
    // If user has started working, confirm before discarding
    if (tripTitle || photos.length > 0) {
      setConfirmAction(() => doReset);
    } else {
      doReset();
    }
  };

  const dateDisplay = startDate
    ? endDate
      ? `${formatDate(startDate)} \u2014 ${formatDate(endDate)}`
      : formatDate(startDate)
    : "";

  const ok = tripTitle.trim() && photos.length > 0;

  const quickGenerate = async () => {
    setQuickGenerating(true);
    setGenProgress({ current: 0, total: photos.length });
    track("ai_generated", { mode: "quick", photoCount: photos.length, wordStyle: ws, visualStyle: vk });
    const previousCaptions: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      setGenProgress({ current: i + 1, total: photos.length });
      const p = photos[i];
      const prompt = quickCreatePrompt(ws, tripTitle, tripBrief, dateDisplay, i, photos.length, previousCaptions);

      const raw = await aiCall(prompt, p.src);
      if (raw) {
        try {
          const obj = JSON.parse(cleanJson(raw));
          if (obj.caption) { updatePhoto(p.id, "aiCaption", obj.caption); previousCaptions.push(obj.caption); }
          if (obj.notes) updatePhoto(p.id, "aiNotes", obj.notes);
          if (obj.paragraph) updatePhoto(p.id, "aiParagraph", obj.paragraph);
        } catch (e) {
          console.error(e);
        }
      }
    }
    setQuickGenerating(false);
    setGenProgress(null);
    setStep(10);
  };

  const contentStyle: React.CSSProperties = { maxWidth: 680, margin: "0 auto", padding: "32px 20px 120px" };
  const h2Style: React.CSSProperties = {
    fontFamily: "var(--font-title)",
    fontSize: 28,
    fontWeight: 300,
    color: "var(--color-ink)",
    marginBottom: 4,
  };
  const subStyle: React.CSSProperties = { fontSize: 14, color: "var(--color-stone)", marginBottom: 28, lineHeight: 1.5 };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "var(--color-stone)",
    marginBottom: 6,
  };
  const dropStyle: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: 5,
    padding: "32px 20px",
    textAlign: "center",
    cursor: "pointer",
    background: "var(--color-card)",
  };
  const chip = (sel: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 3,
    border: sel ? "1.5px solid var(--color-accent)" : "1px solid var(--color-border)",
    background: sel ? "rgba(154,52,18,.06)" : "var(--color-card)",
    fontSize: 11,
    fontWeight: sel ? 700 : 400,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    color: "var(--color-ink)",
  });

  if (!appReady) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="min-h-screen bg-paper font-body">

      {/* ═══════════════ TOAST ═══════════════ */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 z-[500] font-body"
          style={{
            transform: "translateX(-50%)",
            background: "var(--color-ink)",
            color: "var(--color-paper)",
            padding: "10px 20px",
            borderRadius: 5,
            fontSize: 13,
            boxShadow: "0 4px 20px rgba(0,0,0,.2)",
          }}
        >
          {toast}
        </div>
      )}

      {/* ═══════════════ PHOTO LIMIT WARNING ═══════════════ */}
      {showPhotoLimitWarning && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "rgba(26,24,21,.6)" }}>
          <div className="bg-card" style={{ borderRadius: 5, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.2)", textAlign: "center" }}>
            <div className="font-title" style={{ fontSize: 20, fontWeight: 300, color: "var(--color-ink)", marginBottom: 8 }}>
              That's a lot of photos
            </div>
            <p className="text-stone" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Uploading {showPhotoLimitWarning.count} photos may cause performance issues. We recommend selecting your 15–20 best photos for the best journal.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowPhotoLimitWarning(null)} style={{ ...btnSecondary, fontSize: 13 }}>Select fewer</button>
              <button onClick={() => { processFiles(showPhotoLimitWarning.files); setShowPhotoLimitWarning(null); }} style={{ ...btnPrimary, background: "var(--color-accent)", color: "#fff", fontSize: 13 }}>Continue anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ UPLOAD PROGRESS ═══════════════ */}
      {uploadProgress.active && (
        <div
          className="fixed top-4 left-1/2 z-[500] font-body"
          style={{
            transform: "translateX(-50%)",
            background: "var(--color-ink)",
            color: "var(--color-paper)",
            padding: "12px 24px",
            borderRadius: 5,
            fontSize: 13,
            boxShadow: "0 4px 20px rgba(0,0,0,.2)",
            minWidth: 240,
          }}
        >
          <div style={{ marginBottom: 6 }}>Processing photos... {uploadProgress.current} of {uploadProgress.total}</div>
          <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,.2)", borderRadius: 2 }}>
            <div style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 2, transition: "width .3s" }} />
          </div>
        </div>
      )}

      {/* ═══════════════ GENERATION OVERLAY ═══════════════ */}
      {quickGenerating && genProgress && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ background: "rgba(26,24,21,.7)" }}>
          <div className="bg-card text-center" style={{ borderRadius: 5, padding: "40px 36px", maxWidth: 360, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.25)" }}>
            <div className="font-title" style={{ fontSize: 22, fontWeight: 300, color: "var(--color-ink)", marginBottom: 12 }}>
              Writing your journal
            </div>
            <div className="text-stone" style={{ fontSize: 13, marginBottom: 20 }}>
              Crafting photo {genProgress.current} of {genProgress.total}
            </div>
            <div className="flex justify-center gap-2" style={{ marginBottom: 20 }}>
              <span className="generating-dot" />
              <span className="generating-dot" />
              <span className="generating-dot" />
            </div>
            <div style={{ width: "100%", height: 3, background: "var(--color-border)", borderRadius: 2 }}>
              <div style={{ width: `${(genProgress.current / genProgress.total) * 100}%`, height: "100%", background: "var(--color-accent)", borderRadius: 2, transition: "width .5s ease" }} />
            </div>
            <div className="text-warm" style={{ fontSize: 11, marginTop: 12 }}>
              This may take a moment per photo
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RESUME PROMPT ═══════════════ */}
      {showResumePrompt && savedJournal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "rgba(26,24,21,.6)" }}>
          <div className="bg-card" style={{ borderRadius: 5, padding: "32px 28px", maxWidth: 400, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.2)", textAlign: "center" }}>
            <div className="font-title" style={{ fontSize: 24, fontWeight: 300, color: "var(--color-ink)", marginBottom: 8 }}>
              Welcome back
            </div>
            <p className="text-stone" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              You have an unfinished journal: <strong className="text-ink">{savedJournal.tripTitle}</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={startFresh} style={{ ...btnSecondary, fontSize: 13 }}>Start Fresh</button>
              <button onClick={resumeJournal} style={{ ...btnPrimary, background: "var(--color-accent)", color: "#fff", fontSize: 13 }}>Resume</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CONFIRM DIALOG ═══════════════ */}
      {confirmAction && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "rgba(26,24,21,.6)" }}>
          <div className="bg-card" style={{ borderRadius: 5, padding: "28px 24px", maxWidth: 380, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.2)", textAlign: "center" }}>
            <div className="font-title" style={{ fontSize: 20, fontWeight: 300, color: "var(--color-ink)", marginBottom: 8 }}>
              Discard journal?
            </div>
            <p className="text-stone" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              This will discard your current journal. Are you sure?
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmAction(null)} style={{ ...btnSecondary, fontSize: 13 }}>Cancel</button>
              <button onClick={() => { confirmAction(); setConfirmAction(null); }} style={{ ...btnPrimary, background: "var(--color-accent)", color: "#fff", fontSize: 13 }}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ LANDING ═══════════════ */}
      {mode === null && (
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 flex items-center justify-center" style={{ padding: "0 28px 40px" }}>
            <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
              {/* Masthead logo */}
              <div
                className="font-title animate-fade-up"
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "var(--color-ink)",
                  marginBottom: 40,
                  paddingTop: 20,
                }}
              >
Waymark
              </div>

              <div
                className="animate-fade-up"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 3,
                  color: "var(--color-accent)",
                  marginBottom: 16,
                }}
              >
                Travel journals, beautifully told
              </div>
              <h1
                className="font-title animate-fade-up-1"
                style={{
                  fontSize: 42,
                  fontWeight: 300,
                  color: "var(--color-ink)",
                  lineHeight: 1.2,
                  marginBottom: 20,
                  letterSpacing: -0.5,
                }}
              >
                Mark the moments that moved you.
              </h1>
              <p
                className="animate-fade-up-2"
                style={{
                  fontSize: 15,
                  color: "var(--color-stone)",
                  lineHeight: 1.7,
                  marginBottom: 36,
                  maxWidth: 400,
                  margin: "0 auto 36px",
                }}
              >
                Upload your photos, tell your story, and let AI help you craft a journal worth keeping.
              </p>

              <div className="flex flex-col gap-2.5 animate-fade-up-3" style={{ maxWidth: 420, margin: "0 auto" }}>
                {[
                  { m: "quick" as const, icon: "\u26A1", bg: "var(--color-accent)", t: "Quick Create", d: "Drop photos + story. AI does the rest." },
                  { m: "full" as const, icon: "\u270E", bg: "var(--color-ink)", t: "Full Builder", d: "Craft every detail yourself or with AI assistance." },
                ].map(({ m, icon, bg, t, d }) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setStep(0); track("journal_started", { mode: m }); }}
                    className="flex items-center gap-3.5 border border-border bg-card cursor-pointer text-left w-full"
                    style={{ padding: "16px 20px", borderRadius: 5 }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 3,
                        background: bg,
                        color: bg === "var(--color-ink)" ? "var(--color-paper)" : "#fff",
                        fontSize: 16,
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="text-ink font-semibold" style={{ fontSize: 14, marginBottom: 1 }}>{t}</div>
                      <div className="text-stone" style={{ fontSize: 12 }}>{d}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--color-border)", textAlign: "center" }}>
            <div className="text-warm uppercase" style={{ fontSize: 10, letterSpacing: 1.5 }}>
              Waymark &middot; 2026
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ QUICK CREATE ═══════════════ */}
      {mode === "quick" && step === 0 && (
        <div>
          <Header onLogoClick={reset} right={<HeaderBtn onClick={reset}>&#x2190; Home</HeaderBtn>} />
          <div style={contentStyle}>
            <h2 style={h2Style}>Quick Create</h2>
            <p style={subStyle}>Drop photos, tell your story, pick a style. AI writes the journal.</p>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Trip Title</label>
              <input style={iStyle} placeholder="e.g. Two Weeks in Patagonia" value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} />
              <HelperText>This becomes the headline of your journal.</HelperText>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Timeframe</label>
              <DatePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
              <HelperText>Optional — displayed at the top of your journal.</HelperText>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Your Story</label>
              <textarea
                style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
                placeholder="What made this trip special? The people, the food, the unexpected moments..."
                value={tripBrief}
                onChange={(e) => setTripBrief(e.target.value)}
              />
              <HelperText>The AI uses this as inspiration to write unique content for each photo. This text also appears as the opening paragraph of your journal.</HelperText>
            </div>

            <div style={dropStyle} onClick={() => quickRef.current?.click()}>
              <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.4 }}>&#x2191;</div>
              <div className="font-semibold text-ink" style={{ fontSize: 13 }}>Upload photos</div>
              <HelperText>Best with 5–20 photos. Add the moments that mattered most.</HelperText>
              <input ref={quickRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
            </div>

            {photos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="text-ink font-semibold" style={{ fontSize: 13, marginBottom: 4 }}>
                  {photos.length} photo{photos.length > 1 ? "s" : ""} added
                </div>
                {uploadErrors.length > 0 && (
                  <div className="text-stone" style={{ fontSize: 12, marginBottom: 6 }}>
                    {uploadErrors.join(". ")}
                  </div>
                )}
                <div className="flex gap-1 flex-wrap">
                  {photos.map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.src} className="object-cover" style={{ width: 52, height: 52, borderRadius: 3 }} alt="" />
                      <button
                        onClick={() => removePhoto(p.id)}
                        className="absolute flex items-center justify-center bg-accent text-white border-none cursor-pointer"
                        style={{ top: -3, right: -3, width: 16, height: 16, borderRadius: 2, fontSize: 9 }}
                      >
                        &#x00D7;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4" style={{ marginTop: 24 }}>
              <div>
                <label style={labelStyle}>Visual</label>
                <HelperText>Sets the look — fonts, colors, and mood.</HelperText>
                <div className="flex gap-1 flex-wrap" style={{ marginTop: 6 }}>
                  {(Object.entries(VS) as [VisualStyleKey, typeof VS[VisualStyleKey]][]).map(([k, s]) => (
                    <button key={k} onClick={() => { setVk(k); track("style_selected", { style: k }); }} style={chip(vk === k)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Voice</label>
                <HelperText>Sets the writing style the AI uses.</HelperText>
                <div className="flex gap-1 flex-wrap" style={{ marginTop: 6 }}>
                  {(Object.entries(WS) as [WordStyleKey, typeof WS[WordStyleKey]][]).map(([k, w]) => (
                    <button key={k} onClick={() => setWs(k)} style={chip(ws === k)}>{w.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 16, marginBottom: 4 }}>Layout</label>
            <HelperText>How your photos are arranged in the journal.</HelperText>
            <div className="grid grid-cols-5 gap-1.5" style={{ marginTop: 8 }}>
              {(Object.entries(LO) as [LayoutKey, typeof LO[LayoutKey]][]).map(([k, l]) => (
                <div
                  key={k}
                  onClick={() => { setLo(k); track("layout_selected", { layout: k }); }}
                  className="text-center cursor-pointer"
                  style={{
                    padding: "10px 4px",
                    borderRadius: 3,
                    border: lo === k ? "1.5px solid var(--color-accent)" : "1px solid var(--color-border)",
                    background: lo === k ? "rgba(154,52,18,.06)" : "var(--color-card)",
                  }}
                >
                  <div
                    className="mx-auto"
                    style={{
                      width: 30,
                      height: 30,
                      marginBottom: 3,
                      color: lo === k ? "var(--color-accent)" : "var(--color-stone)",
                    }}
                    dangerouslySetInnerHTML={{ __html: l.icon }}
                  />
                  <div className="font-semibold" style={{ fontSize: 9 }}>{l.label}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end" style={{ marginTop: 36 }}>
              <button
                style={{
                  ...btnPrimary,
                  opacity: ok && tripBrief.trim() && !quickGenerating ? 1 : 0.5,
                  cursor: ok && tripBrief.trim() && !quickGenerating ? "pointer" : "not-allowed",
                }}
                disabled={!ok || !tripBrief.trim() || quickGenerating}
                onClick={quickGenerate}
              >
                {quickGenerating ? "Writing journal\u2026" : "Generate Journal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ QUICK REVIEW ═══════════════ */}
      {mode === "quick" && step === 10 && (
        <div>
          <Header onLogoClick={reset} right={<HeaderBtn onClick={() => setStep(0)}>&#x2190; Back</HeaderBtn>} />
          <div style={contentStyle}>
            <h2 style={h2Style}>Review & Refine</h2>
            <p style={subStyle}>AI has written your journal. Review, edit, or regenerate below.</p>

            <CoverEditor
              photos={photos}
              coverPhotoId={coverPhotoId}
              coverTitle={coverTitle}
              coverSubtitle={coverSubtitle}
              onRemoveCover={() => setCoverPhotoId(null)}
              onUpdateCoverTitle={updateCoverTitle}
              onUpdateCoverSubtitle={setCoverSubtitle}
            />

            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
              <RewriteAll photos={photos} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} visualStyle={vk} dateDisplay={dateDisplay} />
            </div>

            <div className="grid gap-2" style={{ marginBottom: 14 }}>
              {photos.map((p) => (
                <PhotoStyleRow key={p.id} photo={p} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} isCover={coverPhotoId === p.id} onToggleCover={toggleCover} />
              ))}
            </div>

            <div className="flex justify-between" style={{ marginTop: 36 }}>
              <button style={btnSecondary} onClick={() => setStep(0)}>&#x2190; Back</button>
              <button style={btnPrimary} onClick={() => setStep(99)}>View Journal &#x2192;</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ FULL BUILDER — STEP INDICATOR ═══════════════ */}
      {mode === "full" && step < 3 && (
        <Header onLogoClick={reset}>
          <div className="flex gap-0.5">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className="cursor-pointer"
                style={{
                  width: s === step ? 36 : 24,
                  height: 3,
                  borderRadius: 1,
                  background: s === step ? "var(--color-paper)" : s < step ? "var(--color-accent)" : "#333",
                  transition: "all .3s",
                }}
                onClick={() => s <= step && setStep(s)}
              />
            ))}
          </div>
        </Header>
      )}

      {/* ═══════════════ FULL — STEP 0: TRIP DETAILS ═══════════════ */}
      {mode === "full" && step === 0 && (
        <div style={contentStyle}>
          <h2 style={h2Style}>Your Trip</h2>
          <p style={subStyle}>Start with the basics.</p>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Trip Title</label>
            <input style={iStyle} placeholder="e.g. Two Weeks in Patagonia" value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} />
            <HelperText>This becomes the headline of your journal.</HelperText>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Timeframe</label>
            <DatePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
            <HelperText>Optional — displayed at the top of your journal.</HelperText>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Trip Brief</label>
            <textarea
              style={{ ...iStyle, resize: "vertical", minHeight: 100, lineHeight: 1.65 }}
              placeholder="The vibe, what made it special, the story behind the trip..."
              value={tripBrief}
              onChange={(e) => setTripBrief(e.target.value)}
            />
            <HelperText>This appears as the opening paragraph of your journal. The AI also uses it as context when writing about your photos.</HelperText>
          </div>

          <div className="flex justify-between" style={{ marginTop: 36 }}>
            <button style={btnSecondary} onClick={reset}>&#x2190; Home</button>
            <button
              style={{
                ...btnPrimary,
                opacity: tripTitle.trim() ? 1 : 0.5,
                cursor: tripTitle.trim() ? "pointer" : "not-allowed",
              }}
              disabled={!tripTitle.trim()}
              onClick={() => setStep(1)}
            >
              Photos &#x2192;
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ FULL — STEP 1: PHOTOS & NOTES ═══════════════ */}
      {mode === "full" && step === 1 && (
        <div style={contentStyle}>
          <h2 style={h2Style}>Photos & Notes</h2>
          <p style={subStyle}>Upload photos, write captions and notes.</p>

          <div style={dropStyle} onClick={() => fullRef.current?.click()}>
            <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.4 }}>&#x2191;</div>
            <div className="font-semibold text-ink" style={{ fontSize: 13 }}>Upload photos</div>
            <HelperText>Best with 5–20 photos.</HelperText>
            <input ref={fullRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
          </div>

          {photos.length > 0 && (
            <div className="text-ink font-semibold" style={{ fontSize: 13, marginTop: 12, marginBottom: 12 }}>
              {photos.length} photo{photos.length > 1 ? "s" : ""} added
            </div>
          )}

          <CoverEditor
            photos={photos}
            coverPhotoId={coverPhotoId}
            coverTitle={coverTitle}
            coverSubtitle={coverSubtitle}
            onRemoveCover={() => setCoverPhotoId(null)}
            onUpdateCoverTitle={updateCoverTitle}
            onUpdateCoverSubtitle={setCoverSubtitle}
          />

          <div className="grid gap-2.5" style={{ marginTop: 12 }}>
            {photos.map((p, i) => (
              <PhotoCard
                key={p.id}
                photo={p}
                index={i}
                total={photos.length}
                onUpdate={updatePhoto}
                onMove={movePhoto}
                onRemove={removePhoto}
                title={tripTitle}
                brief={tripBrief}
                wordStyle={ws}
                dateDisplay={dateDisplay}
                isCover={coverPhotoId === p.id}
                onToggleCover={toggleCover}
              />
            ))}
          </div>

          <div className="flex justify-between" style={{ marginTop: 36 }}>
            <button style={btnSecondary} onClick={() => setStep(0)}>&#x2190; Back</button>
            <button
              style={{
                ...btnPrimary,
                opacity: photos.length > 0 ? 1 : 0.5,
                cursor: photos.length > 0 ? "pointer" : "not-allowed",
              }}
              disabled={photos.length === 0}
              onClick={() => setStep(2)}
            >
              Style &#x2192;
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ FULL — STEP 2: STYLE & LAYOUT ═══════════════ */}
      {mode === "full" && step === 2 && (
        <div style={contentStyle}>
          <h2 style={h2Style}>Style & Layout</h2>
          <p style={subStyle}>Choose how your journal looks, reads, and flows.</p>

          <label style={{ ...labelStyle, marginBottom: 8 }}>Visual Style</label>
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", marginBottom: 24 }}
          >
            {(Object.entries(VS) as [VisualStyleKey, typeof VS[VisualStyleKey]][]).map(([k, s]) => (
              <StylePreview key={k} styleKey={k} style={s} selected={vk === k} onClick={() => { setVk(k); track("style_selected", { style: k }); }} />
            ))}
          </div>

          <label style={{ ...labelStyle, marginBottom: 8 }}>Layout</label>
          <div className="grid grid-cols-5 gap-1.5" style={{ marginBottom: 24 }}>
            {(Object.entries(LO) as [LayoutKey, typeof LO[LayoutKey]][]).map(([k, l]) => (
              <div
                key={k}
                onClick={() => setLo(k)}
                className="text-center cursor-pointer"
                style={{
                  padding: "10px 4px",
                  borderRadius: 3,
                  border: lo === k ? "1.5px solid var(--color-accent)" : "1px solid var(--color-border)",
                  background: lo === k ? "rgba(154,52,18,.06)" : "var(--color-card)",
                }}
              >
                <div
                  className="mx-auto"
                  style={{
                    width: 32,
                    height: 32,
                    marginBottom: 4,
                    color: lo === k ? "var(--color-accent)" : "var(--color-stone)",
                  }}
                  dangerouslySetInnerHTML={{ __html: l.icon }}
                />
                <div className="font-semibold" style={{ fontSize: 10 }}>{l.label}</div>
              </div>
            ))}
          </div>

          <label style={{ ...labelStyle, marginBottom: 8 }}>Voice</label>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", marginBottom: 22 }}
          >
            {(Object.entries(WS) as [WordStyleKey, typeof WS[WordStyleKey]][]).map(([k, w]) => (
              <div
                key={k}
                onClick={() => setWs(k)}
                className="cursor-pointer"
                style={{
                  padding: 10,
                  borderRadius: 3,
                  border: ws === k ? "1.5px solid var(--color-accent)" : "1px solid var(--color-border)",
                  background: ws === k ? "rgba(154,52,18,.06)" : "var(--color-card)",
                }}
              >
                <div className="text-ink" style={{ fontSize: 12, fontWeight: ws === k ? 700 : 500 }}>
                  {w.label}
                </div>
              </div>
            ))}
          </div>

          <CoverEditor
            photos={photos}
            coverPhotoId={coverPhotoId}
            coverTitle={coverTitle}
            coverSubtitle={coverSubtitle}
            onRemoveCover={() => setCoverPhotoId(null)}
            onUpdateCoverTitle={updateCoverTitle}
            onUpdateCoverSubtitle={setCoverSubtitle}
          />

          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
            <RewriteAll photos={photos} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} visualStyle={vk} dateDisplay={dateDisplay} />
          </div>
          <HelperText>Regenerates AI writing for all photos. You'll review each one before accepting.</HelperText>
          <div style={{ marginTop: 8 }} />

          <div className="grid gap-2" style={{ marginBottom: 8 }}>
            {photos.map((p) => (
              <PhotoStyleRow key={p.id} photo={p} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} isCover={coverPhotoId === p.id} onToggleCover={toggleCover} />
            ))}
          </div>

          <div className="flex justify-between" style={{ marginTop: 36 }}>
            <button style={btnSecondary} onClick={() => setStep(1)}>&#x2190; Back</button>
            <button
              style={{
                ...btnPrimary,
                opacity: ok ? 1 : 0.5,
                cursor: ok ? "pointer" : "not-allowed",
              }}
              disabled={!ok}
              onClick={() => setStep(99)}
            >
              Generate Journal
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ JOURNAL PREVIEW ═══════════════ */}
      {step === 99 && (
        <JournalPreview
          tripTitle={tripTitle}
          tripBrief={tripBrief}
          dateDisplay={dateDisplay}
          photos={photos}
          visualStyleKey={vk}
          layoutKey={lo}
          onEdit={() => setStep(mode === "quick" ? 10 : 2)}
          onLogoClick={reset}
          setVisualStyleKey={setVk}
          setLayoutKey={setLo}
          coverPhotoId={coverPhotoId}
          coverTitle={coverTitle}
          coverSubtitle={coverSubtitle}
        />
      )}
    </div>
  );
}
