import { Tag } from "./ui/tag";

const statusMap: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "alert" | "info" }> = {
  draft: {
    label: "پیش‌نویس",
    tone: "neutral"
  },
  ready: {
    label: "آماده زمان‌بندی",
    tone: "primary"
  },
  scheduled: {
    label: "زمان‌بندی‌شده",
    tone: "warning"
  },
  publishing: {
    label: "در حال انتشار",
    tone: "info"
  },
  published: {
    label: "منتشرشده",
    tone: "success"
  },
  failed: {
    label: "ناموفق",
    tone: "alert"
  },
  cancelled: {
    label: "لغوشده",
    tone: "neutral"
  }
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status] ?? statusMap.draft;

  return <Tag tone={config.tone}>{config.label}</Tag>;
}
