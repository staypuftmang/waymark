const DB_NAME = "waymark-db";
const STORE_NAME = "journals";
const KEY = "current";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface SavedState {
  mode: "quick" | "full";
  step: number;
  tripTitle: string;
  tripBrief: string;
  startDate: string | null; // ISO string
  endDate: string | null;   // ISO string
  visualStyleKey: string;
  wordStyle: string;
  layoutKey: string;
  photos: Array<{
    id: number;
    src: string;
    caption: string;
    notes: string;
    paragraph: string;
    aiCaption: string;
    aiNotes: string;
    aiParagraph: string;
  }>;
  // Cover photo (all optional — fall back if missing from older saves)
  coverPhotoId?: number | null;
  coverTitle?: string;
  coverSubtitle?: string;
  coverTitleEdited?: boolean;
}

export async function saveState(state: SavedState): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(state, KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail — storage quota exceeded, incognito mode, etc.
  }
}

export async function loadState(): Promise<SavedState | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY);
    const result = await new Promise<SavedState | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    // Corrupted data or unavailable — start fresh
    return null;
  }
}

export async function clearState(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}
