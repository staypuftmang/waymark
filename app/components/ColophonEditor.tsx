"use client";

import { useState } from "react";
import { useJournal } from "@/app/context/JournalContext";
import { COLOPHON_MAX_ITEMS, type ColophonItem } from "@/app/lib/types";
import { ConfirmModal } from "./ui";

/**
 * Editor card for the trip-details colophon. Lives in the journal
 * editing UI (preview/edit screen). Pulls the colophon from journal
 * context and dispatches edits back. Disabled-state collapses to
 * just the title + Enable toggle; mirrors the design exactly.
 *
 * Date sync: rows tagged syncTo: "dates" trigger a confirmation
 * dialog when their value changes. Confirm → write through; cancel
 * → revert to the previous value. Confirm also clears the trip's
 * start/end dates so the cover no longer auto-displays a date that
 * disagrees with the new colophon text. The user can then set
 * coverSubtitle manually if they want a different cover date.
 */
export default function ColophonEditor() {
  const { state, dispatch } = useJournal();
  const colophon = state.colophon;
  const [pendingDateEdit, setPendingDateEdit] = useState<{
    id: string;
    next: string;
    previous: string;
  } | null>(null);

  if (!colophon) return null;

  const sortedItems = [...colophon.items].sort((a, b) => a.order - b.order);
  const atCap = sortedItems.length >= COLOPHON_MAX_ITEMS;

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "var(--color-stone)",
    marginBottom: 5,
    fontFamily: "var(--font-body)",
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    color: "var(--color-ink)",
    background: "transparent",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    padding: "7px 10px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    padding: "8px 10px",
    resize: "vertical",
    minHeight: 60,
    lineHeight: 1.6,
  };

  const handleItemValueChange = (item: ColophonItem, next: string) => {
    if (item.syncTo === "dates" && next.trim() !== item.value.trim()) {
      // Defer the actual write until the user confirms — the input field
      // shows the previous value while the modal is open. Storing the
      // pending value lets us restore it if they cancel.
      setPendingDateEdit({ id: item.id, next, previous: item.value });
      return;
    }
    dispatch({ type: "UPDATE_COLOPHON_ITEM", id: item.id, field: "value", value: next });
  };

  const confirmDateEdit = () => {
    if (!pendingDateEdit) return;
    dispatch({
      type: "UPDATE_COLOPHON_ITEM",
      id: pendingDateEdit.id,
      field: "value",
      value: pendingDateEdit.next,
    });
    // Clear the trip's start/end dates so the cover no longer derives a
    // date that contradicts the colophon. coverSubtitle remains intact.
    dispatch({ type: "SET_START_DATE", value: null });
    dispatch({ type: "SET_END_DATE", value: null });
    setPendingDateEdit(null);
  };

  const cancelDateEdit = () => setPendingDateEdit(null);

  const Toggle = ({ on, onChange, ariaLabel }: { on: boolean; onChange: () => void; ariaLabel: string }) => (
    <button
      type="button"
      onClick={onChange}
      aria-label={ariaLabel}
      aria-pressed={on}
      className="cursor-pointer border-none p-0"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? "var(--color-accent)" : "var(--color-border)",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: "#fff",
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          transition: "left 0.15s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          display: "block",
        }}
      />
    </button>
  );

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: colophon.enabled ? 20 : 0,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "var(--font-title)",
    fontSize: 22,
    fontWeight: 300,
    color: "var(--color-ink)",
  };

  return (
    <>
      <div
        className="bg-card border border-border"
        style={{
          borderRadius: 5,
          padding: 24,
          marginTop: 24,
          fontFamily: "var(--font-body)",
        }}
      >
        <div style={headerStyle}>
          <span style={titleStyle}>Trip details</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_COLOPHON_ENABLED", enabled: !colophon.enabled })}
            className="cursor-pointer border-none bg-transparent flex items-center"
            style={{ gap: 8, padding: 0 }}
          >
            <span style={{ fontSize: 12, color: "var(--color-stone)" }}>
              {colophon.enabled ? "Remove all" : "Enable"}
            </span>
            <Toggle
              on={colophon.enabled}
              onChange={() => dispatch({ type: "SET_COLOPHON_ENABLED", enabled: !colophon.enabled })}
              ariaLabel={colophon.enabled ? "Disable colophon" : "Enable colophon"}
            />
          </button>
        </div>

        {colophon.enabled && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Pull quote</label>
              <textarea
                style={textareaStyle}
                value={colophon.pullQuote}
                onChange={(e) => dispatch({ type: "SET_COLOPHON_PULL_QUOTE", value: e.target.value })}
              />
            </div>

            <div style={{ height: 1, background: "var(--color-border)", margin: "16px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sortedItems.map((row) => (
                <div
                  key={row.id}
                  className="wm-colophon-row-edit"
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    opacity: row.visible ? 1 : 0.4,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <div style={{ paddingTop: 22, flexShrink: 0 }}>
                    <Toggle
                      on={row.visible}
                      onChange={() => dispatch({ type: "TOGGLE_COLOPHON_ITEM", id: row.id })}
                      ariaLabel={row.visible ? "Hide row" : "Show row"}
                    />
                  </div>
                  <div
                    className="wm-colophon-fields"
                    style={{ flex: 1, display: "flex", flexDirection: "row", gap: 10 }}
                  >
                    <div style={{ flex: "0 0 160px" }}>
                      <label style={labelStyle}>Label</label>
                      <input
                        style={inputStyle}
                        value={row.label}
                        placeholder="Label"
                        onChange={(e) => dispatch({
                          type: "UPDATE_COLOPHON_ITEM",
                          id: row.id,
                          field: "label",
                          value: e.target.value,
                        })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Value</label>
                      <input
                        style={inputStyle}
                        value={row.value}
                        placeholder="Value"
                        onChange={(e) => handleItemValueChange(row, e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "REMOVE_COLOPHON_ITEM", id: row.id })}
                    aria-label="Remove row"
                    title="Remove row"
                    className="cursor-pointer bg-transparent border-none"
                    style={{
                      marginTop: 22,
                      padding: 4,
                      color: "var(--color-stone)",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: "ADD_COLOPHON_ITEM" })}
              disabled={atCap}
              title={atCap ? `Maximum of ${COLOPHON_MAX_ITEMS} items reached` : "Add a new detail row"}
              className="cursor-pointer"
              style={{
                marginTop: 16,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: atCap ? "var(--color-warm)" : "var(--color-accent)",
                background: "transparent",
                border: "1px dashed var(--color-border)",
                borderRadius: 4,
                padding: "8px 14px",
                width: "100%",
                opacity: atCap ? 0.55 : 1,
                cursor: atCap ? "not-allowed" : "pointer",
              }}
            >
              {atCap ? `Max ${COLOPHON_MAX_ITEMS} details` : "+ Add detail"}
            </button>

            <div style={{ height: 1, background: "var(--color-border)", margin: "16px 0" }} />

            <div>
              <label style={labelStyle}>Closing line</label>
              <input
                style={inputStyle}
                value={colophon.closingLine}
                onChange={(e) => dispatch({ type: "SET_COLOPHON_CLOSING", value: e.target.value })}
              />
            </div>
          </>
        )}
      </div>

      {pendingDateEdit && (
        <ConfirmModal
          title="Update cover date too?"
          body="This will also update your journal cover date. The trip's start and end dates will be cleared. Continue?"
          confirmLabel="Update"
          cancelLabel="Cancel"
          onConfirm={confirmDateEdit}
          onCancel={cancelDateEdit}
        />
      )}

      <style jsx>{`
        @media (max-width: 500px) {
          .wm-colophon-fields {
            flex-direction: column !important;
          }
          .wm-colophon-fields > div {
            flex: auto !important;
          }
        }
      `}</style>
    </>
  );
}
