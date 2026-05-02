import { describe, expect, it } from "vitest";
import { reducer, INITIAL_JOURNAL_STATE, type JournalState } from "../JournalContext";
import type { Photo } from "@/app/lib/types";
import type { SavedState } from "@/app/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    src: "data:image/jpeg;base64,xxx",
    caption: "",
    notes: "",
    paragraph: "",
    aiCaption: "",
    aiNotes: "",
    aiParagraph: "",
    ...overrides,
  };
}

function makeSavedState(overrides: Partial<SavedState> = {}): SavedState {
  return {
    mode: "quick",
    step: 0,
    tripTitle: "Patagonia trip",
    tripBrief: "Two weeks in the south",
    startDate: "2026-05-01T00:00:00.000Z",
    endDate: "2026-05-14T00:00:00.000Z",
    visualStyleKey: "polaroid",
    wordStyle: "narrative",
    length: "detailed",
    generationWordStyle: "poetic",
    generationLength: "standard",
    layoutKey: "magazine",
    photos: [makePhoto({ id: 7, caption: "Mountain pass" })],
    coverPhotoId: 7,
    coverTitle: "Patagonia",
    coverSubtitle: "May 2026",
    coverTitleEdited: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer — trip metadata", () => {
  it("SET_TITLE updates title only", () => {
    const next = reducer(INITIAL_JOURNAL_STATE, { type: "SET_TITLE", value: "New title" });
    expect(next.tripTitle).toBe("New title");
    expect(next.tripBrief).toBe(INITIAL_JOURNAL_STATE.tripBrief);
  });

  it("SET_BRIEF updates brief", () => {
    const next = reducer(INITIAL_JOURNAL_STATE, { type: "SET_BRIEF", value: "A long brief" });
    expect(next.tripBrief).toBe("A long brief");
  });

  it("SET_START_DATE / SET_END_DATE accept Date and null", () => {
    const d = new Date("2026-05-01T00:00:00Z");
    const a = reducer(INITIAL_JOURNAL_STATE, { type: "SET_START_DATE", value: d });
    expect(a.startDate).toBe(d);
    const b = reducer(a, { type: "SET_END_DATE", value: null });
    expect(b.endDate).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer — photos", () => {
  it("ADD_PHOTOS appends to existing array", () => {
    const start: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      photos: [makePhoto({ id: 1 })],
    };
    const next = reducer(start, { type: "ADD_PHOTOS", photos: [makePhoto({ id: 2 }), makePhoto({ id: 3 })] });
    expect(next.photos).toHaveLength(3);
    expect(next.photos.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("REMOVE_PHOTO drops the targeted photo", () => {
    const start: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      photos: [makePhoto({ id: 1 }), makePhoto({ id: 2 }), makePhoto({ id: 3 })],
    };
    const next = reducer(start, { type: "REMOVE_PHOTO", id: 2 });
    expect(next.photos.map((p) => p.id)).toEqual([1, 3]);
  });

  it("REMOVE_PHOTO clears the cover assignment if the cover photo is removed", () => {
    const start: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      photos: [makePhoto({ id: 1 }), makePhoto({ id: 2 })],
      coverPhotoId: 2,
    };
    const next = reducer(start, { type: "REMOVE_PHOTO", id: 2 });
    expect(next.coverPhotoId).toBeNull();
  });

  it("REMOVE_PHOTO leaves the cover alone if a non-cover photo is removed", () => {
    const start: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      photos: [makePhoto({ id: 1 }), makePhoto({ id: 2 })],
      coverPhotoId: 2,
    };
    const next = reducer(start, { type: "REMOVE_PHOTO", id: 1 });
    expect(next.coverPhotoId).toBe(2);
  });

  it("REORDER_PHOTOS replaces the array in the new order", () => {
    const a = makePhoto({ id: 1 });
    const b = makePhoto({ id: 2 });
    const c = makePhoto({ id: 3 });
    const start: JournalState = { ...INITIAL_JOURNAL_STATE, photos: [a, b, c] };
    const next = reducer(start, { type: "REORDER_PHOTOS", photos: [c, a, b] });
    expect(next.photos.map((p) => p.id)).toEqual([3, 1, 2]);
  });

  it("UPDATE_PHOTO_FIELD updates only the matching photo + field", () => {
    const start: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      photos: [
        makePhoto({ id: 1, caption: "old" }),
        makePhoto({ id: 2, caption: "untouched" }),
      ],
    };
    const next = reducer(start, {
      type: "UPDATE_PHOTO_FIELD",
      id: 1,
      field: "caption",
      value: "new",
    });
    expect(next.photos[0].caption).toBe("new");
    expect(next.photos[1].caption).toBe("untouched");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Style + cover
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer — style and cover", () => {
  it("SET_VK / SET_WS / SET_LEN / SET_LO update the right field", () => {
    const a = reducer(INITIAL_JOURNAL_STATE, { type: "SET_VK", value: "polaroid" });
    expect(a.vk).toBe("polaroid");
    const b = reducer(a, { type: "SET_WS", value: "witty" });
    expect(b.ws).toBe("witty");
    const c = reducer(b, { type: "SET_LEN", value: "detailed" });
    expect(c.len).toBe("detailed");
    const d = reducer(c, { type: "SET_LO", value: "magazine" });
    expect(d.lo).toBe("magazine");
  });

  it("SET_GEN_SNAPSHOT writes the (ws, len) pair atomically", () => {
    const next = reducer(INITIAL_JOURNAL_STATE, {
      type: "SET_GEN_SNAPSHOT",
      ws: "minimal",
      len: "brief",
    });
    expect(next.genWs).toBe("minimal");
    expect(next.genLen).toBe("brief");
  });

  it("TOGGLE_COVER sets the cover and clears it on a second tap", () => {
    const a = reducer(INITIAL_JOURNAL_STATE, { type: "TOGGLE_COVER", id: 5 });
    expect(a.coverPhotoId).toBe(5);
    const b = reducer(a, { type: "TOGGLE_COVER", id: 5 });
    expect(b.coverPhotoId).toBeNull();
  });

  it("SET_COVER_TITLE optionally marks the title as user-edited", () => {
    const a = reducer(INITIAL_JOURNAL_STATE, {
      type: "SET_COVER_TITLE",
      value: "X",
      markEdited: true,
    });
    expect(a.coverTitle).toBe("X");
    expect(a.coverTitleEdited).toBe(true);

    // Without markEdited the flag is preserved (auto-sync from tripTitle path).
    const b = reducer(INITIAL_JOURNAL_STATE, {
      type: "SET_COVER_TITLE",
      value: "Y",
    });
    expect(b.coverTitle).toBe("Y");
    expect(b.coverTitleEdited).toBe(INITIAL_JOURNAL_STATE.coverTitleEdited);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bulk loads + reset
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer — bulk loads", () => {
  it("LOAD_FROM_SAVED_STATE restores every field from the snapshot", () => {
    const saved = makeSavedState();
    const next = reducer(INITIAL_JOURNAL_STATE, { type: "LOAD_FROM_SAVED_STATE", saved });
    expect(next.tripTitle).toBe(saved.tripTitle);
    expect(next.tripBrief).toBe(saved.tripBrief);
    expect(next.startDate).toEqual(new Date(saved.startDate!));
    expect(next.endDate).toEqual(new Date(saved.endDate!));
    expect(next.vk).toBe(saved.visualStyleKey);
    expect(next.ws).toBe(saved.wordStyle);
    expect(next.len).toBe(saved.length);
    expect(next.genWs).toBe(saved.generationWordStyle);
    expect(next.genLen).toBe(saved.generationLength);
    expect(next.lo).toBe(saved.layoutKey);
    expect(next.photos).toEqual(saved.photos);
    expect(next.coverPhotoId).toBe(saved.coverPhotoId);
    expect(next.coverTitle).toBe(saved.coverTitle);
    expect(next.coverSubtitle).toBe(saved.coverSubtitle);
    expect(next.coverTitleEdited).toBe(saved.coverTitleEdited);
  });

  it("LOAD_FROM_SAVED_STATE handles missing optional fields", () => {
    const minimal: SavedState = {
      mode: "quick",
      step: 0,
      tripTitle: "T",
      tripBrief: "",
      startDate: null,
      endDate: null,
      visualStyleKey: "editorial",
      wordStyle: "poetic",
      // length, generationWordStyle, generationLength, cover* all missing
      layoutKey: "classic",
      photos: [],
    };
    const next = reducer(INITIAL_JOURNAL_STATE, { type: "LOAD_FROM_SAVED_STATE", saved: minimal });
    expect(next.len).toBe("standard"); // defaults
    expect(next.genWs).toBeNull();
    expect(next.genLen).toBeNull();
    expect(next.coverPhotoId).toBeNull();
    expect(next.coverTitle).toBe("");
    expect(next.coverTitleEdited).toBe(false);
  });

  it("RESET returns the initial state", () => {
    const dirty: JournalState = {
      ...INITIAL_JOURNAL_STATE,
      tripTitle: "X",
      photos: [makePhoto()],
      coverPhotoId: 1,
      currentJournalId: "abc",
    };
    const next = reducer(dirty, { type: "RESET" });
    expect(next).toEqual(INITIAL_JOURNAL_STATE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Immutability
// ─────────────────────────────────────────────────────────────────────────────

describe("reducer — immutability", () => {
  it("returns a new state object on every action that mutates", () => {
    const start = { ...INITIAL_JOURNAL_STATE, photos: [makePhoto({ id: 1 })] };

    const cases: Array<readonly [string, JournalState]> = [
      ["SET_TITLE", reducer(start, { type: "SET_TITLE", value: "x" })],
      ["ADD_PHOTOS", reducer(start, { type: "ADD_PHOTOS", photos: [makePhoto({ id: 2 })] })],
      ["REMOVE_PHOTO", reducer(start, { type: "REMOVE_PHOTO", id: 1 })],
      ["UPDATE_PHOTO_FIELD", reducer(start, { type: "UPDATE_PHOTO_FIELD", id: 1, field: "caption", value: "y" })],
      ["SET_VK", reducer(start, { type: "SET_VK", value: "polaroid" })],
      ["SET_WS", reducer(start, { type: "SET_WS", value: "witty" })],
      ["SET_LEN", reducer(start, { type: "SET_LEN", value: "brief" })],
      ["SET_LO", reducer(start, { type: "SET_LO", value: "filmstrip" })],
      ["TOGGLE_COVER", reducer(start, { type: "TOGGLE_COVER", id: 1 })],
      ["RESET", reducer(start, { type: "RESET" })],
    ];

    for (const [name, next] of cases) {
      expect(next, `${name} should not return the same reference`).not.toBe(start);
    }
  });

  it("does not mutate the photos array in place on UPDATE_PHOTO_FIELD", () => {
    const original = [makePhoto({ id: 1, caption: "a" })];
    const start: JournalState = { ...INITIAL_JOURNAL_STATE, photos: original };
    const next = reducer(start, { type: "UPDATE_PHOTO_FIELD", id: 1, field: "caption", value: "b" });
    expect(next.photos).not.toBe(original);
    expect(original[0].caption).toBe("a"); // unchanged
  });
});
