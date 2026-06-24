"use client";

import { useEffect, useMemo, useState } from "react";
import { getJalaliMonthLength, getJalaliMonthStartOffset, getJalaliPickerParts, jalaliMonthNames, jalaliPickerPartsToIso, persianWeekdays, type JalaliPickerParts } from "../lib/jalali-picker";
import { Button } from "./ui/button";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatSchedule(parts: JalaliPickerParts | null) {
  if (!parts) return "انتخاب نشده";
  return `${parts.day} ${jalaliMonthNames[parts.month - 1]} ${parts.year}، ساعت ${pad(parts.hour)}:${pad(parts.minute)}`;
}

function sameDay(parts: JalaliPickerParts | null, year: number, month: number, day: number) {
  return Boolean(parts && parts.year === year && parts.month === month && parts.day === day);
}

type ComposerSchedulePanelProps = {
  scheduledAt: string | null;
  timezone: string;
  onChange: (value: string | null) => void;
};

export function ComposerSchedulePanel({ scheduledAt, timezone, onChange }: ComposerSchedulePanelProps) {
  const scheduleTimezone = timezone || "Asia/Tehran";
  const [draft, setDraft] = useState<JalaliPickerParts>(() => getJalaliPickerParts(scheduledAt, scheduleTimezone));
  const [open, setOpen] = useState(false);
  const hasSchedule = Boolean(scheduledAt);
  const selectedParts = hasSchedule ? getJalaliPickerParts(scheduledAt, scheduleTimezone) : null;
  const todayParts = getJalaliPickerParts(null, scheduleTimezone);
  const monthLength = getJalaliMonthLength(draft.year, draft.month);
  const startOffset = getJalaliMonthStartOffset(draft.year, draft.month);
  const dayCells = useMemo(() => [...Array.from({ length: startOffset }, () => null), ...Array.from({ length: monthLength }, (_, index) => index + 1)], [monthLength, startOffset]);

  useEffect(() => {
    setDraft(getJalaliPickerParts(scheduledAt, scheduleTimezone));
  }, [scheduleTimezone, scheduledAt]);

  function emit(next: JalaliPickerParts) {
    setDraft(next);
    const iso = jalaliPickerPartsToIso(next, scheduleTimezone);
    if (iso) onChange(iso);
  }

  function moveMonth(delta: number) {
    const absoluteMonth = draft.month + delta;
    const nextYear = draft.year + Math.floor((absoluteMonth - 1) / 12);
    const nextMonth = ((absoluteMonth - 1 + 240) % 12) + 1;
    const nextLength = getJalaliMonthLength(nextYear, nextMonth);
    setDraft({ ...draft, year: nextYear, month: nextMonth, day: Math.min(draft.day, nextLength) });
  }

  function changeTime(field: "hour" | "minute", value: string) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) emit({ ...draft, [field]: parsed });
  }

  function clearSchedule() {
    onChange(null);
    setDraft(getJalaliPickerParts(null, scheduleTimezone));
    setOpen(false);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`app-row flex w-full items-center justify-between gap-3 rounded-lg border bg-white p-3 text-right transition hover:bg-blue-50/40 ${
            open ? "border-blue-200 ring-2 ring-blue-100" : "border-app-border"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-xs font-black text-app-muted">زمان انتشار</span>
            <span className="mt-1 block truncate text-sm font-black text-app-text">{formatSchedule(selectedParts)}</span>
          </span>
          <span className={`rounded-md px-3 py-2 text-xs font-black ${hasSchedule ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-app-primary"}`}>
            {hasSchedule ? "تغییر" : "انتخاب"}
          </span>
        </button>

        {open ? (
          <div className="app-popover absolute bottom-full right-0 z-50 mb-2 w-[244px] rounded-lg border border-app-border bg-white p-2.5 shadow-lift">
            <div className="flex items-center justify-between gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => moveMonth(-1)}>قبل</Button>
              <div className="text-center">
                <p className="text-xs font-black text-app-text">{jalaliMonthNames[draft.month - 1]} {draft.year}</p>
                <p className="mt-0.5 text-[10px] text-app-muted">شمسی</p>
              </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => moveMonth(1)}>بعد</Button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[9px] font-black text-app-muted">
              {persianWeekdays.map((weekday) => <span key={weekday}>{weekday.slice(0, 1)}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-0.5">
              {dayCells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="h-7" />;
                const selected = sameDay(selectedParts, draft.year, draft.month, day);
                const today = sameDay(todayParts, draft.year, draft.month, day);
                const classes = selected ? "bg-app-primary text-white shadow-sm" : today ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-app-primary";
                return (
                  <button key={day} type="button" onClick={() => emit({ ...draft, day })} className={`h-7 rounded text-[11px] font-black transition ${classes}`}>
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <label className="text-[10px] font-black text-app-muted">
                ساعت
                <select value={draft.hour} onChange={(event) => changeTime("hour", event.target.value)} className="mt-1 h-8 w-full rounded-md border border-app-border bg-white px-2 text-xs font-bold text-app-text outline-none ring-app-primary focus:ring-2">
                  {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{pad(hour)}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-black text-app-muted">
                دقیقه
                <select value={draft.minute} onChange={(event) => changeTime("minute", event.target.value)} className="mt-1 h-8 w-full rounded-md border border-app-border bg-white px-2 text-xs font-bold text-app-text outline-none ring-app-primary focus:ring-2">
                  {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => <option key={minute} value={minute}>{pad(minute)}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-2 flex justify-between gap-1.5 border-t border-app-border pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => emit(todayParts)}>امروز</Button>
              <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearSchedule}>حذف</Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>تایید</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="rounded-md bg-app-surfaceMuted p-3 text-sm leading-7 text-app-muted shadow-hairline">
        <p><span className="font-semibold text-app-text">وضعیت:</span> {hasSchedule ? "با ذخیره فرم، پست زمان‌بندی می‌شود." : "فعلاً به عنوان پیش‌نویس ذخیره می‌شود."}</p>
        <p><span className="font-semibold text-app-text">زمان انتخاب‌شده:</span> {formatSchedule(selectedParts)}</p>
      </div>
    </div>
  );
}
