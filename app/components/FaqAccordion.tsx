"use client";

import { useState, useEffect, useRef } from "react";

interface FaqItem {
  id?: string;
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const idx = items.findIndex((it) => it.id === hash);
      if (idx === -1) return;
      setOpenIdx(idx);
      const el = itemRefs.current[idx];
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [items]);

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            id={item.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            style={{
              borderBottom: "1px solid var(--color-border)",
              scrollMarginTop: 80,
            }}
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full text-left bg-transparent border-none cursor-pointer font-body"
              style={{
                width: "100%",
                padding: "18px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                fontSize: 15,
                fontWeight: 600,
                color: "var(--color-ink)",
              }}
            >
              <span>{item.q}</span>
              <span
                aria-hidden
                style={{
                  fontSize: 18,
                  color: "var(--color-stone)",
                  transition: "transform 0.2s ease",
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                  flexShrink: 0,
                }}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div
                className="font-body"
                style={{
                  padding: "0 0 18px",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--color-warm)",
                }}
              >
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
