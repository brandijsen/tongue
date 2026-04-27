"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  addMonths,
  buildMonthCellDays,
  labelText,
  NEWS_DATE_MONTHS as MONTHS,
  NEWS_DATE_WEEKDAYS as WEEKDAYS,
  parseYmd,
  toYmd,
} from "@/lib/newsDatePickerCalendar";
import { CalendarIcon, ChevronLeft, ChevronRight } from "./NewsDatePickerIcons";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
};

export function NewsDatePicker({ value, onChange, disabled }: Props) {
  const textId = useId();
  const triggerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = value ? parseYmd(value) : null;
  const [viewY, setViewY] = useState(() => {
    const t = new Date();
    return parsed?.y ?? t.getFullYear();
  });
  const [viewM, setViewM] = useState(() => {
    const t = new Date();
    return parsed?.m ?? t.getMonth();
  });

  const syncViewToValue = useCallback(() => {
    if (parsed) {
      setViewY(parsed.y);
      setViewM(parsed.m);
    } else {
      const t = new Date();
      setViewY(t.getFullYear());
      setViewM(t.getMonth());
    }
  }, [parsed]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      syncViewToValue();
    });
    return () => cancelAnimationFrame(id);
  }, [open, syncViewToValue]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = buildMonthCellDays(viewY, viewM);

  function selectDay(d: number) {
    onChange(toYmd(viewY, viewM, d));
    setOpen(false);
  }

  function goToday() {
    const t = new Date();
    onChange(toYmd(t.getFullYear(), t.getMonth(), t.getDate()));
    setViewY(t.getFullYear());
    setViewM(t.getMonth());
    setOpen(false);
  }

  function prevMonth() {
    const n = addMonths(viewY, viewM, -1);
    setViewY(n.y);
    setViewM(n.m);
  }

  function nextMonth() {
    const n = addMonths(viewY, viewM, 1);
    setViewY(n.y);
    setViewM(n.m);
  }

  const tDay = new Date();
  const todayY = tDay.getFullYear();
  const todayM = tDay.getMonth();
  const todayD = tDay.getDate();

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-2">
      <span
        id={textId}
        className="min-w-0 text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        {labelText(value)}
      </span>
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? "Chiudi calendario" : "Apri calendario"}
        aria-describedby={textId}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white text-tongue-ai shadow-sm ring-1 ring-black/5 transition-[border-color,box-shadow,ring] hover:border-tongue-ai/50 hover:shadow-md focus:border-tongue-ai focus:outline-none focus:ring-2 focus:ring-tongue-ai/30 disabled:cursor-default disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10 dark:hover:border-tongue-ai/50 dark:focus:ring-tongue-ai/35"
      >
        <CalendarIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Calendario — ${MONTHS[viewM]} ${viewY}`}
          className="absolute left-0 bottom-full z-60 mb-1.5 w-[min(100vw-1.5rem,14.5rem)] rounded-xl border border-zinc-200 bg-white p-2 shadow-lg ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/10"
        >
          <div className="mb-1.5 flex items-center justify-between gap-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-transparent text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              aria-label="Mese precedente"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="min-w-0 flex-1 px-0.5 text-center text-xs font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
              {MONTHS[viewM]} {viewY}
            </p>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-transparent text-zinc-600 transition-colors hover:border-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              aria-label="Mese successivo"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0 text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-0.5 grid grid-cols-7 gap-0">
            {cells.map((day, i) => {
              if (day == null) {
                return <div key={`e-${i}`} className="h-7" />;
              }
              const ymd = toYmd(viewY, viewM, day);
              const isSelected = value === ymd;
              const isToday =
                viewY === todayY && viewM === todayM && day === todayD;
              return (
                <button
                  type="button"
                  key={ymd}
                  onClick={() => selectDay(day)}
                  className={
                    "relative flex h-7 w-full cursor-pointer items-center justify-center rounded-md text-xs font-medium transition-colors " +
                    (isSelected
                      ? "bg-tongue-ai text-white shadow-sm"
                      : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
                  }
                >
                  {isToday && !isSelected && (
                    <span
                      className="absolute inset-0.5 rounded-sm ring-1 ring-tongue-ai/50 ring-inset"
                      aria-hidden
                    />
                  )}
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 flex justify-end border-t border-zinc-200 pt-1.5 dark:border-zinc-700">
            <button
              type="button"
              onClick={goToday}
              className="cursor-pointer text-[10px] font-medium text-tongue-ai underline-offset-2 hover:underline"
            >
              Oggi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
