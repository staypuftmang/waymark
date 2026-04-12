"use client";

interface AiButtonProps {
  onClick: () => void;
  loading: boolean;
  label?: string;
  small?: boolean;
}

export default function AiButton({ onClick, loading, label, small }: AiButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1 border border-accent text-accent font-semibold font-body whitespace-nowrap"
      style={{
        padding: small ? "3px 8px" : "5px 12px",
        borderRadius: 3,
        fontSize: small ? 10 : 11,
        background: "transparent",
        cursor: loading ? "wait" : "pointer",
      }}
    >
      {loading ? "\u2026" : `\u2726 ${label || "Rewrite"}`}
    </button>
  );
}
