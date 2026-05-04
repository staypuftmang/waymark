"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useJournal } from "@/app/context/JournalContext";
import { COLOPHON_MAX_ITEMS, type ColophonItem } from "@/app/lib/types";
import { formatDate } from "@/app/lib/constants";
import DatePicker from "./DatePicker";

/**
 * Editor card for the trip-details colophon. Lives at the bottom of the
 * Review & Refine page (Quick step 10) and Photos & Notes (Full step 1).
 * Pulls the colophon from journal context and dispatches edits back.
 * Disabled state collapses to just the title + Enable toggle.
 *
 * Date sync: rows tagged syncTo: "dates" render the same DatePicker used
 * at the start of the journal-creation flow, bound directly to the trip's
 * start/end dates. There's no separate "value" string for those rows —
 * the calendar is the only edit surface, so the action is intentional
 * and the cover updates automatically through the existing date pipeline.
 */
export default function ColophonEditor() {
  const { state, dispatch } = useJournal();
  const colophon = state.colophon;

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

  /** Format a (start, end) tuple the same way the cover does, so the
   *  rendered colophon and the cover always read the same range. */
  const formatRange = (start: Date | null, end: Date | null): string => {
    if (!start) return "";
    return end ? `${formatDate(start)} — ${formatDate(end)}` : formatDate(start);
  };

  /** Mirror state.startDate/endDate into the syncTo: "dates" row's stored
   *  value whenever the trip dates change. A useEffect (rather than
   *  dispatching from the picker callbacks) avoids the stale-closure bug
   *  that surfaced when DatePicker.pick() chains onStartChange +
   *  onEndChange in a single tick: each chained callback would have read
   *  state.startDate/endDate from the previous render and clobbered the
   *  field the other callback just set. By syncing in a render-after
   *  effect we read the final state once, no closures involved. */
  useEffect(() => {
    if (!colophon) return;
    const dateRow = colophon.items.find((it) => it.syncTo === "dates");
    if (!dateRow) return;
    const formatted = formatRange(state.startDate, state.endDate);
    if (dateRow.value !== formatted) {
      dispatch({
        type: "UPDATE_COLOPHON_ITEM",
        id: dateRow.id,
        field: "value",
        value: formatted,
      });
    }
    // colophon.items reference changes on every reducer update; using the
    // primitive dates as deps is enough to trigger the sync without
    // looping when this effect re-dispatches UPDATE_COLOPHON_ITEM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.startDate, state.endDate]);

  // ── Drag-reorder ────────────────────────────────────────────────────────
  // Identical sensor config to SortablePhotoList so touch + mouse behave
  // the same way across the app: pointer needs 5px drift before lift,
  // touch needs a 200ms hold so a quick tap on the value field doesn't
  // start a drag by accident.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedItems.findIndex((it) => it.id === active.id);
    const newIndex = sortedItems.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sortedItems, oldIndex, newIndex);
    dispatch({ type: "REORDER_COLOPHON_ITEMS", ids: next.map((it) => it.id) });
  };

  const handleDragCancel = () => setActiveDragId(null);

  const activeRow = activeDragId ? sortedItems.find((it) => it.id === activeDragId) ?? null : null;

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

  /** Grip-dots drag handle. Listeners + attributes are spread onto the
   * outer element so only this widget activates the drag — taps on the
   * toggle, inputs, or remove button never start a reorder. */
  const GripDots = ({
    handleProps,
    active,
    dimmed,
  }: {
    handleProps?: Record<string, unknown>;
    active?: boolean;
    dimmed?: boolean;
  }) => (
    <div
      {...(handleProps ?? {})}
      role="button"
      aria-label="Drag to reorder"
      tabIndex={0}
      style={{
        paddingTop: 22,
        flexShrink: 0,
        cursor: active ? "grabbing" : "grab",
        opacity: dimmed ? 0.25 : active ? 0.7 : 0.35,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        alignItems: "center",
        width: 12,
        // Stop the surrounding scroll container from claiming the touch
        // gesture before the sensor lifts off.
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", gap: 3 }}>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: active ? "var(--color-accent)" : "var(--color-stone)",
              display: "block",
            }}
          />
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: active ? "var(--color-accent)" : "var(--color-stone)",
              display: "block",
            }}
          />
        </div>
      ))}
    </div>
  );

  /** The label/value/toggle/remove block that's identical between a
   * static row and the row currently being dragged in the overlay. */
  const RowBody = ({ row }: { row: ColophonItem }) => (
    <>
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
          {row.syncTo === "dates" ? (
            // Same DatePicker as the journal-creation flow. Callbacks
            // dispatch ONLY the field that changed — DatePicker.pick()
            // sometimes chains onStartChange + onEndChange in one tick,
            // and reading the unchanged field from a closure here would
            // overwrite the just-dispatched value with stale state.
            // The colophon row's stored value re-syncs via the useEffect
            // above whenever startDate/endDate land.
            <DatePicker
              startDate={state.startDate}
              endDate={state.endDate}
              onStartChange={(d) => dispatch({ type: "SET_START_DATE", value: d })}
              onEndChange={(d) => dispatch({ type: "SET_END_DATE", value: d })}
            />
          ) : (
            <input
              style={inputStyle}
              value={row.value}
              placeholder="Value"
              onChange={(e) => dispatch({
                type: "UPDATE_COLOPHON_ITEM",
                id: row.id,
                field: "value",
                value: e.target.value,
              })}
            />
          )}
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
    </>
  );

  /** Sortable wrapper. Spread setNodeRef on the outer div for positioning
   * and wire setActivatorNodeRef + listeners ONLY to the GripDots so the
   * inputs and toggle stay clickable. The wrapper also reserves the
   * dragging slot's space (opacity 0.4) while the overlay carries the
   * visual ghost above the list. */
  const SortableRow = ({ row, isDragging }: { row: ColophonItem; isDragging: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
    } = useSortable({ id: row.id });

    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : row.visible ? 1 : 0.4,
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
    };

    const handleProps = {
      ref: setActivatorNodeRef,
      ...attributes,
      ...listeners,
    } as Record<string, unknown>;

    return (
      <div ref={setNodeRef} className="wm-colophon-row-edit" style={style}>
        <GripDots handleProps={handleProps} dimmed={!row.visible} />
        <RowBody row={row} />
      </div>
    );
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

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={sortedItems.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sortedItems.map((row) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      isDragging={activeDragId === row.id}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeRow ? (
                  <div
                    className="bg-card border border-border"
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      borderRadius: 5,
                      padding: "8px 10px",
                      borderColor: "var(--color-accent)",
                      boxShadow: "var(--shadow-drag)",
                      transform: "rotate(-1deg)",
                      // Inputs inside the overlay are non-interactive — the
                      // event happens on the live row underneath, then the
                      // ghost vanishes on drop.
                      pointerEvents: "none",
                    }}
                  >
                    <GripDots active />
                    <RowBody row={activeRow} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

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
