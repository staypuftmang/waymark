"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { Photo, VisualStyleKey, WordStyleKey, LayoutKey, LengthKey, Mode } from "@/app/lib/types";
import { VS, WS, LO, LE, formatDate } from "@/app/lib/constants";
import { tripBriefFromPhotosPrompt } from "@/app/lib/prompts";
import { aiCall, setFallbackListener, setRateLimitListener, setRateStatusListener, setBusyListener, fetchRateStatus } from "@/app/lib/ai";
import { makeThumbnail } from "@/app/lib/compress";
import type { RateLimitErrorInfo, RateLimitStatus } from "@/app/lib/ai";
import { loadState, clearState, SavedState } from "@/app/lib/storage";
import { useUnloadGuard } from "@/app/lib/useUnloadGuard";
import { JournalProvider, useJournal, type SaveStatus } from "@/app/context/JournalContext";
import { useJournalGeneration } from "@/app/context/useJournalGeneration";
import { compressImage } from "@/app/lib/compress";
import DatePicker from "@/app/components/DatePicker";
import PhotoCard from "@/app/components/PhotoCard";
import PhotoStyleRow from "@/app/components/PhotoStyleRow";
import StylePreview from "@/app/components/StylePreview";
import RewriteAll from "@/app/components/RewriteAll";
import JournalPreview from "@/app/components/JournalPreview";
import HelperText from "@/app/components/HelperText";
import { Button, ConfirmModal, Pill, PillGroup, DismissibleBanner } from "@/app/components/ui";
import CoverEditor from "@/app/components/CoverEditor";
// SortablePhotoList pulls in the three @dnd-kit packages — only loaded once
// the editor needs them.
const SortablePhotoList = dynamic(() => import("@/app/components/SortablePhotoList"), {
  ssr: false,
  loading: () => null,
});
import SiteFooter from "@/app/components/SiteFooter";
// AuthModal is only mounted when the user clicks Sign in / Start free.
const AuthModal = dynamic(() => import("@/app/components/AuthModal"), {
  ssr: false,
  loading: () => null,
});
// JournalStatsModal is only mounted when the user clicks the view-count
// chip on a public journal card.
const JournalStatsModal = dynamic(() => import("@/app/components/JournalStatsModal"), {
  ssr: false,
  loading: () => null,
});
// FocalPointPicker is only mounted when the user taps a photo to set the
// crop point — pull it out of the initial bundle.
const FocalPointPicker = dynamic(() => import("@/app/components/FocalPointPicker"), {
  ssr: false,
  loading: () => null,
});
// ColophonEditor only renders when the journal has a colophon, which only
// happens after the first AI generation — keep it out of the initial bundle.
const ColophonEditor = dynamic(() => import("@/app/components/ColophonEditor"), {
  ssr: false,
  loading: () => null,
});
import HeaderAuthControls from "@/app/components/HeaderAuthControls";
import JournalCard from "@/app/components/JournalCard";
import AiButton from "@/app/components/AiButton";
import SignupPromptPanel from "@/app/components/SignupPromptPanel";
import { useAuth } from "@/app/lib/AuthContext";
import {
  loadJournal as loadJournalRemote,
  listJournals as listJournalsRemote,
  deleteJournal as deleteJournalRemote,
  duplicateJournal as duplicateJournalRemote,
  renameJournal as renameJournalRemote,
  getJournalViewCounts,
  type JournalSummary,
} from "@/app/lib/journalStorage";

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

