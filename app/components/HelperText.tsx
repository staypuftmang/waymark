"use client";

export default function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--color-stone)",
        lineHeight: 1.5,
        marginTop: 4,
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </div>
  );
}
