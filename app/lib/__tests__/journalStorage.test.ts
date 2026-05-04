import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Photo } from "@/app/lib/types";
import type { JournalData } from "@/app/lib/journalStorage";

// ─────────────────────────────────────────────────────────────────────────────
// Mock the lazy supabase proxy. We replace `from(table)` with a chainable
// fluent stub configured per test via `mockSupabaseResponse`.
// ─────────────────────────────────────────────────────────────────────────────

interface MockResponse {
  data?: unknown;
  error?: unknown;
}

let nextResponses: MockResponse[] = [];

function setNextResponses(...responses: MockResponse[]) {
  nextResponses = [...responses];
}

function makeChain() {
  // Every chain method returns the same chain so calls compose.
  // The terminal awaits (single, returns) consume the next queued response.
  const chain: Record<string, unknown> = {};
  const passthrough = ["select", "eq", "order", "update", "insert", "delete", "match"];
  for (const m of passthrough) {
    chain[m] = vi.fn(() => chain);
  }
  chain.returns = vi.fn(() => Promise.resolve(nextResponses.shift() ?? { data: [] }));
  chain.single = vi.fn(() => Promise.resolve(nextResponses.shift() ?? { data: null }));
  chain.maybeSingle = vi.fn(() => Promise.resolve(nextResponses.shift() ?? { data: null }));
  // For .insert(...).select() that resolves directly without .single():
  // make the chain itself thenable so `await` consumes a response.
  chain.then = (resolve: (r: MockResponse) => unknown) => {
    return Promise.resolve(nextResponses.shift() ?? { data: [], error: null }).then(resolve);
  };
  return chain;
}

vi.mock("@/app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => makeChain()),
  },
}));

// Now import the module under test — after the mock is registered.
import {
  journalToFields,
  loadJournal,
  isEmptyJournal,
} from "@/app/lib/journalStorage";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
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

function makeJournalData(overrides: Partial<JournalData> = {}): JournalData {
  return {
    id: null,
    mode: "quick",
    tripTitle: "Patagonia",
    tripBrief: "Two weeks south",
    startDate: "2026-05-01",
    endDate: "2026-05-14",
    visualStyle: "polaroid",
    wordStyle: "narrative",
    length: "detailed",
    generationWordStyle: "poetic",
    generationLength: "standard",
    layout: "magazine",
    coverPhotoId: 1,
    coverTitle: "Patagonia",
    coverSubtitle: "May 2026",
    coverTitleEdited: true,
    photos: [makePhoto()],
    colophon: null,
    ...overrides,
  };
}

