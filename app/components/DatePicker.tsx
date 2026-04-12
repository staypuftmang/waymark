"use client";

import { useState } from "react";
import { MONTHS, daysInMonth, formatDate } from "@/app/lib/constants";

interface DatePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartChange: (d: Date | null) => void;
  onEndChange: (d: Date | null) => void;
}

export default function DatePicker({ startDate, endDate, onStartChange, onEndChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<"start" | "end">("start");
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const daysCount = daysInMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysCount; i++) cells.push(i);

  const pick = (d: number) => {
    const dt = new Date(viewYear, viewMonth, d);
    if (sel === "start") {
      onStartChange(dt);
      if (endDate && dt > endDate) onEndChange(null);
      setSel("end");
    } else {
      if (startDate && dt < startDate) {
        onStartChange(dt);
        onEndChange(null);
        setSel("end");
      } else {
        onEndChange(dt);
        setSel("start");
        setOpen(false);
      }
    }
  };

  const inRange = (d: number | null) =>
    d !== null && startDate && endDate && new Date(viewYear, viewMonth, d) > startDate && new Date(viewYear, viewMonth, d) < endDate;
  const isStart = (d: number | null) =>
    d !== null && startDate && new Date(viewYear, viewMonth, d).toDateString() === startDate.toDateString();
  const isEnd = (d: number | null) =>
    d !== null && endDate && new Date(viewYear, viewMonth, d).toDateString() === endDate.toDateString();

  const label = startDate
    ? endDate
      ? `${formatDate(startDate)} \u2014 ${formatDate(endDate)}`
      : `${formatDate(startDate)} \u2014 select end`
    : "Select dates...";

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="relative">
      <div
        className="w-full border border-border bg-card font-body cursor-pointer flex items-center gap-2"
        style={{ padding: "11px 14px", borderRadius: 5, fontSize: 14 }}
        onClick={() => { setOpen(!open); setSel("start"); }}
      >
        <span className="opacity-40" style={{ fontSize: 13 }}>&#x1F4C5;</span>
        <span style={{ color: startDate ? "var(--color-ink)" : "var(--color-warm)" }}>{label}</span>
      </div>

      {open && (
        <div
          className="absolute z-50 bg-card border border-border"
          style={{
            top: "calc(100% + 4px)",
            left: 0,
            borderRadius: 5,
            boxShadow: "0 8px 30px rgba(0,0,0,.12)",
            padding: 16,
            width: 300,
          }}
        >
          <div className="flex justify-between items-center mb-2.5">
            <button onClick={prevMonth} className="bg-transparent border-none cursor-pointer text-stone" style={{ fontSize: 16 }}>
              &#x2039;
            </button>
            <span className="font-semibold" style={{ fontSize: 13 }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="bg-transparent border-none cursor-pointer text-stone" style={{ fontSize: 16 }}>
              &#x203A;
            </button>
          </div>

          <div className="flex mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((x) => (
              <div key={x} className="text-warm font-bold text-center" style={{ width: "14.28%", fontSize: 9 }}>
                {x}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap">
            {cells.map((d, i) => (
              <div key={i} style={{ width: "14.28%", textAlign: "center", padding: 1 }}>
                {d ? (
                  <button
                    onClick={() => pick(d)}
                    className="border-none cursor-pointer"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: isStart(d) || isEnd(d) ? 16 : inRange(d) ? 0 : 16,
                      fontSize: 12,
                      fontWeight: isStart(d) || isEnd(d) ? 700 : 400,
                      background: isStart(d) || isEnd(d) ? "var(--color-accent)" : inRange(d) ? "rgba(154,52,18,.1)" : "transparent",
                      color: isStart(d) || isEnd(d) ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    {d}
                  </button>
                ) : (
                  <div style={{ width: 32, height: 32 }} />
                )}
              </div>
            ))}
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { onStartChange(null); onEndChange(null); setSel("start"); }}
              className="w-full bg-transparent border-none text-warm cursor-pointer"
              style={{ marginTop: 6, padding: 4, fontSize: 10 }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