function formatResetIn(seconds: number): string {
  if (!seconds || seconds < 1) return "a moment";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.ceil(seconds / 3600);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/* ── Header ── */

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const text =
    status === "saving" ? "Saving\u2026" :
    status === "saved" ? "Saved \u2713" :
    "Offline";
  return (
    <span
      className="font-body"
      style={{
        fontSize: 11,
        color: "var(--color-warm)",
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Header({
  children,
  back,
  right,
  onLogoClick,
  saveStatus,
  onSignInClick,
  onSignUpClick,
  onYourJournals,
  rateRemainingToday,
}: {
  children?: React.ReactNode;
  /** Slot rendered immediately after the WAYMARK logo. Used for back / home /
   * edit links so navigation is always on the left, mirroring the journal
   * preview header. */
  back?: React.ReactNode;
  right?: React.ReactNode;
  onLogoClick?: () => void;
  saveStatus?: SaveStatus;
  onSignInClick?: () => void;
  onSignUpClick?: () => void;
  onYourJournals?: () => void;
  rateRemainingToday?: number | null;
}) {
  return (
    <div
      className="sticky top-0 z-[100] flex items-center justify-between"
      style={{ background: "var(--color-ink)", padding: "16px 24px", position: "sticky", top: 0 }}
    >
      <div className="flex items-center" style={{ gap: 14 }}>
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
        {back || null}
        {saveStatus && <SaveIndicator status={saveStatus} />}
        {typeof rateRemainingToday === "number" && rateRemainingToday < 10 && (
          <span
            className="font-body"
            style={{
              fontSize: 11,
              color: rateRemainingToday <= 3 ? "var(--color-accent)" : "var(--color-warm)",
              letterSpacing: 0.3,
              whiteSpace: "nowrap",
            }}
            title="AI generations remaining today"
          >
            {rateRemainingToday} left today
          </span>
        )}
      </div>
      {children && (
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "auto",
          }}
        >
          {children}
        </div>
      )}
      <div className="flex items-center" style={{ gap: 8 }}>
        {right || null}
        {(onSignInClick || onSignUpClick) && (
          <HeaderAuthControls
            onSignInClick={onSignInClick ?? (() => {})}
            onSignUpClick={onSignUpClick ?? (() => {})}
            onYourJournals={onYourJournals}
          />
        )}
      </div>
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
  return (
    <JournalProvider>
      <PageInner />
    </JournalProvider>
  );
}

function PageInner() {
  // ── Journal data state lives in the JournalContext reducer. We
  //    destructure into local aliases so the existing JSX/handler call
  //    sites can stay unchanged, then provide setter aliases below that
  //    forward to dispatch. ──
  const { state, dispatch, resetSaveCaches, seedSaveCaches, setOnRefreshJournals } = useJournal();
  const {
    mode, step,
    tripTitle, tripBrief, startDate, endDate,
    photos,
    vk, ws, len, lo,
    genWs, genLen,
    coverPhotoId, coverTitle, coverSubtitle, coverTitleEdited,
    currentJournalId, shareSlug, isPublic,
    saveStatus, quickGenerating, genProgress,
  } = state;

  // Setter aliases — keep call sites short. Each is a stable callback bound
  // to dispatch.
  const setMode = useCallback((v: Mode) => dispatch({ type: "SET_MODE", mode: v }), [dispatch]);
  const setStep = useCallback((v: number) => dispatch({ type: "SET_STEP", step: v }), [dispatch]);
  const setTripTitle = useCallback((v: string) => dispatch({ type: "SET_TITLE", value: v }), [dispatch]);
  const setTripBrief = useCallback((v: string) => dispatch({ type: "SET_BRIEF", value: v }), [dispatch]);
  const setStartDate = useCallback((v: Date | null) => dispatch({ type: "SET_START_DATE", value: v }), [dispatch]);
  const setEndDate = useCallback((v: Date | null) => dispatch({ type: "SET_END_DATE", value: v }), [dispatch]);
  const setVk = useCallback((v: VisualStyleKey) => dispatch({ type: "SET_VK", value: v }), [dispatch]);
  const setWs = useCallback((v: WordStyleKey) => dispatch({ type: "SET_WS", value: v }), [dispatch]);
  const setLen = useCallback((v: LengthKey) => dispatch({ type: "SET_LEN", value: v }), [dispatch]);
  const setLo = useCallback((v: LayoutKey) => dispatch({ type: "SET_LO", value: v }), [dispatch]);
  const setGenSnapshot = useCallback(
    (newWs: WordStyleKey | null, newLen: LengthKey | null) =>
      dispatch({ type: "SET_GEN_SNAPSHOT", ws: newWs, len: newLen }),
    [dispatch],
  );
  // Individual setGenWs/setGenLen wrappers preserve the call-site shape
  // `setGenWs(x); setGenLen(y);` from the pre-context code. Each one updates
  // its half of the snapshot pair while leaving the other unchanged.
  const setGenWs = useCallback(
    (v: WordStyleKey | null) => dispatch({ type: "SET_GEN_SNAPSHOT", ws: v, len: state.genLen }),
    [dispatch, state.genLen],
  );
  const setGenLen = useCallback(
    (v: LengthKey | null) => dispatch({ type: "SET_GEN_SNAPSHOT", ws: state.genWs, len: v }),
    [dispatch, state.genWs],
  );
  // Photos: only used for whole-array assignments (load / reset). Functional
  // setPhotos((prev) => …) call sites are rewritten to specific reducer
  // actions (ADD_PHOTOS, REMOVE_PHOTO, REORDER_PHOTOS, UPDATE_PHOTO_FIELD)
  // because closure-captured `state.photos` would go stale across awaits.
  const setPhotos = useCallback(
    (v: Photo[]) => dispatch({ type: "SET_PHOTOS", photos: v }),
    [dispatch],
  );
  const setCoverPhotoId = useCallback(
    (id: number | null) => dispatch({ type: "SET_COVER_PHOTO_ID", id }),
    [dispatch],
  );
  const setCoverTitle = useCallback(
    (v: string) => dispatch({ type: "SET_COVER_TITLE", value: v }),
    [dispatch],
  );
  const setCoverSubtitle = useCallback(
    (v: string) => dispatch({ type: "SET_COVER_SUBTITLE", value: v }),
    [dispatch],
  );
  const setCoverTitleEdited = useCallback(
    (v: boolean) => dispatch({ type: "MARK_COVER_TITLE_EDITED", value: v }),
    [dispatch],
  );
  const setCurrentJournalId = useCallback(
    (id: string | null) => dispatch({ type: "SET_JOURNAL_ID", id }),
    [dispatch],
  );
  // SET_SHARE is atomic over (slug, isPublic). Always set both in one
  // dispatch — separate setters would race on closure-captured state.
  const setShare = useCallback(
    (slug: string | null, isPub: boolean) => dispatch({ type: "SET_SHARE", slug, isPublic: isPub }),
    [dispatch],
  );
  const setSaveStatus = useCallback(
    (v: SaveStatus) => dispatch({ type: "SET_SAVE_STATUS", value: v }),
    [dispatch],
  );
  const setQuickGenerating = useCallback(
    (v: boolean) => dispatch({ type: "SET_QUICK_GENERATING", value: v }),
    [dispatch],
  );
  const setGenProgress = useCallback(
    (v: { current: number; total: number } | null) => dispatch({ type: "SET_GEN_PROGRESS", value: v }),
    [dispatch],
  );

  // ── UI / orchestration state stays local (modals, toast, etc.) ──
  const [regenConfirm, setRegenConfirm] = useState<{
    onRegenerate: () => void;
    onKeepCurrent: () => void;
  } | null>(null);
  useUnloadGuard(quickGenerating);
  const [savedJournal, setSavedJournal] = useState<SavedState | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; current: number; total: number }>({ active: false, current: 0, total: 0 });
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const fullRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  // saveTimer / cloudSaveTimer / lastSavedPhotosRef etc. were moved into
  // JournalProvider in STEP 3 — the provider owns auto-save now.

  // ── Auth + cloud journals ──
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [journalsLoaded, setJournalsLoaded] = useState(false);
  const [deleteJournalConfirm, setDeleteJournalConfirm] = useState<JournalSummary | null>(null);
  const [newJournalPickerOpen, setNewJournalPickerOpen] = useState(false);
  // clientId → total view count, populated alongside refreshJournals for
  // public journals only. Empty {} when the user has no public journals.
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [statsJournal, setStatsJournal] = useState<JournalSummary | null>(null);

  // Rate limit UI state
  const [rateLimitModal, setRateLimitModal] = useState<RateLimitErrorInfo | null>(null);
  const [rateStatus, setRateStatus] = useState<RateLimitStatus | null>(null);
  const rateWarningShownRef = useRef(false);

  // AI Trip Brief Generator state
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [briefReplaceConfirm, setBriefReplaceConfirm] = useState<string | null>(null);

  // Proactively refresh rate-limit status on auth/page changes so the
  // "X generations remaining today" indicator stays live across navigation,
  // not just after a successful AI call.
  useEffect(() => {
    if (!user) {
      setRateStatus(null);
      return;
    }
    fetchRateStatus(currentJournalId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode, step, currentJournalId]);

  // Load current share status for the preview header.
  useEffect(() => {
    if (!user || !currentJournalId) {
      setShare(null, false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/app/lib/supabase");
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/share?journalId=${encodeURIComponent(currentJournalId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const d = (await res.json()) as { slug: string | null; isPublic: boolean };
        if (cancelled) return;
        setShare(d.slug ?? null, !!d.isPublic);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [user, currentJournalId]);

  // Email-capture prompt: shown once per session when a signed-out Quick
  // Create user reaches the preview with AI content. signupPromptDoneRef
  // prevents it from re-appearing after dismiss/sign-up or after the user
  // navigates back to edit and returns.
  const [signupPromptVisible, setSignupPromptVisible] = useState(false);
  const signupPromptDoneRef = useRef(false);
  const signupPromptWasOpenRef = useRef(false);

  const openSignIn = useCallback(() => { setAuthModalMode("signin"); setAuthModalOpen(true); }, []);
  const openSignUp = useCallback(() => { setAuthModalMode("signup"); setAuthModalOpen(true); }, []);

  // ── Refresh the user's saved-journals list whenever auth changes ──
  const refreshJournals = useCallback(async () => {
    if (!user) {
      setJournals([]);
      setJournalsLoaded(false);
      setViewCounts({});
      return;
    }
    try {
      const list = await listJournalsRemote(user.id);
      setJournals(list);
      setJournalsLoaded(true);
      // Fetch view counts in parallel — failures here are non-fatal,
      // the dashboard just renders cards without the chip.
      const hasPublic = list.some((j) => j.isPublic);
      if (hasPublic) {
        getJournalViewCounts().then(setViewCounts).catch((err) => {
          console.warn("View counts unavailable:", err);
          setViewCounts({});
        });
      } else {
        setViewCounts({});
      }
    } catch (err) {
      console.error("Failed to list journals:", err);
      setJournalsLoaded(true);
    }
  }, [user]);

  useEffect(() => { refreshJournals(); }, [refreshJournals]);

  // Hand the journals-list refresher to the provider so the cloud-save
  // effect there can refresh the landing-page grid after each successful
  // write. Cleared on unmount so the provider doesn't hold a stale ref.
  useEffect(() => {
    setOnRefreshJournals(() => refreshJournals);
    return () => setOnRefreshJournals(null);
  }, [refreshJournals, setOnRefreshJournals]);

  // ── Email capture: show the signup panel exactly once per session when a
  //    signed-out Quick Create user lands on the preview with AI content. ──
  useEffect(() => {
    const hasAi = photos.some((p) => p.aiCaption || p.aiNotes || p.aiParagraph);
    const shouldShow =
      step === 99 &&
      mode === "quick" &&
      !user &&
      hasAi &&
      !signupPromptDoneRef.current;
    if (shouldShow) {
      setSignupPromptVisible(true);
      signupPromptDoneRef.current = true;
      signupPromptWasOpenRef.current = true;
      track("signup_prompt_shown", { trigger: "preview_load" });
    }
  }, [step, mode, user, photos]);

  // After signup completes while the panel was open, dismiss the panel and
  // surface a confirmation toast. The auto-save effect handles the actual
  // Supabase write — we just react to the user transition.
  useEffect(() => {
    if (user && signupPromptWasOpenRef.current) {
      setSignupPromptVisible(false);
      signupPromptWasOpenRef.current = false;
      setToast("Journal saved to your account \u2713");
      setTimeout(() => setToast(null), 4000);
      track("signup_from_prompt", { trigger: "preview_load" });
    }
  }, [user]);

  // ── Load saved state on mount + register fallback + rate-limit listeners ──
  useEffect(() => {
    setFallbackListener(() => {
      setToast("AI model busy — using faster fallback model");
      setTimeout(() => setToast(null), 5000);
    });
    setRateLimitListener((info) => {
      setRateLimitModal(info);
      track("rate_limit_reached", {
        signedIn: info.signedIn,
        limitType: info.limitType,
      });
      if (!info.signedIn) {
        track("rate_limit_signin_prompt_shown", { limitType: info.limitType });
      }
    });
    setBusyListener((message) => {
      // 503 server_busy + the one-shot 3s retry both failed — show a
      // gentle toast instead of letting the empty result land silently.
      setToast(message);
      setTimeout(() => setToast(null), 5000);
    });
    setRateStatusListener((status) => {
      setRateStatus(status);
      const dailyRem = status.dailyRemaining ?? Infinity;
      // First time a signed-in user crosses the <10-remaining threshold
      // this session, fire the warning analytics event.
      if (status.signedIn && dailyRem < 10 && !rateWarningShownRef.current) {
        rateWarningShownRef.current = true;
        track("rate_limit_warning_shown", { dailyRemaining: dailyRem });
      }
      if (status.signedIn && dailyRem >= 10) {
        rateWarningShownRef.current = false;
      }
    });
    loadState().then((saved) => {
      if (saved && saved.tripTitle) {
        setSavedJournal(saved);
        setShowResumePrompt(true);
      }
      setAppReady(true);
    });
  }, []);

  // ── Scroll to top + track journal_completed when reaching the preview ──
  useEffect(() => {
    if (step === 99) {
      // Always scroll to the top of the preview when entering it —
      // applies to Quick Create auto-navigation and Full Builder's
      // Preview button alike.
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
      if (photos.length > 0) {
        track("journal_completed", {
          visualStyle: vk,
          layout: lo,
          wordStyle: ws,
          photoCount: photos.length,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

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
    setLen((savedJournal.length as LengthKey) ?? "standard");
    setGenWs((savedJournal.generationWordStyle as WordStyleKey | null) ?? null);
    setGenLen((savedJournal.generationLength as LengthKey | null) ?? null);
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
    const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB pre-compress cap
    const typeOk = files.filter((f) => validImageTypes.includes(f.type));
    const invalidCount = files.length - typeOk.length;
    if (invalidCount > 0) {
      setUploadErrors((prev) => [...prev, `${invalidCount} file${invalidCount > 1 ? "s" : ""} skipped (not images)`]);
    }
    const validFiles = typeOk.filter((f) => f.size <= MAX_PHOTO_BYTES);
    const oversizedCount = typeOk.length - validFiles.length;
    if (oversizedCount > 0) {
      setUploadErrors((prev) => [...prev, `${oversizedCount} file${oversizedCount > 1 ? "s" : ""} skipped (over 25 MB)`]);
    }

    setUploadProgress({ active: true, current: 0, total: validFiles.length });
    const errors: string[] = [];

    // Process sequentially to avoid memory spikes from parallel canvas operations
    for (let i = 0; i < validFiles.length; i++) {
      setUploadProgress({ active: true, current: i + 1, total: validFiles.length });
      try {
        const src = await compressImage(validFiles[i]);
        // Use ADD_PHOTOS so the reducer composes against the latest photos
        // — closure-captured state.photos would go stale across awaits.
        dispatch({
          type: "ADD_PHOTOS",
          photos: [{
            id: Date.now() + Math.random(),
            src,
            caption: "",
            notes: "",
            paragraph: "",
            aiCaption: "",
            aiNotes: "",
            aiParagraph: "",
          }],
        });
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

    // Hard cap at 30. Drop any files that would push us over and inform the
    // user via the upload-zone message — no modal interruption.
    const remaining = Math.max(0, 30 - photos.length);
    if (remaining === 0) {
      return; // upload zone is disabled in this state, but defend regardless
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      setUploadErrors((prev) => [
        ...prev,
        `${files.length - remaining} file${files.length - remaining > 1 ? "s" : ""} skipped (30-photo max reached)`,
      ]);
    }

    processFiles(accepted);
  }, [photos.length, processFiles]);

  const updatePhoto = (id: number, field: string, value: string) =>
    dispatch({ type: "UPDATE_PHOTO_FIELD", id, field: field as keyof Photo, value });

  const removePhoto = (id: number) => {
    // Reducer also clears cover assignment if the removed photo was the cover.
    dispatch({ type: "REMOVE_PHOTO", id });
  };

  const toggleCover = (id: number) => {
    dispatch({ type: "TOGGLE_COVER", id });
  };

  const reorderPhotos = (next: Photo[]) => {
    dispatch({ type: "REORDER_PHOTOS", photos: next });
  };

  // Auto-sync coverTitle ← tripTitle until user manually edits coverTitle
  useEffect(() => {
    if (!coverTitleEdited) {
      setCoverTitle(tripTitle);
    }
  }, [tripTitle, coverTitleEdited]);

  const updateCoverTitle = (value: string) => {
    // Single dispatch sets the title AND marks it as user-edited.
    dispatch({ type: "SET_COVER_TITLE", value, markEdited: true });
  };


  const doReset = () => {
    clearState();
    // Single atomic reset of all journal data — reducer wipes everything
    // back to initial state.
    dispatch({ type: "RESET" });
    resetSaveCaches();
  };

  // ── Journal management actions ──
  const openJournalById = useCallback(async (id: string) => {
    try {
      const loaded = await loadJournalRemote(id);
      const data = loaded.data;
      // Hydrate state
      setTripTitle(data.tripTitle);
      setTripBrief(data.tripBrief);
      setStartDate(data.startDate ? new Date(data.startDate) : null);
      setEndDate(data.endDate ? new Date(data.endDate) : null);
      setVk(data.visualStyle);
      setWs(data.wordStyle);
      setLen(data.length);
      setGenWs(data.generationWordStyle);
      setGenLen(data.generationLength);
      setLo(data.layout);
      setPhotos(data.photos);
      setCoverPhotoId(typeof data.coverPhotoId === "number" ? data.coverPhotoId : null);
      setCoverTitle(data.coverTitle);
      setCoverSubtitle(data.coverSubtitle);
      setCoverTitleEdited(data.coverTitleEdited);
      setCurrentJournalId(data.id);
      // Prime the provider's diff caches so the first auto-save after open
      // doesn't look structural (same photos in the same order as the DB).
      seedSaveCaches(data.photos, data.coverPhotoId, loaded.photoRemoteIds, loaded.photoStoragePaths);
      // Route based on the stored mode so the user lands in the builder
      // they originally chose. Journals with any AI content open straight
      // to the preview (step 99); work-in-progress lands in that mode's
      // first editing step (Quick step 0, Full step 1 — Photos & Notes).
      const hasAi = data.photos.some((p) => p.aiCaption || p.aiNotes || p.aiParagraph);
      setMode(data.mode);
      setStep(hasAi ? 99 : data.mode === "quick" ? 0 : 1);
    } catch (err) {
      console.error("Failed to open journal:", err);
      setToast("Couldn't open that journal. Try again.");
      setTimeout(() => setToast(null), 4000);
    }
  }, []);

  const renameJournalById = useCallback(async (id: string, title: string) => {
    if (!user) return;
    try {
      await renameJournalRemote(user.id, id, title);
      // If the currently open journal is the one being renamed, sync local state
      if (currentJournalId === id) setTripTitle(title);
      refreshJournals();
    } catch (err) {
      console.error("Rename failed:", err);
    }
  }, [user, currentJournalId, refreshJournals]);

  const duplicateJournalById = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await duplicateJournalRemote(user.id, id);
      refreshJournals();
    } catch (err) {
      console.error("Duplicate failed:", err);
    }
  }, [user, refreshJournals]);

  const deleteJournalConfirmed = useCallback(async (j: JournalSummary) => {
    if (!user) return;
    try {
      await deleteJournalRemote(user.id, j.id);
      if (currentJournalId === j.id) {
        // The open journal was just deleted — reset local state
        doReset();
      }
      refreshJournals();
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteJournalConfirm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJournalId, refreshJournals]);

  const reset = () => {
    // Signed-in users have their work auto-saved to Supabase, so navigating
    // away never loses anything — skip the discard prompt. Signed-out users
    // only have IndexedDB, so we still warn them when there's a draft.
    if (!user && (tripTitle || photos.length > 0)) {
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

  const runBriefGenerate = useCallback(async () => {
    if (briefGenerating || photos.length === 0) return;
    setBriefGenerating(true);
    try {
      const thumbs = await Promise.all(photos.map((p) => makeThumbnail(p.src, 400, 0.7)));
      const prompt = tripBriefFromPhotosPrompt(tripTitle, dateDisplay, photos.length, ws);
      const text = await aiCall(prompt, undefined, {
        actionType: "trip_brief_generate",
        images: thumbs,
        maxTokens: 320,
      });
      const cleaned = (text || "").trim().replace(/^"|"$/g, "");
      if (!cleaned) {
        setToast("Couldn't generate brief \u2014 try again or write your own.");
        setTimeout(() => setToast(null), 4000);
        return;
      }
      setTripBrief(cleaned);
    } catch (err) {
      console.error("Brief generate failed:", err);
      setToast("Couldn't generate brief \u2014 try again or write your own.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBriefGenerating(false);
    }
  }, [briefGenerating, photos, tripTitle, dateDisplay, ws]);

  const onClickGenerateBrief = useCallback(() => {
    if (briefGenerating || photos.length === 0) return;
    if (tripBrief.trim()) {
      setBriefReplaceConfirm(tripBrief);
      return;
    }
    void runBriefGenerate();
  }, [briefGenerating, photos.length, tripBrief, runBriefGenerate]);

  const ok = tripTitle.trim() && photos.length > 0;

  // Generation pipeline lives in useJournalGeneration — gives us
  // generateMissingAi, regenerateAllAi, the cancel handshake, and the
  // derived hasAnyAi / settingsChangedSinceGeneration booleans. The hook
  // also provides dateDisplay so we don't compute it twice (the earlier
  // local dateDisplay was used by runBriefGenerate above; the hook's
  // value is identical so we shadow it here for the rest of the function).
  const {
    generateMissingAi,
    regenerateAllAi,
    cancel: cancelGeneration,
    cancelDisabled,
    settingsChangedSinceGeneration,
    hasAnyAi,
  } = useJournalGeneration();

  const quickGenerate = async () => {
    if (settingsChangedSinceGeneration) {
      setRegenConfirm({
        onRegenerate: async () => {
          setRegenConfirm(null);
          await regenerateAllAi("quick");
          setStep(99);
        },
        onKeepCurrent: async () => {
          setRegenConfirm(null);
          // User chose not to rewrite existing text — accept the new settings
          // as the baseline so the prompt doesn't fire again on no-change.
          setGenWs(ws);
          setGenLen(len);
          const result = await generateMissingAi("quick");
          if (result.cancelled || result.generated === 0) setStep(99);
          else setStep(10);
        },
      });
      return;
    }
    const result = await generateMissingAi("quick");
    // Cancelled mid-run, or returning user with prior AI: go to preview.
    // Fresh full run: drop into Quick Review (step 10) for the user to scan.
    if (result.cancelled || hasAnyAi || result.generated === 0) {
      setStep(99);
    } else {
      setStep(10);
    }
  };

  const fullBuilderAdvance = async () => {
    if (settingsChangedSinceGeneration) {
      setRegenConfirm({
        onRegenerate: async () => {
          setRegenConfirm(null);
          await regenerateAllAi("full");
          setStep(99);
        },
        onKeepCurrent: async () => {
          setRegenConfirm(null);
          setGenWs(ws);
          setGenLen(len);
          if (hasAnyAi) await generateMissingAi("full");
          setStep(99);
        },
      });
      return;
    }
    // Fresh Full Builder: no AI at all — current behavior, straight to preview.
    // Returning Full Builder with new photos: run AI for the missing ones,
    // then go to preview. All photos already have AI: skip to preview.
    if (hasAnyAi) await generateMissingAi("full");
    setStep(99);
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

  const photoCount = photos.length;
  const atHardCap = photoCount >= 30;
  // Over the 20-photo soft cap. Triggers the dismissible amber banner and
  // the stone-tinted count line. Hard cap still suppresses the banner —
  // the dropzone's red message is louder and avoids stacking warnings.
  const overSoftCap = photoCount > 20 && !atHardCap;
  const atSoftCap = photoCount >= 20 && !atHardCap;
  const [softCapDismissed, setSoftCapDismissed] = useState(false);
  // Reset the dismissal once the user falls back under the soft cap so the
  // banner reappears if they later climb past 20 again.
  useEffect(() => {
    if (photoCount <= 20) setSoftCapDismissed(false);
  }, [photoCount]);
  const showSoftCapBanner = overSoftCap && !softCapDismissed;

  // Smart nudge: short brief + lots of photos. The AI handles most of the
  // narrative on its own in this case; we surface a tip so the user knows
  // they can either add detail or trigger ✦ Describe my trip.
  const briefWordCount = tripBrief.trim() ? tripBrief.trim().split(/\s+/).length : 0;
  const briefNudgeApplies = briefWordCount < 20 && photoCount > 10;
  const [briefNudgeDismissed, setBriefNudgeDismissed] = useState(false);
  useEffect(() => {
    if (!briefNudgeApplies) setBriefNudgeDismissed(false);
  }, [briefNudgeApplies]);
  const showBriefNudge = briefNudgeApplies && !briefNudgeDismissed;
  const dropStyleEffective: React.CSSProperties = atHardCap
    ? { ...dropStyle, opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }
    : dropStyle;
  if (!appReady) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="min-h-screen bg-paper font-body">

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthed={() => { /* AuthProvider's onAuthStateChange picks it up */ }}
      />

      <SignupPromptPanel
        open={signupPromptVisible}
        onSignUp={() => {
          track("signup_prompt_clicked", { trigger: "preview_load" });
          openSignUp();
        }}
        onDismiss={() => {
          setSignupPromptVisible(false);
          signupPromptWasOpenRef.current = false;
          track("signup_prompt_dismissed", { trigger: "preview_load" });
        }}
      />

      {/* ═══════════════ RATE LIMIT MODAL ═══════════════ */}
      {rateLimitModal && (() => {
        // Compose headline + body from the structured limitType so each
        // limit has its own messaging. Anon users always get the sign-in CTA.
        const m = rateLimitModal;
        let headline = "Generation limit reached";
        let body: React.ReactNode = m.message;
        if (m.limitType === "journal_creation") {
          headline = "Daily journal limit reached";
          body = (
            <>
              You&apos;ve created {m.journalsUsed ?? 10} journals today. Your limit resets tomorrow.
              <br />
              <span style={{ display: "inline-block", marginTop: 8, fontSize: 13 }}>
                You can still edit your existing journals and download them.
              </span>
            </>
          );
        } else if (m.limitType === "journal_rewrites") {
          headline = "All rewrites used for this journal";
          body = (
            <>
              You&apos;ve used all 30 AI rewrites on this journal. You can still edit text manually.
              <br />
              <span style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--color-ink)" }}>
                Tip: Duplicate this journal to get a fresh set of rewrites.
              </span>
            </>
          );
        } else if (m.limitType === "cooldown") {
          headline = "AI is cooling down";
          body = (
            <>
              You&apos;ve used a lot of AI in a short time. Try again in {formatResetIn(m.cooldownRemainingSeconds ?? 0)}.
            </>
          );
        } else if (!m.signedIn) {
          headline = "Generation limit reached";
          body = "You've reached the generation limit. Sign in for a higher limit and to save your journals.";
        } else {
          body = (
            <>
              {`You've hit the ${m.limitType === "daily" ? "daily" : "hourly"} generation limit. Resets in ${formatResetIn(m.resetInSeconds)}.`}
              <br />
              <span style={{ display: "inline-block", marginTop: 8, fontSize: 13 }}>
                You can still edit, download, and use the rest of Waymark.
              </span>
            </>
          );
        }
        return (
          <div
            className="fixed inset-0 z-[450] flex items-center justify-center p-4"
            style={{ background: "rgba(26,24,21,.6)" }}
            onClick={() => setRateLimitModal(null)}
          >
            <div
              className="bg-card"
              style={{ borderRadius: 6, padding: "32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.2)", textAlign: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-title" style={{ fontSize: 22, fontWeight: 300, color: "var(--color-ink)", marginBottom: 10 }}>
                {headline}
              </div>
              <p className="text-stone" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                {body}
              </p>
              <div className="flex gap-3 justify-center">
                {!m.signedIn && (
                  <Button onClick={() => { setRateLimitModal(null); openSignUp(); }}>
                    Sign in
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setRateLimitModal(null)}>
                  Got it
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════ NEW JOURNAL MODE PICKER ═══════════════ */}
      {newJournalPickerOpen && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ background: "rgba(26,24,21,.6)" }}
          onClick={() => setNewJournalPickerOpen(false)}
        >
          <div
            className="bg-card"
            style={{ borderRadius: 6, padding: "32px 28px", maxWidth: 440, width: "100%", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-title text-center" style={{ fontSize: 22, fontWeight: 300, color: "var(--color-ink)", marginBottom: 6 }}>
              Start a new journal
            </div>
            <p className="text-stone text-center" style={{ fontSize: 13, marginBottom: 22 }}>
              Choose how you want to build it.
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                { m: "quick" as const, icon: "\u26A1", bg: "var(--color-accent)", t: "Quick Create", d: "Drop photos + story. AI does the rest." },
                { m: "full" as const, icon: "\u270E", bg: "var(--color-ink)", t: "Full Builder", d: "Craft every detail yourself or with AI." },
              ].map(({ m, icon, bg, t, d }) => (
                <button
                  key={m}
                  onClick={() => {
                    doReset();
                    setMode(m);
                    setStep(0);
                    setNewJournalPickerOpen(false);
                    track("journal_started", { mode: m });
                  }}
                  className="flex items-center gap-3.5 border border-border bg-card cursor-pointer text-left w-full"
                  style={{ padding: "14px 18px", borderRadius: 5 }}
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
            <div className="text-center" style={{ marginTop: 16 }}>
              <button
                onClick={() => setNewJournalPickerOpen(false)}
                className="bg-transparent border-none cursor-pointer"
                style={{ color: "var(--color-warm)", fontSize: 11, padding: 0 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ JOURNAL STATS MODAL ═══════════════ */}
      {statsJournal && (
        <JournalStatsModal
          journalId={statsJournal.id}
          journalTitle={statsJournal.title}
          onClose={() => setStatsJournal(null)}
        />
      )}

      {/* ═══════════════ FOCAL POINT PICKER ═══════════════ */}
      {state.focalPickerPhotoId !== null && (() => {
        const target = photos.find((p) => p.id === state.focalPickerPhotoId);
        if (!target) return null;
        return (
          <FocalPointPicker
            src={target.src}
            initial={target.focalPoint}
            onApply={(next) => dispatch({
              type: "SET_PHOTO_FOCAL_POINT",
              id: target.id,
              focalPoint: next,
            })}
            onClose={() => dispatch({ type: "CLOSE_FOCAL_PICKER" })}
          />
        );
      })()}

      {/* ═══════════════ DELETE JOURNAL CONFIRM ═══════════════ */}
      {deleteJournalConfirm && (
        <ConfirmModal
          title="Delete this journal?"
          body={
            <>
              <strong className="text-ink">{deleteJournalConfirm.title || "Untitled Journal"}</strong>{" "}
              will be permanently deleted. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => deleteJournalConfirmed(deleteJournalConfirm)}
          onCancel={() => setDeleteJournalConfirm(null)}
        />
      )}

      {briefReplaceConfirm !== null && (
        <ConfirmModal
          title="Replace your current brief?"
          body="The AI will write a new brief from your photos. Your current text will be replaced."
          confirmLabel="Replace"
          cancelLabel="Cancel"
          onConfirm={() => { setBriefReplaceConfirm(null); void runBriefGenerate(); }}
          onCancel={() => setBriefReplaceConfirm(null)}
        />
      )}

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
            <div
              className="font-body text-stone"
              style={{ fontSize: 13, lineHeight: 1.5, marginTop: 14 }}
            >
              Please keep this tab open while your journal is being created.
            </div>
            <button
              onClick={cancelGeneration}
              disabled={cancelDisabled}
              className="font-body cursor-pointer"
              style={{
                marginTop: 18,
                background: "transparent",
                color: "var(--color-ink)",
                border: "1px solid var(--color-ink)",
                borderRadius: 3,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                cursor: cancelDisabled ? "wait" : "pointer",
                opacity: cancelDisabled ? 0.5 : 1,
              }}
            >
              Cancel generation
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ RESUME PROMPT ═══════════════ */}
      {showResumePrompt && savedJournal && (
        <ConfirmModal
          title="Welcome back"
          body={
            <>You have an unfinished journal: <strong className="text-ink">{savedJournal.tripTitle}</strong></>
          }
          confirmLabel="Resume"
          cancelLabel="Start Fresh"
          onConfirm={resumeJournal}
          onCancel={startFresh}
        />
      )}

      {/* ═══════════════ REGENERATE-WITH-NEW-SETTINGS DIALOG ═══════════════ */}
      {regenConfirm && (
        <ConfirmModal
          title="Rewrite your journal?"
          body={`All text will be rewritten using ${WS[ws].label} voice and ${LE[len].label} length. Your photos and order won't change.`}
          confirmLabel="Regenerate"
          cancelLabel="Keep current text"
          onConfirm={regenConfirm.onRegenerate}
          onCancel={regenConfirm.onKeepCurrent}
        />
      )}

      {/* ═══════════════ DISCARD CONFIRM ═══════════════ */}
      {confirmAction && (
        <ConfirmModal
          title="Discard journal?"
          body="This will discard your current journal. Are you sure?"
          confirmLabel="Discard"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={() => { confirmAction(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ═══════════════ LANDING ═══════════════ */}
      {mode === null && (
        <div className="min-h-screen flex flex-col">
          <Header
            onLogoClick={() => { /* already on landing */ }}
            saveStatus={saveStatus}
            onSignInClick={openSignIn}
            onSignUpClick={openSignUp}
            onYourJournals={() => { /* already here */ }}
            rateRemainingToday={user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" ? rateStatus.dailyRemaining : null}
          />
          {user && journalsLoaded && journals.length > 0 ? (
            // Signed in with journals — show the grid
            <div className="flex-1" style={{ padding: "32px 24px 40px", maxWidth: 1080, margin: "0 auto", width: "100%" }}>
              <div
                className="flex items-baseline justify-between"
                style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}
              >
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: 2, color: "var(--color-accent)",
                  }}
                >
                  Your Journals ({journals.length})
                </div>
                {typeof rateStatus?.journalsUsed === "number" && rateStatus.journalsUsed > 0 && (
                  <div
                    className="text-stone font-body"
                    style={{ fontSize: 12 }}
                  >
                    {rateStatus.journalsUsed} of 10 journals created today
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 16,
                }}
              >
                {journals.map((j) => (
                  <JournalCard
                    key={j.id}
                    journal={j}
                    onOpen={openJournalById}
                    onRename={renameJournalById}
                    onDuplicate={duplicateJournalById}
                    onDelete={(jj) => setDeleteJournalConfirm(jj)}
                    onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); }}
                    onShareChanged={refreshJournals}
                    viewCount={j.isPublic ? (viewCounts[j.id] ?? 0) : undefined}
                    onShowStats={(jj) => setStatsJournal(jj)}
                  />
                ))}
                {/* + New Journal card */}
                <button
                  onClick={() => setNewJournalPickerOpen(true)}
                  className="bg-transparent cursor-pointer flex flex-col items-center justify-center"
                  style={{
                    border: "2px dashed var(--color-border)",
                    borderRadius: 6,
                    padding: "32px 16px",
                    minHeight: 220,
                    color: "var(--color-stone)",
                    transition: "border-color .2s, color .2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--color-stone)";
                  }}
                >
                  <div className="font-title" style={{ fontSize: 32, fontWeight: 300, marginBottom: 6 }}>+</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>New Journal</div>
                </button>
              </div>
            </div>
          ) : (
            // Signed out, OR signed in with no journals — show the hero + mode picker
            <div className="flex-1 flex items-center justify-center" style={{ padding: "0 28px 40px" }}>
              <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
                {!user && (
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
                )}
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
                {user ? (
                  <p
                    className="animate-fade-up-2"
                    style={{
                      fontSize: 14, color: "var(--color-stone)",
                      fontStyle: "italic", lineHeight: 1.6,
                      marginBottom: 36, maxWidth: 400, margin: "0 auto 36px",
                    }}
                  >
                    Your journals will appear here.
                  </p>
                ) : (
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
                )}

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
          )}

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
          <Header onLogoClick={reset} saveStatus={saveStatus} onSignInClick={openSignIn} onSignUpClick={openSignUp} onYourJournals={reset} back={<HeaderBtn onClick={reset}>&#x2190; Home</HeaderBtn>} />
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
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Your Story</label>
                {photos.length > 0 && (
                  <AiButton
                    onClick={onClickGenerateBrief}
                    loading={briefGenerating}
                    label="Describe my trip"
                    small
                  />
                )}
              </div>
              <textarea
                style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
                placeholder="What made this trip special? The people, the food, the unexpected moments..."
                value={tripBrief}
                onChange={(e) => setTripBrief(e.target.value)}
                             />
              <HelperText>The more you write here, the more personal your journal will be. Write less and the AI fills in the gaps from what it sees in your photos. This also appears as the opening paragraph.</HelperText>
              {showBriefNudge && (
                <DismissibleBanner
                  tone="stone"
                  onDismiss={() => setBriefNudgeDismissed(true)}
                  style={{ marginTop: 8 }}
                >
                  {`Tip: With ${photoCount} photos and a short brief, the AI will create more of the story on its own. Add more detail for a more personal result, or use ✦ Describe my trip to auto-generate.`}
                </DismissibleBanner>
              )}
            </div>

            <div
              style={dropStyleEffective}
              onClick={() => { if (!atHardCap) quickRef.current?.click(); }}
              aria-disabled={atHardCap}
            >
              <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.4 }}>&#x2191;</div>
              <div className="font-semibold text-ink" style={{ fontSize: 13 }}>Upload photos</div>
              {atHardCap ? (
                <div style={{ color: "var(--color-accent)", fontSize: 13, marginTop: 8, lineHeight: 1.5, padding: "0 8px" }}>
                  Maximum of 30 photos per journal reached. Remove photos to upload more.
                </div>
              ) : (
                <HelperText>Best with 5–20 photos. Add the moments that mattered most.</HelperText>
              )}
              <input ref={quickRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} disabled={atHardCap} />
            </div>

            <div
              className="font-body text-stone flex items-center justify-center gap-1.5"
              style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5, opacity: 0.75 }}
            >
              <span>Your photos stay in your browser until you generate.</span>
              <Link
                href="/help#photo-privacy"
                className="text-stone underline"
                style={{ textDecorationColor: "var(--color-border)", textUnderlineOffset: 2 }}
              >
                Learn more
              </Link>
            </div>

            {photos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div
                  className={overSoftCap ? "text-stone font-semibold" : "text-ink font-semibold"}
                  style={{ fontSize: 13, marginBottom: 4 }}
                >
                  {overSoftCap
                    ? `${photoCount} photos added · generation will be slower`
                    : `${photoCount} of 20 photos added`}
                </div>
                {uploadErrors.length > 0 && (
                  <div className="text-stone" style={{ fontSize: 12, marginBottom: 6 }}>
                    {uploadErrors.join(". ")}
                  </div>
                )}
                <HelperText>Tap any photo to set it as your cover. (optional) &middot; Drag to reorder.</HelperText>
                <div className="flex gap-3 flex-wrap" style={{ marginTop: 10 }}>
                  <SortablePhotoList
                    photos={photos}
                    onReorder={reorderPhotos}
                    disabled={quickGenerating}
                    strategy="horizontal"
                    renderItem={(p, _i, _total, handleProps) => {
                      const isCover = coverPhotoId === p.id;
                      return (
                        <div
                          {...handleProps}
                          className="flex flex-col items-center"
                          style={{ gap: 4, touchAction: "none" }}
                        >
                          <div className="relative">
                            <button
                              onClick={() => toggleCover(p.id)}
                              className="wm-cover-thumb cursor-pointer p-0 bg-transparent block"
                              style={{
                                border: isCover ? "2px solid #C4A45A" : "2px solid transparent",
                                borderRadius: 4,
                              }}
                              aria-label={isCover ? "Cover photo" : "Set as cover"}
                              aria-pressed={isCover}
                            >
                              <img
                                src={p.src}
                                className="object-cover block"
                                style={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: 3,
                                  objectPosition: p.focalPoint
                                    ? `${p.focalPoint.x}% ${p.focalPoint.y}%`
                                    : "50% 50%",
                                }}
                                alt=""
                              />
                              {p.focalPoint && (p.focalPoint.x !== 50 || p.focalPoint.y !== 50) && (
                                <span
                                  aria-label="Custom focal point"
                                  style={{
                                    position: "absolute",
                                    bottom: 4,
                                    left: 4,
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#C4A45A",
                                    border: "1.5px solid #fff",
                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                                    pointerEvents: "none",
                                  }}
                                />
                              )}
                              {!isCover && (
                                <span
                                  className="wm-cover-hover absolute flex items-center justify-center"
                                  style={{
                                    top: 2,
                                    left: 2,
                                    right: 2,
                                    bottom: 2,
                                    background: "rgba(26,24,21,0.45)",
                                    color: "#fff",
                                    borderRadius: 2,
                                    opacity: 0,
                                    transition: "opacity 0.15s ease",
                                    pointerEvents: "none",
                                  }}
                                >
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                  </svg>
                                </span>
                              )}
                            </button>
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); removePhoto(p.id); }}
                              className="absolute flex items-center justify-center bg-accent text-white border-none cursor-pointer"
                              style={{ top: -4, right: -4, width: 18, height: 18, borderRadius: 9, fontSize: 10, zIndex: 2 }}
                              aria-label="Remove photo"
                            >
                              &#x00D7;
                            </button>
                          </div>
                          {isCover && (
                            <div
                              className="text-stone"
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: 1.2,
                                textTransform: "uppercase",
                              }}
                            >
                              Cover &#x2713;
                            </div>
                          )}
                        </div>
                      );
                    }}
                    renderOverlay={(p) => (
                      <img
                        src={p.src}
                        alt=""
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: "cover",
                          objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 50%",
                          borderRadius: 4,
                          border: "2px solid var(--color-accent)",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                          opacity: 0.95,
                          transform: "rotate(2deg)",
                        }}
                      />
                    )}
                  />
                </div>
                {showSoftCapBanner && (
                  <DismissibleBanner
                    tone="amber"
                    onDismiss={() => setSoftCapDismissed(true)}
                    style={{ marginTop: 12 }}
                  >
                    {`It looks like you've got a story to tell! Heads up: this many will take a bit longer to generate.`}
                  </DismissibleBanner>
                )}
              </div>
            )}

            <div className="wm-picker-2col" style={{ marginTop: 24 }}>
              <div>
                <label style={labelStyle}>Visual</label>
                <HelperText>Sets the look — fonts, colors, and mood.</HelperText>
                <PillGroup>
                  {(Object.entries(VS) as [VisualStyleKey, typeof VS[VisualStyleKey]][]).map(([k, s]) => (
                    <Pill key={k} selected={vk === k} onClick={() => { setVk(k); track("style_selected", { style: k }); }}>
                      {s.label}
                    </Pill>
                  ))}
                </PillGroup>
              </div>
              <div>
                <label style={labelStyle}>Voice</label>
                <HelperText>Sets the writing style the AI uses.</HelperText>
                <PillGroup>
                  {(Object.entries(WS) as [WordStyleKey, typeof WS[WordStyleKey]][]).map(([k, w]) => (
                    <Pill key={k} selected={ws === k} onClick={() => setWs(k)}>
                      {w.label}
                    </Pill>
                  ))}
                </PillGroup>
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 16, marginBottom: 4 }}>Length</label>
            <HelperText>Controls how much the AI writes per photo.</HelperText>
            <PillGroup>
              {(["brief", "standard", "detailed"] as LengthKey[]).map((k) => (
                <Pill key={k} selected={len === k} onClick={() => { setLen(k); track("length_selected", { value: k }); }}>
                  {LE[k].label}
                </Pill>
              ))}
            </PillGroup>

            <label style={{ ...labelStyle, marginTop: 16, marginBottom: 4 }}>Layout</label>
            <HelperText>How your photos are arranged in the journal.</HelperText>
            <div className="wm-layout-picker" style={{ marginTop: 8 }}>
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

            <div className="flex flex-col items-end" style={{ marginTop: 36, gap: 8 }}>
              <Button
                disabled={!ok || !tripBrief.trim() || quickGenerating}
                onClick={quickGenerate}
              >
                {quickGenerating ? "Writing journal\u2026" : hasAnyAi ? "Update Journal" : "Generate Journal"}
              </Button>
              {user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" && rateStatus.dailyRemaining < 10 && (
                <div className="text-stone font-body" style={{ fontSize: 13 }}>
                  {rateStatus.dailyRemaining} generation{rateStatus.dailyRemaining === 1 ? "" : "s"} remaining today.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ QUICK REVIEW ═══════════════ */}
      {mode === "quick" && step === 10 && (
        <div>
          <Header onLogoClick={reset} saveStatus={saveStatus} onSignInClick={openSignIn} onSignUpClick={openSignUp} onYourJournals={reset} back={<HeaderBtn onClick={() => setStep(0)}>&#x2190; Back</HeaderBtn>} />
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
              <RewriteAll rewritesUsed={rateStatus?.journalRewritesUsed} rewritesRemaining={rateStatus?.journalRewritesRemaining} />
            </div>

            <div className="grid gap-2" style={{ marginBottom: 14 }}>
              <SortablePhotoList
                photos={photos}
                onReorder={reorderPhotos}
                disabled={quickGenerating}
                strategy="vertical"
                renderItem={(p, i, total, handleProps) => (
                  <PhotoStyleRow
                    photo={p}
                    dragHandleProps={handleProps}
                    index={i}
                    total={total}
                  />
                )}
                renderOverlay={(p) => (
                  <div
                    className="bg-card"
                    style={{
                      border: "2px solid var(--color-accent)",
                      borderRadius: 5,
                      padding: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      opacity: 0.95,
                      transform: "rotate(1.5deg)",
                      display: "inline-block",
                    }}
                  >
                    <img
                      src={p.src}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "cover",
                        objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 50%",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                )}
              />
            </div>

            {/* Colophon editor — only rendered after AI has populated a
                colophon. Sits below all photo / text editing sections so
                it reads as the closing section's draft. */}
            <ColophonEditor />

            <div className="flex flex-col items-end" style={{ marginTop: 36, gap: 8 }}>
              <div className="flex justify-between w-full">
                <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
                <Button onClick={() => setStep(99)}>View Journal →</Button>
              </div>
              {user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" && rateStatus.dailyRemaining < 10 && (
                <div className="text-stone font-body" style={{ fontSize: 13 }}>
                  {rateStatus.dailyRemaining} generation{rateStatus.dailyRemaining === 1 ? "" : "s"} remaining today.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ FULL BUILDER — STEP INDICATOR ═══════════════ */}
      {mode === "full" && step < 3 && (
        <Header onLogoClick={reset} saveStatus={saveStatus} onSignInClick={openSignIn} onSignUpClick={openSignUp} onYourJournals={reset}>
          <div className="wm-fb-tabs flex items-center">
            {[
              { step: 0, label: "Your Trip", short: "Trip" },
              { step: 1, label: "Photos & Notes", short: "Photos" },
              { step: 2, label: "Style & Layout", short: "Style" },
            ].map((s, i, arr) => {
              const isCurrent = s.step === step;
              const isPast = s.step < step;
              const clickable = s.step <= step;
              return (
                <div key={s.step} className="flex items-center">
                  <button
                    onClick={() => clickable && setStep(s.step)}
                    disabled={!clickable}
                    className="bg-transparent border-none font-body"
                    style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 700 : 500,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: isCurrent
                        ? "var(--color-paper)"
                        : isPast
                          ? "var(--color-accent)"
                          : "rgba(247,245,240,0.35)",
                      cursor: clickable ? "pointer" : "default",
                      padding: "4px 2px",
                      whiteSpace: "nowrap",
                      transition: "color .2s",
                    }}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className="wm-fb-tab-long">{s.label}</span>
                    <span className="wm-fb-tab-short">{s.short}</span>
                  </button>
                  {i < arr.length - 1 && (
                    <span
                      aria-hidden="true"
                      style={{
                        margin: "0 10px",
                        color: "rgba(247,245,240,0.25)",
                        fontSize: 10,
                      }}
                    >
                      &middot;
                    </span>
                  )}
                </div>
              );
            })}
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

          <div className="flex flex-col items-end" style={{ marginTop: 36, gap: 8 }}>
            <div className="flex justify-between w-full">
              <Button variant="secondary" onClick={reset}>← Home</Button>
              <Button disabled={!tripTitle.trim()} onClick={() => setStep(1)}>
                Photos →
              </Button>
            </div>
            {user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" && rateStatus.dailyRemaining < 10 && (
              <div className="text-stone font-body" style={{ fontSize: 13 }}>
                {rateStatus.dailyRemaining} generation{rateStatus.dailyRemaining === 1 ? "" : "s"} remaining today.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ FULL — STEP 1: PHOTOS & NOTES ═══════════════ */}
      {mode === "full" && step === 1 && (
        <div style={contentStyle}>
          <h2 style={h2Style}>Photos & Notes</h2>
          <p style={subStyle}>Upload photos, write captions and notes.</p>

          <div
            style={dropStyleEffective}
            onClick={() => { if (!atHardCap) fullRef.current?.click(); }}
            aria-disabled={atHardCap}
          >
            <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.4 }}>&#x2191;</div>
            <div className="font-semibold text-ink" style={{ fontSize: 13 }}>Upload photos</div>
            {atHardCap ? (
              <div style={{ color: "var(--color-accent)", fontSize: 13, marginTop: 8, lineHeight: 1.5, padding: "0 8px" }}>
                Maximum of 30 photos per journal reached. Remove photos to upload more.
              </div>
            ) : (
              <HelperText>Best with 5–20 photos.</HelperText>
            )}
            <input ref={fullRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} disabled={atHardCap} />
          </div>

          <div
            className="font-body text-stone flex items-center justify-center gap-1.5"
            style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5, opacity: 0.75 }}
          >
            <span>Your photos stay in your browser until you generate.</span>
            <Link
              href="/help#photo-privacy"
              className="text-stone underline"
              style={{ textDecorationColor: "var(--color-border)", textUnderlineOffset: 2 }}
            >
              Learn more
            </Link>
          </div>

          {photos.length > 0 && (
            <div
              className={overSoftCap ? "text-stone font-semibold" : "text-ink font-semibold"}
              style={{ fontSize: 13, marginTop: 12, marginBottom: 12 }}
            >
              {overSoftCap
                ? `${photoCount} photos added · generation will be slower`
                : `${photoCount} of 20 photos added`}
            </div>
          )}

          {showSoftCapBanner && (
            <DismissibleBanner
              tone="amber"
              onDismiss={() => setSoftCapDismissed(true)}
              style={{ marginTop: 4, marginBottom: 12 }}
            >
              {`It looks like you've got a story to tell! Heads up: this many will take a bit longer to generate.`}
            </DismissibleBanner>
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
            <SortablePhotoList
              photos={photos}
              onReorder={reorderPhotos}
              disabled={quickGenerating}
              strategy="vertical"
              renderItem={(p, i, total, handleProps) => (
                <PhotoCard
                  photo={p}
                  index={i}
                  total={total}
                  dragHandleProps={handleProps}
                />
              )}
              renderOverlay={(p) => (
                <div
                  className="bg-card"
                  style={{
                    border: "2px solid var(--color-accent)",
                    borderRadius: 5,
                    padding: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    opacity: 0.95,
                    transform: "rotate(1.5deg)",
                    display: "inline-block",
                  }}
                >
                  <img
                    src={p.src}
                    alt=""
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 50%",
                      borderRadius: 3,
                    }}
                  />
                </div>
              )}
            />
          </div>

          {/* Colophon editor — mirrors the placement on Quick step 10. Only
              renders when state.colophon is non-null (post-AI-generation). */}
          <ColophonEditor />

          <div className="flex flex-col items-end" style={{ marginTop: 36, gap: 8 }}>
            <div className="flex justify-between w-full">
              <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
              <Button disabled={photos.length === 0} onClick={() => setStep(2)}>
                Style →
              </Button>
            </div>
            {user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" && rateStatus.dailyRemaining < 10 && (
              <div className="text-stone font-body" style={{ fontSize: 13 }}>
                {rateStatus.dailyRemaining} generation{rateStatus.dailyRemaining === 1 ? "" : "s"} remaining today.
              </div>
            )}
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
            className="wm-style-grid grid gap-2.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", marginBottom: 24 }}
          >
            {(Object.entries(VS) as [VisualStyleKey, typeof VS[VisualStyleKey]][]).map(([k, s]) => (
              <StylePreview key={k} styleKey={k} style={s} selected={vk === k} onClick={() => { setVk(k); track("style_selected", { style: k }); }} />
            ))}
          </div>

          <label style={{ ...labelStyle, marginBottom: 8 }}>Layout</label>
          <div className="wm-layout-picker" style={{ marginBottom: 24 }}>
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
            className="wm-voice-grid grid gap-1.5"
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
            <RewriteAll rewritesUsed={rateStatus?.journalRewritesUsed} rewritesRemaining={rateStatus?.journalRewritesRemaining} />
          </div>
          <HelperText>Regenerates AI writing for all photos. You'll review each one before accepting.</HelperText>
          <div style={{ marginTop: 8 }} />

          <div className="grid gap-2" style={{ marginBottom: 8 }}>
            <SortablePhotoList
              photos={photos}
              onReorder={reorderPhotos}
              disabled={quickGenerating}
              strategy="vertical"
              renderItem={(p, i, total, handleProps) => (
                <PhotoStyleRow
                  photo={p}
                  dragHandleProps={handleProps}
                  index={i}
                  total={total}
                />
              )}
              renderOverlay={(p) => (
                <div
                  className="bg-card"
                  style={{
                    border: "2px solid var(--color-accent)",
                    borderRadius: 5,
                    padding: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    opacity: 0.95,
                    transform: "rotate(1.5deg)",
                    display: "inline-block",
                  }}
                >
                  <img
                    src={p.src}
                    alt=""
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 3 }}
                  />
                </div>
              )}
            />
          </div>

          <div className="flex flex-col items-end" style={{ marginTop: 36, gap: 8 }}>
            <div className="flex justify-between w-full">
              <Button variant="secondary" onClick={() => setStep(1)}>\u2190 Back</Button>
              <Button disabled={!ok || quickGenerating} onClick={fullBuilderAdvance}>
                {quickGenerating ? "Writing journal\u2026" : hasAnyAi ? "Update Journal" : "Generate Journal"}
              </Button>
            </div>
            {user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" && rateStatus.dailyRemaining < 10 && (
              <div className="text-stone font-body" style={{ fontSize: 13 }}>
                {rateStatus.dailyRemaining} generation{rateStatus.dailyRemaining === 1 ? "" : "s"} remaining today.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Site footer — Privacy · Terms. JournalPreview owns its own footer. */}
      {step !== 99 && <SiteFooter />}

      {/* ═══════════════ JOURNAL PREVIEW ═══════════════ */}
      {step === 99 && (
        <JournalPreview
          onEdit={() => setStep(mode === "quick" ? 10 : 2)}
          onLogoClick={reset}
          onSignInClick={openSignIn}
          onSignUpClick={openSignUp}
          onYourJournals={reset}
          rateRemainingToday={user && rateStatus?.signedIn && typeof rateStatus.dailyRemaining === "number" ? rateStatus.dailyRemaining : null}
          onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); }}
        />
      )}
    </div>
  );
}