beforeEach(() => {
  nextResponses = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// journalToFields
// ─────────────────────────────────────────────────────────────────────────────

describe("journalToFields", () => {
  it("maps every JournalData field to the matching DB column", () => {
    const data = makeJournalData();
    const fields = journalToFields(data);
    expect(fields).toEqual({
      title: "Patagonia",
      mode: "quick",
      trip_brief: "Two weeks south",
      start_date: "2026-05-01",
      end_date: "2026-05-14",
      visual_style: "polaroid",
      word_style: "narrative",
      length: "detailed",
      generation_word_style: "poetic",
      generation_length: "standard",
      layout: "magazine",
      // cover_photo_id is intentionally always null — is_cover on the
      // journal_photos row is the source of truth for cover selection.
      cover_photo_id: null,
      cover_title: "Patagonia",
      cover_subtitle: "May 2026",
      cover_title_edited: true,
      colophon: null,
    });
  });

  it("does NOT serialize cover_photo_id even when one is set", () => {
    const data = makeJournalData({ coverPhotoId: 7 });
    const fields = journalToFields(data);
    expect(fields.cover_photo_id).toBeNull();
  });

  it("preserves null gen-snapshot fields", () => {
    const data = makeJournalData({
      generationWordStyle: null,
      generationLength: null,
    });
    const fields = journalToFields(data);
    expect(fields.generation_word_style).toBeNull();
    expect(fields.generation_length).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isEmptyJournal
// ─────────────────────────────────────────────────────────────────────────────

describe("isEmptyJournal", () => {
  it("is true when title, brief, and photos are all empty", () => {
    expect(
      isEmptyJournal(
        makeJournalData({ tripTitle: "", tripBrief: "", photos: [] }),
      ),
    ).toBe(true);
  });

  it("is true when title and brief are whitespace only", () => {
    expect(
      isEmptyJournal(
        makeJournalData({ tripTitle: "   ", tripBrief: "\n", photos: [] }),
      ),
    ).toBe(true);
  });

  it("is false when there is a title", () => {
    expect(
      isEmptyJournal(makeJournalData({ tripTitle: "X", tripBrief: "", photos: [] })),
    ).toBe(false);
  });

  it("is false when there is a brief", () => {
    expect(
      isEmptyJournal(makeJournalData({ tripTitle: "", tripBrief: "Y", photos: [] })),
    ).toBe(false);
  });

  it("is false when there are photos", () => {
    expect(
      isEmptyJournal(
        makeJournalData({ tripTitle: "", tripBrief: "", photos: [makePhoto()] }),
      ),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loadJournal — mocked Supabase response
// ─────────────────────────────────────────────────────────────────────────────

describe("loadJournal", () => {
  it("reconstructs JournalData from journals + journal_photos rows", async () => {
    setNextResponses(
      // First call: journals .select().eq().single()
      {
        data: {
          id: "j-1",
          title: "Patagonia",
          mode: "quick",
          trip_brief: "Two weeks south",
          start_date: "2026-05-01",
          end_date: "2026-05-14",
          visual_style: "polaroid",
          word_style: "narrative",
          length: "detailed",
          generation_word_style: "poetic",
          generation_length: "standard",
          layout: "magazine",
          cover_photo_id: null,
          cover_title: "Patagonia",
          cover_subtitle: "May 2026",
          cover_title_edited: true,
        },
      },
      // Second call: journal_photos .select().eq().order().returns()
      {
        data: [
          {
            id: "p-uuid-1",
            src: "data:image/jpeg;base64,one",
            caption: "first",
            notes: "n1",
            paragraph: "p1",
            ai_caption: "ai1",
            ai_notes: "ain1",
            ai_paragraph: "aip1",
            is_cover: false,
            photo_order: 0,
          },
          {
            id: "p-uuid-2",
            src: "data:image/jpeg;base64,two",
            caption: "second",
            notes: null,
            paragraph: null,
            ai_caption: null,
            ai_notes: null,
            ai_paragraph: null,
            is_cover: true,
            photo_order: 1,
          },
        ],
      },
    );

    const loaded = await loadJournal("j-1");
    expect(loaded.data.id).toBe("j-1");
    expect(loaded.data.tripTitle).toBe("Patagonia");
    expect(loaded.data.length).toBe("detailed");
    expect(loaded.data.generationWordStyle).toBe("poetic");
    expect(loaded.data.photos).toHaveLength(2);
    expect(loaded.data.photos[0].caption).toBe("first");
    // Null DB fields → empty strings on the client
    expect(loaded.data.photos[1].notes).toBe("");
    expect(loaded.data.photos[1].aiCaption).toBe("");
    // Cover selection comes from is_cover, not cover_photo_id
    expect(loaded.data.coverPhotoId).toBe(loaded.data.photos[1].id);
    // Remote-id map should reverse-look the UUID by client id
    expect(loaded.photoRemoteIds[loaded.data.photos[0].id]).toBe("p-uuid-1");
    expect(loaded.photoRemoteIds[loaded.data.photos[1].id]).toBe("p-uuid-2");
  });

  it("falls back to defaults when DB columns are null/empty", async () => {
    setNextResponses(
      {
        data: {
          id: "j-2",
          title: null,
          mode: null,
          trip_brief: null,
          start_date: null,
          end_date: null,
          visual_style: "",
          word_style: "",
          length: "",
          generation_word_style: null,
          generation_length: null,
          layout: "",
          cover_photo_id: null,
          cover_title: null,
          cover_subtitle: null,
          cover_title_edited: false,
        },
      },
      { data: [] },
    );

    const { data } = await loadJournal("j-2");
    expect(data.tripTitle).toBe("");
    expect(data.tripBrief).toBe("");
    expect(data.mode).toBe("quick"); // null → quick (the non-"full" branch)
    expect(data.visualStyle).toBe("editorial");
    expect(data.wordStyle).toBe("poetic");
    expect(data.length).toBe("standard");
    expect(data.layout).toBe("classic");
    expect(data.generationWordStyle).toBeNull();
    expect(data.coverPhotoId).toBeNull();
    expect(data.coverTitle).toBe("");
    expect(data.photos).toEqual([]);
  });

  it("returns coverPhotoId === null when no photo has is_cover", async () => {
    setNextResponses(
      {
        data: {
          id: "j-3",
          title: "X",
          mode: "quick",
          trip_brief: "",
          start_date: null,
          end_date: null,
          visual_style: "editorial",
          word_style: "poetic",
          length: "standard",
          generation_word_style: null,
          generation_length: null,
          layout: "classic",
          cover_photo_id: null,
          cover_title: "",
          cover_subtitle: "",
          cover_title_edited: false,
        },
      },
      {
        data: [
          {
            id: "p-1",
            src: "x",
            caption: null, notes: null, paragraph: null,
            ai_caption: null, ai_notes: null, ai_paragraph: null,
            is_cover: false,
            photo_order: 0,
          },
        ],
      },
    );

    const { data } = await loadJournal("j-3");
    expect(data.photos).toHaveLength(1);
    expect(data.coverPhotoId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe("journalToFields ↔ loadJournal round-trip", () => {
  it("a journal serialised through journalToFields and revived through loadJournal returns equivalent data", async () => {
    const original = makeJournalData({
      coverPhotoId: 2, // photo at order=1 below should be the cover
      photos: [
        makePhoto({ id: 1, caption: "first" }),
        makePhoto({ id: 2, caption: "second" }),
      ],
    });
    const fields = journalToFields(original);

    // Build a fake row from the persisted fields and feed it to loadJournal.
    setNextResponses(
      {
        data: {
          id: "round-trip",
          title: fields.title,
          mode: fields.mode,
          trip_brief: fields.trip_brief,
          start_date: fields.start_date,
          end_date: fields.end_date,
          visual_style: fields.visual_style,
          word_style: fields.word_style,
          length: fields.length,
          generation_word_style: fields.generation_word_style,
          generation_length: fields.generation_length,
          layout: fields.layout,
          cover_photo_id: fields.cover_photo_id,
          cover_title: fields.cover_title,
          cover_subtitle: fields.cover_subtitle,
          cover_title_edited: fields.cover_title_edited,
        },
      },
      {
        data: [
          // Mirror the photo order from the original; cover assignment comes
          // from is_cover, derived from coverPhotoId === photo.id.
          {
            id: "remote-1",
            src: original.photos[0].src,
            caption: original.photos[0].caption,
            notes: original.photos[0].notes,
            paragraph: original.photos[0].paragraph,
            ai_caption: original.photos[0].aiCaption,
            ai_notes: original.photos[0].aiNotes,
            ai_paragraph: original.photos[0].aiParagraph,
            is_cover: original.coverPhotoId === original.photos[0].id,
            photo_order: 0,
          },
          {
            id: "remote-2",
            src: original.photos[1].src,
            caption: original.photos[1].caption,
            notes: original.photos[1].notes,
            paragraph: original.photos[1].paragraph,
            ai_caption: original.photos[1].aiCaption,
            ai_notes: original.photos[1].aiNotes,
            ai_paragraph: original.photos[1].aiParagraph,
            is_cover: original.coverPhotoId === original.photos[1].id,
            photo_order: 1,
          },
        ],
      },
    );

    const { data } = await loadJournal("round-trip");
    expect(data.tripTitle).toBe(original.tripTitle);
    expect(data.tripBrief).toBe(original.tripBrief);
    expect(data.startDate).toBe(original.startDate);
    expect(data.endDate).toBe(original.endDate);
    expect(data.visualStyle).toBe(original.visualStyle);
    expect(data.wordStyle).toBe(original.wordStyle);
    expect(data.length).toBe(original.length);
    expect(data.generationWordStyle).toBe(original.generationWordStyle);
    expect(data.generationLength).toBe(original.generationLength);
    expect(data.layout).toBe(original.layout);
    expect(data.coverTitle).toBe(original.coverTitle);
    expect(data.coverSubtitle).toBe(original.coverSubtitle);
    expect(data.coverTitleEdited).toBe(original.coverTitleEdited);
    expect(data.photos).toHaveLength(original.photos.length);
    // Photo client ids are reassigned 1..N on load, so cover lookup uses
    // the new client id. The second photo was the cover, so coverPhotoId
    // should resolve to the second loaded photo's id.
    expect(data.coverPhotoId).toBe(data.photos[1].id);
  });
});
