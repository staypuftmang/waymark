"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { Photo, VisualStyleKey, WordStyleKey, LayoutKey, LengthKey, Mode } from "@/app/lib/types";
import { saveState, type SavedState } from "@/app/lib/storage";
import {
  saveJournalMetadata,
  syncJournalPhotos,
  updatePhotoFields,
  isEmptyJournal,
  type JournalData,
  type PhotoTextFields,
} from "@/app/lib/journalStorage";
import { useAuth } from "@/app/lib/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// State + actions
// ─────────────────────────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "offline";

export interface JournalState {
  // Mode + step
  mode: Mode;
  step: number;

  // Trip metadata
  tripTitle: string;
  tripBrief: string;
  startDate: Date | null;
  endDate: Date | null;

  // Photos
  photos: Photo[];

  // Style selectors
  vk: VisualStyleKey;
  ws: WordStyleKey;
  len: LengthKey;
  lo: LayoutKey;

  // Snapshot of ws/len when AI last wrote content. Drives the
  // regenerate-on-settings-change confirmation.
  genWs: WordStyleKey | null;
  genLen: LengthKey | null;

  // Cover
  coverPhotoId: number | null;
  coverTitle: string;
  coverSubtitle: string;
  coverTitleEdited: boolean;

  // Cloud journal identity
  currentJournalId: string | null;
  shareSlug: string | null;
  isPublic: boolean;

  // Save + generation status
  saveStatus: SaveStatus;
  quickGenerating: boolean;
  genProgress: { current: number; total: number } | null;

  // UI dismissals tied to journal data
  softCapDismissed: boolean;
  briefNudgeDismissed: boolean;
}

export const INITIAL_JOURNAL_STATE: JournalState = {
  mode: null,
  step: 0,
  tripTitle: "",
  tripBrief: "",
  startDate: null,
  endDate: null,
  photos: [],
  vk: "editorial",
  ws: "poetic",
  len: "standard",
  lo: "classic",
  genWs: null,
  genLen: null,
  coverPhotoId: null,
  coverTitle: "",
  coverSubtitle: "",
  coverTitleEdited: false,
  currentJournalId: null,
  shareSlug: null,
  isPublic: false,
  saveStatus: "idle",
  quickGenerating: false,
  genProgress: null,
  softCapDismissed: false,
  briefNudgeDismissed: false,
};

export type JournalAction =
  // Mode + step
  | { type: "SET_MODE"; mode: Mode }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_MODE_AND_STEP"; mode: Mode; step: number }
  // Trip metadata
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_BRIEF"; value: string }
  | { type: "SET_START_DATE"; value: Date | null }
  | { type: "SET_END_DATE"; value: Date | null }
  // Photos
  | { type: "SET_PHOTOS"; photos: Photo[] }
  | { type: "ADD_PHOTOS"; photos: Photo[] }
  | { type: "REMOVE_PHOTO"; id: number }
  | { type: "REORDER_PHOTOS"; photos: Photo[] }
  | { type: "UPDATE_PHOTO_FIELD"; id: number; field: keyof Photo; value: string }
  // Style
  | { type: "SET_VK"; value: VisualStyleKey }
  | { type: "SET_WS"; value: WordStyleKey }
  | { type: "SET_LEN"; value: LengthKey }
  | { type: "SET_LO"; value: LayoutKey }
  | { type: "SET_GEN_SNAPSHOT"; ws: WordStyleKey | null; len: LengthKey | null }
  // Cover
  | { type: "TOGGLE_COVER"; id: number }
  | { type: "SET_COVER_PHOTO_ID"; id: number | null }
  | { type: "SET_COVER_TITLE"; value: string; markEdited?: boolean }
  | { type: "SET_COVER_SUBTITLE"; value: string }
  | { type: "MARK_COVER_TITLE_EDITED"; value: boolean }
  // Cloud identity
  | { type: "SET_JOURNAL_ID"; id: string | null }
  | { type: "SET_SHARE"; slug: string | null; isPublic: boolean }
  // Save + generation
  | { type: "SET_SAVE_STATUS"; value: SaveStatus }
  | { type: "SET_QUICK_GENERATING"; value: boolean }
  | { type: "SET_GEN_PROGRESS"; value: { current: number; total: number } | null }
  // Dismissals
  | { type: "DISMISS_SOFT_CAP" }
  | { type: "DISMISS_BRIEF_NUDGE" }
  | { type: "RESET_SOFT_CAP_DISMISSAL" }
  | { type: "RESET_BRIEF_NUDGE_DISMISSAL" }
  // Bulk loads
  | { type: "LOAD_FROM_SAVED_STATE"; saved: SavedState }
  | { type: "LOAD_FROM_REMOTE"; data: JournalData; journalId: string; nextStep: number }
  | { type: "RESET" };

