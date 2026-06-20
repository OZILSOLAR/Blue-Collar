"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";

export interface Slot {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  startTime: string;
  endTime: string;
}

interface Props {
  availability: Slot[];
  editable?: boolean;
  onAdd?: (slot: Slot) => void;
  onRemove?: (dayOfWeek: number) => void;
  onBulkSet?: (slots: Slot[]) => void;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function inRange(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const t = date.getTime();
  return t > start.getTime() && t < end.getTime();
}

export default function AvailabilityCalendar({
  availability,
  editable = false,
  onAdd,
  onRemove,
  onBulkSet,
}: Props) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Editable mode state
  const [showSlotEditor, setShowSlotEditor] = useState(false);
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");

  const availableDays = useMemo(() => new Set(availability.map((s) => s.dayOfWeek)), [availability]);
  const slotMap = useMemo(
    () => Object.fromEntries(availability.map((s) => [s.dayOfWeek, s])),
    [availability]
  );

  const toggleBulkDay = useCallback((day: number) => {
    setBulkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const handleBulkApply = useCallback(() => {
    if (bulkDays.length === 0 || !onBulkSet) return;
    const slots = bulkDays.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: bulkStart,
      endTime: bulkEnd,
    }));
    onBulkSet(slots);
    setBulkDays([]);
    setShowSlotEditor(false);
  }, [bulkDays, bulkStart, bulkEnd, onBulkSet]);

  const handleSelectWeekdays = useCallback(() => {
    setBulkDays([1, 2, 3, 4, 5]);
  }, []);

  const handleSelectAll = useCallback(() => {
    setBulkDays([0, 1, 2, 3, 4, 5, 6]);
  }, []);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleDayClick(date: Date) {
    if (!availableDays.has(date.getDay())) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
    } else {
      if (date < rangeStart) {
        setRangeStart(date);
        setRangeEnd(null);
      } else {
        setRangeEnd(date);
      }
    }
  }

  const selectedSlot = rangeStart ? slotMap[rangeStart.getDay()] : null;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Availability</h3>
        <span className="text-xs text-gray-400">{tz}</span>
      </div>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded p-1 hover:bg-gray-100" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} className="rounded p-1 hover:bg-gray-100" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_LABELS.map((d) => (
          <span key={d} className="text-xs font-medium text-gray-400">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((date, i) => {
          if (!date) return <span key={i} />;

          const dow = date.getDay();
          const isAvailable = availableDays.has(dow);
          const isPast = date < today && !isSameDay(date, today);
          const isStart = rangeStart && isSameDay(date, rangeStart);
          const isEnd = rangeEnd && isSameDay(date, rangeEnd);
          const isInRange = inRange(date, rangeStart, rangeEnd);
          const isToday = isSameDay(date, today);

          let cls = "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ";
          if (isPast) {
            cls += "text-gray-300 cursor-not-allowed";
          } else if (isStart || isEnd) {
            cls += "bg-blue-600 text-white font-semibold cursor-pointer";
          } else if (isInRange && isAvailable) {
            cls += "bg-blue-100 text-blue-700 cursor-pointer";
          } else if (isAvailable) {
            cls += "bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer font-medium";
          } else {
            cls += "text-gray-400 cursor-not-allowed";
          }
          if (isToday && !isStart && !isEnd) cls += " ring-1 ring-blue-400";

          return (
            <div key={i} className={isInRange ? "bg-blue-50 rounded" : ""}>
              <button
                onClick={() => !isPast && handleDayClick(date)}
                disabled={isPast || !isAvailable}
                className={cls}
                aria-label={`${date.getDate()} ${MONTH_NAMES[month]}`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-green-100 border border-green-300" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-100 border border-gray-300" />
          Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
          Selected
        </span>
      </div>

      {/* Slot editor for editable mode */}
      {editable && (
        <div className="mt-4 space-y-3">
          {/* Current slots list */}
          {availability.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600">Current schedule</p>
              {availability
                .slice()
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((slot) => (
                  <div
                    key={slot.dayOfWeek}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700 w-24">
                        {DAY_FULL[slot.dayOfWeek]}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock size={12} />
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove?.(slot.dayOfWeek)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${DAY_FULL[slot.dayOfWeek]}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Bulk set toggle */}
          {!showSlotEditor ? (
            <button
              onClick={() => setShowSlotEditor(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors w-full justify-center"
            >
              <Plus size={14} />
              Set availability
            </button>
          ) : (
            <div className="rounded-lg border bg-blue-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">
                Bulk set availability
              </p>

              {/* Day selector */}
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Select days</span>
                  <button
                    type="button"
                    onClick={handleSelectWeekdays}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    All
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleBulkDay(i)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        bulkDays.includes(i)
                          ? "bg-blue-600 text-white"
                          : "bg-white border text-gray-600 hover:border-blue-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Start time</label>
                  <select
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">End time</label>
                  <select
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBulkApply}
                  disabled={bulkDays.length === 0}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Apply to {bulkDays.length} day{bulkDays.length !== 1 ? "s" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSlotEditor(false); setBulkDays([]); }}
                  className="rounded-lg border bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selection summary (read-only mode) */}
      {!editable && rangeStart && (
        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {rangeEnd ? (
            <p>
              <span className="font-medium">
                {rangeStart.toLocaleDateString()} – {rangeEnd.toLocaleDateString()}
              </span>
              {" "}selected
              {" "}
              <button
                onClick={() => { setRangeStart(null); setRangeEnd(null); }}
                className="ml-2 text-xs text-blue-500 underline"
              >
                Clear
              </button>
            </p>
          ) : (
            <p>
              <span className="font-medium">{rangeStart.toLocaleDateString()}</span>
              {" "}— select an end date
            </p>
          )}
          {selectedSlot && (
            <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
              <Clock size={12} />
              {selectedSlot.startTime} – {selectedSlot.endTime}
            </p>
          )}
        </div>
      )}

      {availability.length === 0 && !editable && (
        <p className="mt-4 text-center text-xs text-gray-400 italic">
          No availability set for this worker.
        </p>
      )}
    </div>
  );
}
