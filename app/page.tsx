"use client";

import { useState, useRef, useCallback } from "react";
import { Photo, VisualStyleKey, WordStyleKey, LayoutKey, Mode } from "@/app/lib/types";
import { VS, WS, LO, formatDate, cleanJson } from "@/app/lib/constants";
import { aiCall } from "@/app/lib/ai";
import DatePicker from "@/app/components/DatePicker";
import PhotoCard from "@/app/components/PhotoCard";
import PhotoStyleRow from "@/app/components/PhotoStyleRow";
import StylePreview from "@/app/components/StylePreview";
import RewriteAll from "@/app/components/RewriteAll";
import JournalPreview from "@/app/components/JournalPreview";

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
function Header({ children, right }: { children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="sticky top-0 z-[100] flex items-center justify-between"
      style={{ background: "var(--color-ink)", padding: "16px 24px" }}
    >
      <div
        className="font-title"
        style={{
          fontSize: 15,
          fontWeight: 400,
          color: "var(--color-paper)",
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.9,
        }}
      >
        Waymark
      </div>
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

  const fullRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  const addPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setPhotos((p) => [
          ...p,
          {
            id: Date.now() + Math.random(),
            src: ev.target?.result as string,
            caption: "",
            notes: "",
            paragraph: "",
            aiCaption: "",
            aiNotes: "",
            aiParagraph: "",
          },
        ]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }, []);

  const updatePhoto = (id: number, field: string, value: string) =>
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const removePhoto = (id: number) => setPhotos((p) => p.filter((x) => x.id !== id));

  const movePhoto = (id: number, dir: number) =>
    setPhotos((p) => {
      const i = p.findIndex((x) => x.id === id);
      if ((dir === -1 && i === 0) || (dir === 1 && i === p.length - 1)) return p;
      const c = [...p];
      [c[i], c[i + dir]] = [c[i + dir], c[i]];
      return c;
    });

  const reset = () => {
    setMode(null);
    setStep(0);
    setPhotos([]);
    setTripTitle("");
    setTripBrief("");
    setStartDate(null);
    setEndDate(null);
  };

  const dateDisplay = startDate
    ? endDate
      ? `${formatDate(startDate)} \u2014 ${formatDate(endDate)}`
      : formatDate(startDate)
    : "";

  const ok = tripTitle.trim() && photos.length > 0;

  const quickGenerate = async () => {
    setQuickGenerating(true);
    const ctx = `Trip: "${tripTitle}"${tripBrief ? `\nBrief: "${tripBrief}"` : ""}${dateDisplay ? `\nDates: ${dateDisplay}` : ""}`;

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const prompt = `${WS[ws].sys}\n\nWrite content for photo ${i + 1}/${photos.length} in a travel journal.\n\n${ctx}\n\nGenerate unique content for this photo in the sequence.\n\nReturn ONLY JSON: {caption, notes, paragraph}\n- caption: 1 sentence\n- notes: 1-2 sentences\n- paragraph: 3-5 sentences\n\nJSON only, no markdown.`;

      const raw = await aiCall(prompt);
      if (raw) {
        try {
          const obj = JSON.parse(cleanJson(raw));
          if (obj.caption) updatePhoto(p.id, "aiCaption", obj.caption);
          if (obj.notes) updatePhoto(p.id, "aiNotes", obj.notes);
          if (obj.paragraph) updatePhoto(p.id, "aiParagraph", obj.paragraph);
        } catch (e) {
          console.error(e);
        }
      }
    }
    setQuickGenerating(false);
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

  return (
    <div className="min-h-screen bg-paper font-body">
      {/* ═══════════════ LANDING ═══════════════ */}
      {mode === null && (
        <div className="min-h-screen flex flex-col">
          <div style={{ padding: "20px 28px" }}>
            <div
              className="font-title"
              style={{ fontSize: 14, fontWeight: 400, letterSpacing: 2, textTransform: "uppercase", color: "var(--color-ink)" }}
            >
              Waymark
            </div>
          </div>

          <div className="flex-1 flex items-center" style={{ padding: "0 28px 60px" }}>
            <div style={{ maxWidth: 520 }}>
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
                  maxWidth: 380,
                }}
              >
                Upload your photos, tell your story, and let AI help you craft a journal worth keeping.
              </p>

              <div className="flex flex-col gap-2.5 animate-fade-up-3">
                {[
                  { m: "quick" as const, icon: "\u26A1", bg: "var(--color-accent)", t: "Quick Create", d: "Drop photos + story. AI does the rest." },
                  { m: "full" as const, icon: "\u270E", bg: "var(--color-ink)", t: "Full Builder", d: "Craft every detail yourself or with AI assistance." },
                ].map(({ m, icon, bg, t, d }) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setStep(0); }}
                    className="flex items-center gap-3.5 border border-border bg-card cursor-pointer text-left w-full"
                    style={{ padding: "16px 20px", borderRadius: 5, maxWidth: 380 }}
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

          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--color-border)" }}>
            <div className="text-warm uppercase" style={{ fontSize: 10, letterSpacing: 1.5 }}>
              Waymark &middot; 2026
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ QUICK CREATE ═══════════════ */}
      {mode === "quick" && step === 0 && (
        <div>
          <Header right={<HeaderBtn onClick={reset}>&#x2190; Home</HeaderBtn>} />
          <div style={contentStyle}>
            <h2 style={h2Style}>Quick Create</h2>
            <p style={subStyle}>Drop photos, tell your story, pick a style. AI writes the journal.</p>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Trip Title</label>
              <input style={iStyle} placeholder="e.g. Two Weeks in Patagonia" value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Timeframe</label>
              <DatePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Your Story</label>
              <textarea
                style={{ ...iStyle, resize: "vertical", minHeight: 120, lineHeight: 1.65 }}
                placeholder="Tell the story of this trip..."
                value={tripBrief}
                onChange={(e) => setTripBrief(e.target.value)}
              />
            </div>

            <div style={dropStyle} onClick={() => quickRef.current?.click()}>
              <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.4 }}>&#x2191;</div>
              <div className="font-semibold text-ink" style={{ fontSize: 13 }}>Upload photos</div>
              <input ref={quickRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
            </div>

            {photos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="text-stone" style={{ fontSize: 12, marginBottom: 8 }}>
                  {photos.length} photo{photos.length > 1 ? "s" : ""}
                </div>
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
                <div className="flex gap-1 flex-wrap">
                  {(Object.entries(VS) as [VisualStyleKey, typeof VS[VisualStyleKey]][]).map(([k, s]) => (
                    <button key={k} onClick={() => setVk(k)} style={chip(vk === k)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Voice</label>
                <div className="flex gap-1 flex-wrap">
                  {(Object.entries(WS) as [WordStyleKey, typeof WS[WordStyleKey]][]).map(([k, w]) => (
                    <button key={k} onClick={() => setWs(k)} style={chip(ws === k)}>{w.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <label style={{ ...labelStyle, marginTop: 16, marginBottom: 8 }}>Layout</label>
            <div className="grid grid-cols-5 gap-1.5">
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
          <Header right={<HeaderBtn onClick={() => setStep(0)}>&#x2190; Back</HeaderBtn>} />
          <div style={contentStyle}>
            <h2 style={h2Style}>Review & Refine</h2>
            <p style={subStyle}>AI has written your journal. Review, edit, or regenerate below.</p>

            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
              <RewriteAll photos={photos} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} />
            </div>

            <div className="grid gap-2" style={{ marginBottom: 14 }}>
              {photos.map((p) => (
                <PhotoStyleRow key={p.id} photo={p} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} />
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
        <Header>
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
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Timeframe</label>
            <DatePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Trip Brief</label>
            <textarea
              style={{ ...iStyle, resize: "vertical", minHeight: 100, lineHeight: 1.65 }}
              placeholder="The vibe, what made it special."
              value={tripBrief}
              onChange={(e) => setTripBrief(e.target.value)}
            />
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
            <input ref={fullRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
          </div>

          <div className="grid gap-2.5" style={{ marginTop: 16 }}>
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
              <StylePreview key={k} styleKey={k} style={s} selected={vk === k} onClick={() => setVk(k)} />
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

          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
            <RewriteAll photos={photos} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} />
          </div>

          <div className="grid gap-2" style={{ marginBottom: 8 }}>
            {photos.map((p) => (
              <PhotoStyleRow key={p.id} photo={p} onUpdate={updatePhoto} title={tripTitle} brief={tripBrief} wordStyle={ws} dateDisplay={dateDisplay} />
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
          setVisualStyleKey={setVk}
          setLayoutKey={setLo}
        />
      )}
    </div>
  );
}
