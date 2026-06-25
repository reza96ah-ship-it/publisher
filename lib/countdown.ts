export type CountdownTone = "neutral" | "success" | "warning" | "danger";

export type CountdownResult = {
  label: string;
  tone: CountdownTone;
};

function unit(value: number, label: string) {
  return `${value} ${label}`;
}

export function formatCountdown(value?: string | null, now: Date = new Date()): CountdownResult | null {
  if (!value) return null;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - now.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs <= 0) {
    const lateMs = Math.abs(diffMs);
    if (lateMs < 15 * minuteMs) return { label: "زمان انتشار رسیده", tone: "warning" };

    const lateDays = Math.floor(lateMs / dayMs);
    const lateHours = Math.floor(lateMs / hourMs);
    const lateMinutes = Math.max(1, Math.floor(lateMs / minuteMs));

    if (lateDays > 0) return { label: `${unit(lateDays, "روز")} از زمان انتشار گذشته`, tone: "danger" };
    if (lateHours > 0) return { label: `${unit(lateHours, "ساعت")} از زمان انتشار گذشته`, tone: "danger" };
    return { label: `${unit(lateMinutes, "دقیقه")} از زمان انتشار گذشته`, tone: "danger" };
  }

  if (diffMs < minuteMs) return { label: "کمتر از ۱ دقیقه تا انتشار", tone: "warning" };

  const days = Math.floor(diffMs / dayMs);
  const hours = Math.floor((diffMs % dayMs) / hourMs);
  const minutes = Math.floor((diffMs % hourMs) / minuteMs);

  if (days > 0) {
    const hourPart = hours > 0 ? ` و ${unit(hours, "ساعت")}` : "";
    return { label: `${unit(days, "روز")}${hourPart} تا انتشار`, tone: days <= 1 ? "warning" : "success" };
  }

  if (hours > 0) {
    const minutePart = minutes > 0 ? ` و ${unit(minutes, "دقیقه")}` : "";
    return { label: `${unit(hours, "ساعت")}${minutePart} تا انتشار`, tone: hours <= 3 ? "warning" : "success" };
  }

  return { label: `${unit(minutes, "دقیقه")} تا انتشار`, tone: minutes <= 30 ? "warning" : "neutral" };
}

export function formatPostCountdown(status: string, scheduledAt?: string | null, now: Date = new Date()): CountdownResult | null {
  if (status === "publishing") return { label: "در حال انتشار", tone: "warning" };
  if (status === "published") return { label: "منتشر شده", tone: "success" };
  if (status === "failed") return { label: "انتشار ناموفق", tone: "danger" };
  if (status === "cancelled") return { label: "لغو شده", tone: "neutral" };
  if (status !== "scheduled") return null;
  return formatCountdown(scheduledAt, now);
}

