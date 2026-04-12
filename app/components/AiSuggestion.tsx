"use client";

interface AiSuggestionProps {
  text: string;
  onClear: () => void;
  onAccept?: () => void;
}

export default function AiSuggestion({ text, onClear, onAccept }: AiSuggestionProps) {
  if (!text) return null;

  return (
    <div
      className="mt-1"
      style={{
        background: "rgba(154,52,18,.04)",
        border: "1px solid rgba(154,52,18,.15)",
        borderRadius: 5,
        padding: "8px 10px",
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      <div className="flex justify-between items-center mb-1">
        <span
          className="text-accent font-bold uppercase"
          style={{ fontSize: 9, letterSpacing: 1 }}
        >
          &#x2726; Suggestion
        </span>
        <div className="flex gap-1">
          {onAccept && (
            <button
              onClick={onAccept}
              className="bg-accent text-white border-none font-semibold cursor-pointer"
              style={{ borderRadius: 3, padding: "2px 10px", fontSize: 10 }}
            >
              Accept
            </button>
          )}
          <button
            onClick={onClear}
            className="bg-transparent border-none cursor-pointer text-warm"
            style={{ fontSize: 11 }}
          >
            &#x2715;
          </button>
        </div>
      </div>
      <div className="text-ink">{text}</div>
    </div>
  );
}
