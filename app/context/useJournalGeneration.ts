"use client";

import { useCallback, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { useJournal } from "./JournalContext";
import { aiCall } from "@/app/lib/ai";
import {
  batchRewritePrompt,
  colophonGeneratePrompt,
  quickCreatePrompt,
  PREVIOUS_ENTRY_WINDOW,
  type PreviousEntry,
} from "@/app/lib/prompts";
import { cleanJson, formatDate } from "@/app/lib/constants";
import { DEFAULT_COLOPHON, type Colophon, type ColophonItem } from "@/app/lib/types";

/** Newly-generated colophon items get UUIDs so React keys + reorder work. */
function newColophonId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface GenerationResult {
  generated: number;
  cancelled: boolean;
}

export interface JournalGenerationApi {
  /** Run AI on every photo that has no AI content yet. Used for fresh
   * journal creation and for "Update Journal" with newly added photos. */
  generateMissingAi: (mode: "quick" | "full") => Promise<GenerationResult>;
  /** Re-run AI over every photo with content using current ws/len. Used by
   * the regenerate-on-settings-change confirmation. */
  regenerateAllAi: (mode: "quick" | "full") => Promise<GenerationResult>;
  /** Request the in-flight generation loop to stop after the current
   * photo's request resolves. */
  cancel: () => void;
  /** Whether the cancel button should be disabled (cooldown after click). */
  cancelDisabled: boolean;
  /** Formatted "May 1, 2026 — May 14, 2026" date range used in prompts
   * and in the cover hero. Computed from context dates. */
  dateDisplay: string;
  /** True when ws/len differ from the snapshot taken at last generation. */
  settingsChangedSinceGeneration: boolean;
  /** True when any photo already has AI content. */
  hasAnyAi: boolean;
}

/**
 * Hook that orchestrates AI generation against the journal context.
 *
 * The two flows (`generateMissingAi`, `regenerateAllAi`) are nearly
 * identical loops over photos with different prompt builders and target
 * filters; both write back via `dispatch` and bump the generation
 * snapshot on success.
 */
export function useJournalGeneration(): JournalGenerationApi {
  const { state, dispatch } = useJournal();

  // Cancel handshake: click sets the ref; the loop re-checks it before each
  // iteration and after each await. The disabled flag debounces clicks so
  // a double-tap doesn't immediately re-arm a fresh loop.
  const cancelRef = useRef(false);
  const [cancelDisabled, setCancelDisabled] = useState(false);

  const cancel = useCallback(() => {
    if (cancelDisabled) return;
    cancelRef.current = true;
    setCancelDisabled(true);
    setTimeout(() => setCancelDisabled(false), 800);
  }, [cancelDisabled]);

  const dateDisplay = state.startDate
    ? state.endDate
      ? `${formatDate(state.startDate)} — ${formatDate(state.endDate)}`
      : formatDate(state.startDate)
    : "";

  const hasAnyAi = state.photos.some(
    (p) => p.aiCaption || p.aiNotes || p.aiParagraph,
  );

  const settingsChangedSinceGeneration =
    hasAnyAi &&
    state.genWs !== null &&
    state.genLen !== null &&
    (state.ws !== state.genWs || state.len !== state.genLen);

  const generateMissingAi = useCallback(
    async (mode: "quick" | "full"): Promise<GenerationResult> => {
      const { photos, ws, vk, len, tripTitle, tripBrief, currentJournalId } = state;
      const missing = photos.filter(
        (p) => !(p.aiCaption || p.aiNotes || p.aiParagraph),
      );
      if (missing.length === 0) return { generated: 0, cancelled: false };

      cancelRef.current = false;
      dispatch({ type: "SET_QUICK_GENERATING", value: true });
      dispatch({ type: "SET_GEN_PROGRESS", value: { current: 0, total: missing.length } });
      track("ai_generated", {
        mode,
        photoCount: missing.length,
        wordStyle: ws,
        visualStyle: vk,
      });

      // Rolling window of completed entries (caption + paragraph excerpt).
      // Seeded from any photos that already have AI content so an Update
      // Journal run on a partially-generated journal still gets coherence
      // context for the new photos. Capped at PREVIOUS_ENTRY_WINDOW so the
      // prompt token cost stays bounded.
      const previousEntries: PreviousEntry[] = photos
        .filter((p) => p.aiCaption || p.aiParagraph)
        .map((p) => ({ caption: p.aiCaption || "", paragraph: p.aiParagraph || "" }))
        .slice(-PREVIOUS_ENTRY_WINDOW);

      const isFreshJournal = !hasAnyAi;
      let firstCallSent = false;
      let processed = 0;

      for (let i = 0; i < missing.length; i++) {
        if (cancelRef.current) break;
        dispatch({
          type: "SET_GEN_PROGRESS",
          value: { current: i + 1, total: missing.length },
        });
        const p = missing[i];
        const fullIdx = photos.findIndex((ph) => ph.id === p.id);
        const prompt = quickCreatePrompt(
          ws,
          tripTitle,
          tripBrief,
          dateDisplay,
          fullIdx >= 0 ? fullIdx : i,
          photos.length,
          previousEntries,
          len,
        );
        let opts: Parameters<typeof aiCall>[2];
        if (isFreshJournal) {
          opts = firstCallSent
            ? { actionType: "rewrite_batch_photo", journalId: currentJournalId, record: false }
            : { actionType: "journal_created", journalId: currentJournalId };
          firstCallSent = true;
        } else {
          opts = { actionType: "rewrite_batch_photo", journalId: currentJournalId };
        }
        const raw = await aiCall(prompt, p.src, opts);
        if (cancelRef.current) break;
        if (raw) {
          try {
            const obj = JSON.parse(cleanJson(raw));
            if (obj.caption) {
              dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiCaption", value: obj.caption });
            }
            if (obj.notes) {
              dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiNotes", value: obj.notes });
            }
            if (obj.paragraph) {
              dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiParagraph", value: obj.paragraph });
            }
            if (obj.caption || obj.paragraph) {
              previousEntries.push({ caption: obj.caption ?? "", paragraph: obj.paragraph ?? "" });
              if (previousEntries.length > PREVIOUS_ENTRY_WINDOW) previousEntries.shift();
            }
          } catch (e) {
            console.error(e);
          }
        }
        processed++;
      }

      const cancelled = cancelRef.current;
      cancelRef.current = false;
      dispatch({ type: "SET_QUICK_GENERATING", value: false });
      dispatch({ type: "SET_GEN_PROGRESS", value: null });
      if (processed > 0 && !cancelled) {
        dispatch({ type: "SET_GEN_SNAPSHOT", ws, len });
      }

      // Colophon generation: one extra AI call after the narrative loop,
      // skipped if the loop was cancelled, no entries got AI text, or the
      // journal already has a colophon (Update-Journal flow shouldn't
      // overwrite the user's edits). record:false so it doesn't count
      // against the per-journal rewrite cap.
      const isFullyFreshGen = !cancelled && processed > 0 && !state.colophon;
      if (isFullyFreshGen) {
        // Pull narrative from the rolling window (truncated to ~3 most-
        // recent paragraphs) plus the captions of every just-generated
        // photo. This gives the colophon prompt enough material to surface
        // specific scenes without re-fetching state.
        const narrativePieces = previousEntries
          .map((e) => e.paragraph)
          .filter(Boolean)
          .join("\n\n");
        const cprompt = colophonGeneratePrompt(
          ws,
          tripTitle,
          tripBrief,
          dateDisplay,
          narrativePieces,
          photos.length,
        );
        const raw = await aiCall(cprompt, undefined, {
          actionType: "rewrite_batch_photo",
          journalId: currentJournalId,
          record: false,
        });
        if (raw) {
          try {
            const obj = JSON.parse(cleanJson(raw)) as {
              pullQuote?: string;
              closingLine?: string;
              items?: Array<{ label?: string; value?: string; syncTo?: string }>;
            };
            const items: ColophonItem[] = (obj.items ?? [])
              .slice(0, 7)
              .map((it, i) => ({
                id: newColophonId(),
                label: (it.label ?? "").trim(),
                value: (it.value ?? "").trim(),
                visible: true,
                order: i,
                ...(it.syncTo === "dates" ? { syncTo: "dates" as const } : {}),
              }))
              .filter((it) => it.label || it.value);
            const colophon: Colophon = {
              ...DEFAULT_COLOPHON,
              enabled: true,
              pullQuote: (obj.pullQuote ?? "").trim(),
              closingLine: (obj.closingLine ?? "").trim(),
              items,
            };
            dispatch({ type: "SET_COLOPHON", colophon });
          } catch (e) {
            console.warn("Colophon parse failed:", e);
          }
        }
      }

      return { generated: processed, cancelled };
    },
    [state, dispatch, dateDisplay, hasAnyAi],
  );

  const regenerateAllAi = useCallback(
    async (mode: "quick" | "full"): Promise<GenerationResult> => {
      const { photos, ws, vk, len, tripTitle, tripBrief, currentJournalId } = state;
      const targets = photos.filter(
        (p) => p.aiCaption || p.aiNotes || p.aiParagraph || p.caption || p.notes,
      );
      if (targets.length === 0) return { generated: 0, cancelled: false };

      cancelRef.current = false;
      dispatch({ type: "SET_QUICK_GENERATING", value: true });
      dispatch({ type: "SET_GEN_PROGRESS", value: { current: 0, total: targets.length } });
      track("ai_generated", {
        mode: `${mode}_regenerate`,
        photoCount: targets.length,
        wordStyle: ws,
        visualStyle: vk,
      });

      const previousEntries: PreviousEntry[] = [];
      let processed = 0;

      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        dispatch({
          type: "SET_GEN_PROGRESS",
          value: { current: i + 1, total: targets.length },
        });
        const p = targets[i];
        const capText = p.aiCaption || p.caption;
        const notesText = p.aiNotes || p.notes;
        const prompt = batchRewritePrompt(
          ws,
          tripTitle,
          tripBrief,
          dateDisplay,
          capText,
          notesText,
          previousEntries,
          len,
        );
        const raw = await aiCall(prompt, p.src, {
          actionType: "rewrite_batch_photo",
          journalId: currentJournalId,
        });
        if (cancelRef.current) break;
        if (raw) {
          try {
            const obj = JSON.parse(cleanJson(raw));
            if (obj.caption) {
              dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiCaption", value: obj.caption });
            }
            // Brief asks for empty notes — clear any prior pull quote.
            dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiNotes", value: obj.notes ?? "" });
            if (obj.paragraph) {
              dispatch({ type: "UPDATE_PHOTO_FIELD", id: p.id, field: "aiParagraph", value: obj.paragraph });
            }
            if (obj.caption || obj.paragraph) {
              previousEntries.push({ caption: obj.caption ?? "", paragraph: obj.paragraph ?? "" });
              if (previousEntries.length > PREVIOUS_ENTRY_WINDOW) previousEntries.shift();
            }
          } catch (e) {
            console.error(e);
          }
        }
        processed++;
      }

      const cancelled = cancelRef.current;
      cancelRef.current = false;
      dispatch({ type: "SET_QUICK_GENERATING", value: false });
      dispatch({ type: "SET_GEN_PROGRESS", value: null });
      if (processed > 0 && !cancelled) {
        dispatch({ type: "SET_GEN_SNAPSHOT", ws, len });
      }
      return { generated: processed, cancelled };
    },
    [state, dispatch, dateDisplay],
  );

  return {
    generateMissingAi,
    regenerateAllAi,
    cancel,
    cancelDisabled,
    dateDisplay,
    settingsChangedSinceGeneration,
    hasAnyAi,
  };
}
