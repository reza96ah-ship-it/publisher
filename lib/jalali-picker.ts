export type JalaliPickerParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export const jalaliMonthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const persianWeekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function numberPart(parts: Intl.DateTimeFormatPart[], type: string) {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

function safeDate(value?: string | null) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizedHour(value: number) {
  return value === 24 ? 0 : value;
}

function roundToFiveMinutes(value: number) {
  return Math.min(55, Math.max(0, Math.round(value / 5) * 5));
}

function jalaliOnlyParts(date: Date, timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);

  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day")
  };
}

export function getJalaliPickerParts(value?: string | null, timeZone = "Asia/Tehran"): JalaliPickerParts {
  const date = safeDate(value);
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day"),
    hour: normalizedHour(numberPart(parts, "hour")),
    minute: value ? numberPart(parts, "minute") : roundToFiveMinutes(numberPart(parts, "minute"))
  };
}

function jalaliDateToGregorianUtc(year: number, month: number, day: number) {
  const searchStart = new Date(Date.UTC(year + 621, 2, 1, 12, 0, 0));

  for (let offset = -20; offset <= 380; offset += 1) {
    const candidate = new Date(searchStart.getTime() + offset * 86400000);
    const parts = jalaliOnlyParts(candidate, "UTC");
    if (parts.year === year && parts.month === month && parts.day === day) return candidate;
  }

  return null;
}

function gregorianPartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  return {
    year: numberPart(parts, "year"),
    month: numberPart(parts, "month"),
    day: numberPart(parts, "day"),
    hour: normalizedHour(numberPart(parts, "hour")),
    minute: numberPart(parts, "minute"),
    second: numberPart(parts, "second")
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = gregorianPartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedWallTimeToIso(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  utcMs -= timeZoneOffsetMs(new Date(utcMs), timeZone);
  utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - timeZoneOffsetMs(new Date(utcMs), timeZone);
  return new Date(utcMs).toISOString();
}

export function jalaliPickerPartsToIso(parts: JalaliPickerParts, timeZone = "Asia/Tehran") {
  const gregorian = jalaliDateToGregorianUtc(parts.year, parts.month, parts.day);
  if (!gregorian) return null;

  return zonedWallTimeToIso(
    gregorian.getUTCFullYear(),
    gregorian.getUTCMonth() + 1,
    gregorian.getUTCDate(),
    parts.hour,
    parts.minute,
    timeZone
  );
}

export function jalaliDateToIsoAtTime(value: string, hour: number, minute: number, timeZone = "Asia/Tehran") {
  const parts = getJalaliPickerParts(value, timeZone);
  return jalaliPickerPartsToIso({ ...parts, hour, minute }, timeZone);
}

export function getJalaliMonthLength(year: number, month: number) {
  for (let day = 31; day >= 29; day -= 1) {
    if (jalaliDateToGregorianUtc(year, month, day)) return day;
  }
  return 29;
}

export function getJalaliMonthStartOffset(year: number, month: number) {
  const firstDay = jalaliDateToGregorianUtc(year, month, 1);
  if (!firstDay) return 0;
  const local = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate()));
  return (local.getUTCDay() + 1) % 7;
}