function reducer(state: JournalState, action: JournalAction): JournalState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_MODE_AND_STEP":
      return { ...state, mode: action.mode, step: action.step };
    case "SET_TITLE":
      return { ...state, tripTitle: action.value };
    case "SET_BRIEF":
      return { ...state, tripBrief: action.value };
    case "SET_START_DATE":
      return { ...state, startDate: action.value };
    case "SET_END_DATE":
      return { ...state, endDate: action.value };
    case "SET_PHOTOS":
      return { ...state, photos: action.photos };
    case "ADD_PHOTOS":
      return { ...state, photos: [...state.photos, ...action.photos] };
    case "REMOVE_PHOTO": {
      const photos = state.photos.filter((p) => p.id !== action.id);
      // Drop cover assignment if the cover photo was removed
      const coverPhotoId = state.coverPhotoId === action.id ? null : state.coverPhotoId;
      return { ...state, photos, coverPhotoId };
    }
    case "REORDER_PHOTOS":
      return { ...state, photos: action.photos };
    case "UPDATE_PHOTO_FIELD":
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, [action.field]: action.value } : p,
        ),
      };
    case "SET_VK":
      return { ...state, vk: action.value };
    case "SET_WS":
      return { ...state, ws: action.value };
    case "SET_LEN":
      return { ...state, len: action.value };
    case "SET_LO":
      return { ...state, lo: action.value };
    case "SET_GEN_SNAPSHOT":
      return { ...state, genWs: action.ws, genLen: action.len };
    case "TOGGLE_COVER":
      return {
        ...state,
        coverPhotoId: state.coverPhotoId === action.id ? null : action.id,
      };
    case "SET_COVER_PHOTO_ID":
      return { ...state, coverPhotoId: action.id };
    case "SET_COVER_TITLE":
      return {
        ...state,
        coverTitle: action.value,
        coverTitleEdited: action.markEdited ?? state.coverTitleEdited,
      };
    case "SET_COVER_SUBTITLE":
      return { ...state, coverSubtitle: action.value };
    case "MARK_COVER_TITLE_EDITED":
      return { ...state, coverTitleEdited: action.value };
    case "SET_JOURNAL_ID":
      return { ...state, currentJournalId: action.id };
    case "SET_SHARE":
      return { ...state, shareSlug: action.slug, isPublic: action.isPublic };
    case "SET_SAVE_STATUS":
      return { ...state, saveStatus: action.value };
    case "SET_QUICK_GENERATING":
      return { ...state, quickGenerating: action.value };
    case "SET_GEN_PROGRESS":
      return { ...state, genProgress: action.value };
    case "DISMISS_SOFT_CAP":
      return { ...state, softCapDismissed: true };
    case "DISMISS_BRIEF_NUDGE":
      return { ...state, briefNudgeDismissed: true };
    case "RESET_SOFT_CAP_DISMISSAL":
      return { ...state, softCapDismissed: false };
    case "RESET_BRIEF_NUDGE_DISMISSAL":
      return { ...state, briefNudgeDismissed: false };
    case "LOAD_FROM_SAVED_STATE": {
      const s = action.saved;
      return {
        ...state,
        mode: s.mode,
        step: s.step,
        tripTitle: s.tripTitle,
        tripBrief: s.tripBrief,
        startDate: s.startDate ? new Date(s.startDate) : null,
        endDate: s.endDate ? new Date(s.endDate) : null,
        vk: s.visualStyleKey as VisualStyleKey,
        ws: s.wordStyle as WordStyleKey,
        len: (s.length as LengthKey) ?? "standard",
        genWs: (s.generationWordStyle as WordStyleKey | null) ?? null,
        genLen: (s.generationLength as LengthKey | null) ?? null,
        lo: s.layoutKey as LayoutKey,
        photos: s.photos as Photo[],
        coverPhotoId: typeof s.coverPhotoId === "number" ? s.coverPhotoId : null,
        coverTitle: s.coverTitle ?? "",
        coverSubtitle: s.coverSubtitle ?? "",
        coverTitleEdited: !!s.coverTitleEdited,
      };
    }
    case "LOAD_FROM_REMOTE": {
      const d = action.data;
      return {
        ...state,
        mode: d.mode,
        step: action.nextStep,
        tripTitle: d.tripTitle,
        tripBrief: d.tripBrief,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
        vk: d.visualStyle,
        ws: d.wordStyle,
        len: d.length,
        genWs: d.generationWordStyle,
        genLen: d.generationLength,
        lo: d.layout,
        photos: d.photos,
        coverPhotoId: typeof d.coverPhotoId === "number" ? d.coverPhotoId : null,
        coverTitle: d.coverTitle ?? "",
        coverSubtitle: d.coverSubtitle ?? "",
        coverTitleEdited: !!d.coverTitleEdited,
        currentJournalId: action.journalId,
      };
    }
    case "RESET":
      // Preserve nothing — full clean slate. Auth modal / toasts live in
      // page.tsx and are not part of journal state.
      return { ...INITIAL_JOURNAL_STATE };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context + provider
