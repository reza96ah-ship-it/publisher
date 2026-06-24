import { Instagram, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PublishingChannel = "rubika" | "instagram";

export type ChannelOption = {
  value: PublishingChannel;
  label: string;
  shortLabel: string;
  description: string;
  tone: "primary" | "warning" | "success" | "neutral";
  icon: LucideIcon;
};

export const channelOptions: ChannelOption[] = [
  {
    value: "rubika",
    label: "روبیکا",
    shortLabel: "Rubika",
    description: "کانال انتشار خودکار با worker فعال و تست سلامت 24 ساعته.",
    tone: "primary",
    icon: Send
  },
  {
    value: "instagram",
    label: "اینستاگرام",
    shortLabel: "Instagram",
    description: "اکانت معمولی با یادآوری دستی؛ انتشار مستقیم فقط بعد از Meta OAuth.",
    tone: "warning",
    icon: Instagram
  }
];

export function normalizeChannels(platform?: string | null): PublishingChannel[] {
  const raw = (platform || "rubika")
    .split(/[,\|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const channels = Array.from(new Set(raw.filter((item): item is PublishingChannel => item === "rubika" || item === "instagram")));
  return channels.length ? channels : ["rubika"];
}

export function serializeChannels(channels: PublishingChannel[]) {
  const normalized = Array.from(new Set(channels));
  return (normalized.length ? normalized : ["rubika"]).join(",");
}

export function hasChannel(platform: string | null | undefined, channel: PublishingChannel) {
  return normalizeChannels(platform).includes(channel);
}

export function channelSummary(platform?: string | null) {
  const channels = normalizeChannels(platform);
  if (channels.length === 2) return "روبیکا + اینستاگرام";
  return channelOptions.find((option) => option.value === channels[0])?.label ?? "روبیکا";
}

export function channelValidationNotes(platform?: string | null) {
  const channels = normalizeChannels(platform);
  const notes = [];
  if (channels.includes("instagram")) {
    notes.push(channels.includes("rubika")
      ? "در حالت چندکاناله، روبیکا می‌تواند منتشر شود و اینستاگرام تا اتصال Meta OAuth به عنوان نتیجه کانالی ناموفق/در انتظار ثبت می‌شود."
      : "اینستاگرام هنوز به Meta OAuth متصل نیست؛ ذخیره پیش‌نویس ممکن است اما زمان‌بندی بدون کانال آماده مسدود می‌شود.");
  }
  if (channels.includes("rubika")) {
    notes.push("برای زمان‌بندی روبیکا، تست اتصال 24 ساعت اخیر لازم است.");
  }
  return notes;
}
