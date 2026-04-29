"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            style={{
              borderBottom: "1px solid var(--color-border)",
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