// ─────────────────────────────────────────────────────────────────────────────

interface JournalContextValue {
  state: JournalState;
  dispatch: Dispatch<JournalAction>;
  // Save-side handles the provider opens to the rest of the app.
  /** Reset the diff caches that drive the cloud-save layer. Called when the
   * signed-in user changes or after an explicit reset. */
  resetSaveCaches: () => void;
  /** Cloud-save callback fired after a successful Supabase write so the
   * landing-page journals grid can refresh. Set by page.tsx via setOnRefreshJournals. */
  setOnRefreshJournals: (fn: (() => void) | null) => void;
}

const JournalContext = createContext<JournalContextValue | null>(null);

interface JournalProviderProps {
  children: ReactNode;
}

export function JournalProvider({ children }: JournalProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_JOURNAL_STATE);
  const { user } = useAuth();

  // Refs for save coordination. Pulling these into the provider lets us
  // keep page.tsx free of save bookkeeping.
  const idbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cloud-save diff caches — used by the structural-vs-text-only branch in
  // the cloud save effect.
  const lastSavedPhotosRef = useRef<Photo[] | null>(null);
  const lastSavedCoverIdRef = useRef<number | string | null>(null);
  const remoteIdMapRef = useRef<Record<number, string>>({});
  const lastSavedUserIdRef = useRef<string | null>(null);

  const resetSaveCaches = useCallback(() => {
    lastSavedPhotosRef.current = null;
    lastSavedCoverIdRef.current = null;
    remoteIdMapRef.current = {};
  }, []);

  // Reset the diff caches when the signed-in user changes — a different
  // user has different remote photo ids, and the cache for one user must
  // never be applied against another user's journal.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== lastSavedUserIdRef.current) {
      lastSavedUserIdRef.current = uid;
      resetSaveCaches();
    }
  }, [user, resetSaveCaches]);

  // Page can register a callback that fires after a successful cloud save
  // (used to refresh the journals listing on the landing page).
  const [onRefreshJournals, setOnRefreshJournals] = useState<(() => void) | null>(null);

  // ── IDB auto-save (debounced 2s) ──
  // Gated only on mode !== null. A dispatch of LOAD_FROM_SAVED_STATE
  // sets mode and will trigger one redundant write of the just-loaded
  // state — harmless idempotent re-write. The previous appReady gate
  // was a tighter guard that lived in page.tsx; consolidating it here
  // means the provider doesn't need a "is the page ready" prop.
  useEffect(() => {
    if (state.mode === null) return;
    if (idbSaveTimer.current) clearTimeout(idbSaveTimer.current);
    idbSaveTimer.current = setTimeout(() => {
      const saved: SavedState = {
        mode: state.mode as "quick" | "full",
        step: state.step,
        tripTitle: state.tripTitle,
        tripBrief: state.tripBrief,
        startDate: state.startDate ? state.startDate.toISOString() : null,
        endDate: state.endDate ? state.endDate.toISOString() : null,
        visualStyleKey: state.vk,
        wordStyle: state.ws,
        length: state.len,
        generationWordStyle: state.genWs,
        generationLength: state.genLen,
        layoutKey: state.lo,
        photos: state.photos,
        coverPhotoId: state.coverPhotoId,
        coverTitle: state.coverTitle,
        coverSubtitle: state.coverSubtitle,
        coverTitleEdited: state.coverTitleEdited,
      };
      saveState(saved);
    }, 2000);
    return () => {
      if (idbSaveTimer.current) clearTimeout(idbSaveTimer.current);
    };
  }, [
    state.mode,
    state.step,
    state.tripTitle,
    state.tripBrief,
    state.startDate,
    state.endDate,
    state.vk,
    state.ws,
    state.len,
    state.genWs,
    state.genLen,
    state.lo,
    state.photos,
    state.coverPhotoId,
    state.coverTitle,
    state.coverSubtitle,
    state.coverTitleEdited,
  ]);

  // ── Cloud auto-save (debounced 2s, signed-in only) ──
  useEffect(() => {
    if (!user) return;
    if (state.quickGenerating) return; // don't churn during AI generation

    const data: JournalData = {
      id: state.currentJournalId,
      mode: (state.mode === "full" ? "full" : "quick") as "quick" | "full",
      tripTitle: state.tripTitle,
      tripBrief: state.tripBrief,
      startDate: state.startDate ? state.startDate.toISOString().slice(0, 10) : null,
      endDate: state.endDate ? state.endDate.toISOString().slice(0, 10) : null,
      visualStyle: state.vk,
      wordStyle: state.ws,
      length: state.len,
      generationWordStyle: state.genWs,
      generationLength: state.genLen,
      layout: state.lo,
      coverPhotoId: state.coverPhotoId,
      coverTitle: state.coverTitle,
      coverSubtitle: state.coverSubtitle,
      coverTitleEdited: state.coverTitleEdited,
      photos: state.photos,
    };

    if (isEmptyJournal(data)) return;

    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    dispatch({ type: "SET_SAVE_STATUS", value: "saving" });
    cloudSaveTimer.current = setTimeout(async () => {
      try {
        const journalId = await saveJournalMetadata(user.id, state.currentJournalId, data);
        if (!state.currentJournalId) {
          dispatch({ type: "SET_JOURNAL_ID", id: journalId });
        }

        const last = lastSavedPhotosRef.current;
        const coverChanged = lastSavedCoverIdRef.current !== data.coverPhotoId;
        const structuralChange =
          !last ||
          coverChanged ||
          last.length !== data.photos.length ||
          data.photos.some((p, i) => last[i]?.id !== p.id);

        if (structuralChange) {
          const map = await syncJournalPhotos(journalId, { ...data, id: journalId });
          remoteIdMapRef.current = map;
        } else {
          const dirty: Array<[number, PhotoTextFields]> = [];
          for (let i = 0; i < data.photos.length; i++) {
            const curr = data.photos[i];
            const prev = last![i];
            const fields: PhotoTextFields = {};
            if (curr.caption !== prev.caption) fields.caption = curr.caption || "";
            if (curr.notes !== prev.notes) fields.notes = curr.notes || "";
            if (curr.paragraph !== prev.paragraph) fields.paragraph = curr.paragraph || "";
            if (curr.aiCaption !== prev.aiCaption) fields.ai_caption = curr.aiCaption || "";
            if (curr.aiNotes !== prev.aiNotes) fields.ai_notes = curr.aiNotes || "";
            if (curr.aiParagraph !== prev.aiParagraph) fields.ai_paragraph = curr.aiParagraph || "";
            if (Object.keys(fields).length > 0) dirty.push([curr.id, fields]);
          }
          if (dirty.length > 0) {
            const results = await Promise.allSettled(
              dirty.map(([clientId, fields]) => {
                const remoteId = remoteIdMapRef.current[clientId];
                if (!remoteId) return Promise.reject(new Error("missing remote id"));
                return updatePhotoFields(remoteId, fields);
              }),
            );
            const anyMissingRemote = results.some(
              (r) => r.status === "rejected" && String((r.reason as Error)?.message).includes("missing remote id"),
            );
            if (anyMissingRemote) {
              const map = await syncJournalPhotos(journalId, { ...data, id: journalId });
              remoteIdMapRef.current = map;
            } else {
              const firstFailure = results.find((r) => r.status === "rejected");
              if (firstFailure && firstFailure.status === "rejected") throw firstFailure.reason;
            }
          }
        }

        lastSavedPhotosRef.current = data.photos;
        lastSavedCoverIdRef.current = data.coverPhotoId;

        dispatch({ type: "SET_SAVE_STATUS", value: "saved" });
        if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
        savedFlashTimer.current = setTimeout(() => dispatch({ type: "SET_SAVE_STATUS", value: "idle" }), 2000);

        if (onRefreshJournals) onRefreshJournals();
      } catch (err) {
        console.error("Cloud save failed:", err);
        dispatch({ type: "SET_SAVE_STATUS", value: "offline" });
        if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
        savedFlashTimer.current = setTimeout(() => dispatch({ type: "SET_SAVE_STATUS", value: "idle" }), 3000);
      }
    }, 2000);

    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    state.tripTitle,
    state.tripBrief,
    state.startDate,
    state.endDate,
    state.vk,
    state.ws,
    state.len,
    state.genWs,
    state.genLen,
    state.lo,
    state.coverPhotoId,
    state.coverTitle,
    state.coverSubtitle,
    state.coverTitleEdited,
    state.photos,
    state.currentJournalId,
    state.quickGenerating,
  ]);

  // Reset dismissals when conditions go out of band
  useEffect(() => {
    if (state.photos.length <= 20 && state.softCapDismissed) {
      dispatch({ type: "RESET_SOFT_CAP_DISMISSAL" });
    }
  }, [state.photos.length, state.softCapDismissed]);

  const value: JournalContextValue = useMemo(
    () => ({ state, dispatch, resetSaveCaches, setOnRefreshJournals }),
    [state, resetSaveCaches],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error("useJournal must be used inside a <JournalProvider>");
  }
  return ctx;
}
