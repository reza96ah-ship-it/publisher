export const persianCalendarLocale = "fa-IR-u-ca-persian-nu-latn";
export const persianCalendarLocaleWithPersianDigits = "fa-IR-u-ca-persian-nu-arabext";

export function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatJalaliDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options
  }).format(date);
}

export function formatJalaliDateTime(value?: string | null) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function formatJalaliTime(value?: string | null) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function formatJalaliWeekday(value?: string | null) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    weekday: "long"
  }).format(date);
}

export function formatJalaliMonth(value?: string | null) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "long"
  }).format(date);
}

export function formatJalaliDayNumber(value?: string | null) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(persianCalendarLocale, {
    calendar: "persian",
    numberingSystem: "latn",
    day: "2-digit"
  }).format(date);
}

export function jalaliDateKey(value?: string | null) {
  const date = toDate(value);
  if (!date) return "unscheduled";

  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function sortByScheduleAsc<T extends { scheduled_at: string | null }>(items: T[]) {
  return [...items].sort((first, second) => {
    const firstTime = toDate(first.scheduled_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const secondTime = toDate(second.scheduled_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return firstTime - secondTime;
  });
}

