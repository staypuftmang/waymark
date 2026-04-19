"use client";

import { useCallback, useRef, useState } from "react";
import { Photo } from "./types";

export interface ContentSnapshot {
  tripTitle: string;
  tripBrief: string;
  startDate: string | null; // ISO
  endDate: string | null; // ISO
  photos: Photo[];
  coverPhotoId: number | null;
}

const MAX_HISTORY = 20;

export interface HistoryApi {
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Content-only undo/redo. Caller provides a `getSnapshot` that reads current
 * content state and an `applySnapshot` that writes it back. History is capped
 * at MAX_HISTORY entries; a new action clears the redo stack. When `locked`
 * is true (e.g. during AI generation), save/undo/redo are no-ops.
 */
export function useHistory(
  getSnapshot: () => ContentSnapshot,
  applySnapshot: (s: ContentSnapshot) => void,
  locked: boolean,
): HistoryApi {
  const [history, setHistory] = useState<ContentSnapshot[]>([]);
  const [future, setFuture] = useState<ContentSnapshot[]>([]);

  const getRef = useRef(getSnapshot);
  getRef.current = getSnapshot;
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const saveToHistory = useCallback(() => {
    if (lockedRef.current) return;
    const snap = getRef.current();
    setHistory((prev) => {
      const next = [...prev, snap];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (lockedRef.current) return;
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      const current = getRef.current();
      setFuture((f) => [...f, current]);
      applyRef.current(previous);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    if (lockedRef.current) return;
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      const current = getRef.current();
      setHistory((h) => [...h, current]);
      applyRef.current(next);
      return prev.slice(0, -1);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setFuture([]);
  }, []);

  return {
    saveToHistory,
    undo,
    redo,
    clearHistory,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}
