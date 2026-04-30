import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/app/components/SiteFooter";
import FaqAccordion from "@/app/components/FaqAccordion";
import FeedbackInlineTrigger from "@/app/components/FeedbackInlineTrigger";

export const metadata: Metadata = {
  title: "Help — Waymark",
  description: "Frequently asked questions about Waymark — how to upload photos, edit AI text, share journals, and more.",
};

const FAQS = [
  {
    id: "photo-count",
    q: "How many photos should I upload?",
    a: "Best with 5–20 photos. Soft cap is 20, hard cap is 30. Journals with more than 20 photos may be slower to generate.",
  },
  {
    id: "trip-story",
    q: "What is the trip story field for?",
    a: "It gives the AI context about your trip. You can write it yourself or use ✦ Describe my trip to auto-generate it from your photos.",
  },
  {
    id: "edit-ai-text",
    q: "Can I edit the AI-generated text?",
    a: "Yes — click any text in Edit mode to change it. You can also rewrite individual sections or all text at once.",
  },
  {
    id: "writing-style",
    q: "How do I change the writing style?",
    a: "Select a Voice option before generating. Each voice (Poetic, Minimal, Narrative, Witty, Raw) changes the tone of the AI writing.",
  },
  {
    id: "photo-privacy",
    q: "Are my photos private?",
    a: "Photos are analyzed by AI to write about them but are not stored permanently or shared. Only journals you explicitly make public are visible to others.",
  },
  {
    id: "share-journal",
    q: "How do I share my journal?",
    a: "Save your journal, then click the Share button to generate a public link anyone can view.",
  },
  {
    id: "download-journal",
    q: "Can I download my journal?",
    a: "Yes — tap the Download button to save a high-res PNG image of your full journal.",
  },
  {
    id: "save-journal",
    q: "How do I save my journal?",
    a: "Sign up for a free account. Your journal saves to your dashboard so you can come back anytime.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-paper font-body">
      <div
        className="sticky top-0 z-[100] flex items-center justify-between"
        style={{ background: "var(--color-ink)", padding: "16px 24px" }}
      >
        <Link
          href="/"
          className="font-title"
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "var(--color-paper)",
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.9,
            textDecoration: "none",
          }}
        >
          Waymark
        </Link>
      </div>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <h1
          className="font-title"
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "var(--color-ink)",
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          Frequently Asked Questions
        </h1>
        <p
          className="text-stone"
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 36,
          }}
        >
          Quick answers to the things people ask us most. Can&apos;t find what you&apos;re looking for? Send us a message — we read every one.
        </p>

        <FaqAccordion items={FAQS} />

        <div
          style={{
            marginTop: 56,
            padding: "32px 24px",
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          <h2
            className="font-title"
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: "var(--color-ink)",
              marginBottom: 8,
            }}
          >
            Still have questions?
          </h2>
          <p
            className="text-stone"
            style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}
          >
            We read every message and reply when we can.
          </p>
          <FeedbackInlineTrigger />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
