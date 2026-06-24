import { Tag } from "./ui/tag";

const statusMap: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "alert" | "info" }> = {
  draft: {
    label: "پیش‌نویس",
    tone: "neutral"
  },
  ready: {
    label: "آماده",
    tone: "primary"
  },
  scheduled: {
    label: "زمان‌بندی",
    tone: "warning"
  },
  publishing: {
    label: "در حال انتشار",
    tone: "info"
  },
  published: {
    label: "منتشر",
    tone: "success"
  },
  partially_published: {
    label: "نیمه‌منتشر",
    tone: "warning"
  },
  manual_ready: {
    label: "آماده دستی",
    tone: "info"
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
