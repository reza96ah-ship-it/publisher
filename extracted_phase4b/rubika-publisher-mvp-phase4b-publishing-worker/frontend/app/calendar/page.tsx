"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid3X3,
  ImageIcon,
  List,
  Maximize2,
  Minimize2,
  Plus,
  Rows3,
  X
} from "lucide-react";
import Link from "next/link";
import { CSSProperties, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { ChannelBadges } from "../../components/channel-badges";
import { LoadingRows } from "../../components/loading-skeleton";
import { CountdownBadge } from "../../components/countdown-badge";
import { DataSearchField } from "../../components/data-view";
import { PlannerComposerDrawer } from "../../components/planner-composer-drawer";
import { StatusBadge } from "../../components/status-badge";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { NMetricTile, NInspectorDrawer } from "../../components/nashrino-ui";
import { DetailGrid, EmptyState, NoticeBanner, StatusToken, Timeline, WorkspacePage } from "../../components/workspace-ui";
import { buildCampaignFilterOptions, campaignColorForPost, campaignKeyForPost, campaignLabelForPost, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { apiUrl, authHeaders, type Post } from "../../lib/posts";
import { isRubikaConnected, rubikaStatusLabel, type RubikaSettings } from "../../lib/workspace";
import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliMonth,
  formatJalaliTime,
  jalaliDateKey,
  sortByScheduleAsc
} from "../../lib/jalali";
import { getJalaliPickerParts, jalaliDateToIsoAtTime } from "../../lib/jalali-picker";

type CalendarFilter = "all" | "scheduled" | "publishing" | "published" | "manual_ready" | "failed";
type ViewMode = "month" | "week" | "list";
type DensityMode = "compact" | "comfortable";

type CalendarDay = {
  date: string;
  key: string;
  day: number;
};

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
};

const calendarFilters: Array<{ label: string; value: CalendarFilter }> = [
  { label: "همه", value: "all" },
  { label: "زمان‌بندی", value: "scheduled" },
  { label: "در حال انتشار", value: "publishing" },
  { label: "منتشر", value: "published" },
  { label: "آماده دستی", value: "manual_ready" },
  { label: "ناموفق", value: "failed" }
];

const viewModes: Array<{ label: string; value: ViewMode; icon: typeof Grid3X3 }> = [
  { label: "ماه", value: "month", icon: Grid3X3 },
  { label: "هفته", value: "week", icon: Rows3 },
  { label: "لیست", value: "list", icon: List }
];

const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const calendarStatuses = new Set(["scheduled", "publishing", "published", "manual_ready", "failed"]);
const scheduleTimezone = "Asia/Tehran";

function isCalendarPost(post: Post) {
  return Boolean(post.scheduled_at && calendarStatuses.has(post.status));
}

function dateTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
}

function jalaliParts(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day)
  };
}

function addDays(value: string | Date, days: number) {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function weekOffset(date: Date) {
  return (date.getDay() + 1) % 7;
}

function makeCalendarDay(date: Date): CalendarDay {
  return {
    date: date.toISOString(),
    key: jalaliDateKey(date.toISOString()),
    day: jalaliParts(date).day
  };
}

function buildMonthDays(anchorIso: string) {
  const anchor = new Date(anchorIso);
  const target = jalaliParts(anchor);
  const scanStart = addDays(anchor, -45);
  const days: CalendarDay[] = [];

  for (let index = 0; index <= 90; index += 1) {
    const date = addDays(scanStart, index);
    const parts = jalaliParts(date);
    if (parts.year === target.year && parts.month === target.month) {
      days.push(makeCalendarDay(date));
    }
  }

  return days;
}

function buildMonthGrid(days: CalendarDay[]) {
  if (days.length === 0) return [];
  const firstOffset = weekOffset(new Date(days[0].date));
  const endOffset = (7 - ((firstOffset + days.length) % 7)) % 7;
  return [
    ...Array.from({ length: firstOffset }, () => null),
    ...days,
    ...Array.from({ length: endOffset }, () => null)
  ];
}

function buildWeekDays(anchorIso: string) {
  const anchor = new Date(anchorIso);
  const start = addDays(anchor, -weekOffset(anchor));
  return Array.from({ length: 7 }, (_, index) => makeCalendarDay(addDays(start, index)));
}

function shiftPersianMonth(anchorIso: string, direction: -1 | 1) {
  const days = buildMonthDays(anchorIso);
  const boundary = direction === 1 ? days[days.length - 1] : days[0];
  if (!boundary) return new Date().toISOString();
  return addDays(boundary.date, direction).toISOString();
}

function statusCount(posts: Post[], status: CalendarFilter) {
  if (status === "all") return posts.length;
  return posts.filter((post) => post.status === status).length;
}

function postStatusLabel(status: string) {
  if (status === "failed") return "انتشار ناموفق";
  if (status === "published") return "منتشرشده";
  if (status === "publishing") return "در حال انتشار";
  return "زمان‌بندی‌شده";
}

function postTimelineTone(status: string): "primary" | "success" | "warning" | "alert" {
  if (status === "failed") return "alert";
  if (status === "published") return "success";
  if (status === "publishing") return "primary";
  return "warning";
}

function minutesBetween(first: string | null, second: string | null) {
  const firstTime = dateTime(first);
  const secondTime = dateTime(second);
  if (firstTime === null || secondTime === null) return null;
  return Math.abs(secondTime - firstTime) / 60_000;
}

function dayRangeLabel(days: CalendarDay[]) {
  if (days.length === 0) return "—";
  return `${formatJalaliDate(days[0].date)} تا ${formatJalaliDate(days[days.length - 1].date)}`;
}

function visibleCalendarText(post: Post) {
  return [post.title, post.caption, post.hashtags, post.campaign, post.internal_note, post.last_error].filter(Boolean).join(" ").toLowerCase();
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const agendaRef = useRef<HTMLElement | null>(null);
  const [presetCampaignId, setPresetCampaignId] = useState("");
  const [mobileView, setMobileView] = useState<"grid" | "agenda">("grid");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasDayConflicts = useCallback((dayPosts: Post[]) => {
    if (dayPosts.length < 2) return false;
    const sorted = sortByScheduleAsc(dayPosts);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = minutesBetween(sorted[i].scheduled_at, sorted[i + 1].scheduled_at);
      if (gap !== null && gap < 90) return true;
    }
    return false;
  }, []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [rubikaSettings, setRubikaSettings] = useState<RubikaSettings | null>(null);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<CalendarFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [densityMode, setDensityMode] = useState<DensityMode>("comfortable");
  const [monthAnchor, setMonthAnchor] = useState(new Date().toISOString());
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickCreateAt, setQuickCreateAt] = useState<string | null>(null);
  const [quickPreviewPostId, setQuickPreviewPostId] = useState<number | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<number | null>(null);
  const [dragTargetDayKey, setDragTargetDayKey] = useState<string | null>(null);
  const [reschedulingPostId, setReschedulingPostId] = useState<number | null>(null);
  const [rescheduleDraftPostId, setRescheduleDraftPostId] = useState<number | null>(null);
  const [rescheduleDraftDay, setRescheduleDraftDay] = useState("");
  const [rescheduleDraftHour, setRescheduleDraftHour] = useState(9);
  const [rescheduleDraftMinute, setRescheduleDraftMinute] = useState(0);
  const [agendaPulseKey, setAgendaPulseKey] = useState("");

  const loadPosts = useCallback(async (preservePlannerState = false) => {
    const headers = authHeaders();
    const [response, campaignsResponse, mediaResponse, rubikaResponse] = await Promise.all([
      fetch(`${apiUrl}/posts`, { headers }),
      loadCampaigns(),
      fetch(`${apiUrl}/media`, { headers }),
      fetch(`${apiUrl}/rubika/settings`, { headers })
    ]);
    if (!response.ok) throw new Error("دریافت تقویم انتشار ناموفق بود");
    const data: Post[] = await response.json();
    const sorted = sortByScheduleAsc(data.filter(isCalendarPost));
    const upcoming = sorted.find((post) => {
      const time = dateTime(post.scheduled_at);
      return time !== null && time >= Date.now() && ["scheduled", "publishing"].includes(post.status);
    });
    setPosts(data);
    setCampaigns(campaignsResponse);
    if (mediaResponse.ok) setAssets(await mediaResponse.json());
    if (rubikaResponse.ok) setRubikaSettings(await rubikaResponse.json());
    if (!preservePlannerState) {
      setMonthAnchor(upcoming?.scheduled_at ?? sorted[0]?.scheduled_at ?? new Date().toISOString());
      setSelectedDayKey(upcoming?.scheduled_at ? jalaliDateKey(upcoming.scheduled_at) : sorted[0]?.scheduled_at ? jalaliDateKey(sorted[0].scheduled_at) : jalaliDateKey(new Date().toISOString()));
      setSelectedPostId(upcoming?.id ?? sorted[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت تقویم انتشار");
      setLoading(false);
    });
  }, [loadPosts]);

  useEffect(() => {
    setPresetCampaignId(new URLSearchParams(window.location.search).get("campaignId") ?? "");
  }, []);

  useEffect(() => {
    const imageAssets = assets.filter((asset) => asset.post_id && asset.content_type.startsWith("image/"));
    if (imageAssets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const entries = await Promise.all(
        imageAssets.map(async (asset) => {
          try {
            const response = await fetch(`${apiUrl}/media/${asset.id}/file`, { headers: authHeaders() });
            if (!response.ok) return null;
            const url = URL.createObjectURL(await response.blob());
            createdUrls.push(url);
            return [asset.id, url] as const;
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) setMediaPreviewUrls(Object.fromEntries(entries.filter(Boolean) as Array<[number, string]>));
    }

    loadPreviews();
    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assets]);

  const calendarPosts = useMemo(() => sortByScheduleAsc(posts.filter(isCalendarPost)), [posts]);
  const filteredPosts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return calendarPosts
      .filter((post) => statusFilter === "all" || post.status === statusFilter)
      .filter((post) => campaignFilter === "all" || campaignKeyForPost(post) === campaignFilter)
      .filter((post) => !query || visibleCalendarText(post).includes(query));
  }, [calendarPosts, campaignFilter, searchTerm, statusFilter]);

  const campaignOptions = useMemo(() => {
    const options = buildCampaignFilterOptions(calendarPosts, campaigns);
    if (!presetCampaignId || options.some((option) => option.value === `id:${presetCampaignId}`)) return options;
    const routedCampaign = campaigns.find((campaign) => String(campaign.id) === presetCampaignId);
    return routedCampaign ? [{ value: `id:${routedCampaign.id}`, label: routedCampaign.name, color: routedCampaign.color, count: 0 }, ...options] : options;
  }, [calendarPosts, campaigns, presetCampaignId]);
  const selectedCampaignOption = useMemo(() => campaignOptions.find((option) => option.value === campaignFilter) ?? null, [campaignFilter, campaignOptions]);
  const selectedCampaignIdForRoute = selectedCampaignOption?.value.startsWith("id:") ? selectedCampaignOption.value.replace("id:", "") : "";

  useEffect(() => {
    if (!presetCampaignId) return;
    const nextValue = `id:${presetCampaignId}`;
    if (campaignOptions.some((option) => option.value === nextValue)) setCampaignFilter(nextValue);
  }, [campaignOptions, presetCampaignId]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of filteredPosts) {
      if (!post.scheduled_at) continue;
      const key = jalaliDateKey(post.scheduled_at);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [filteredPosts]);

  const monthDays = useMemo(() => buildMonthDays(monthAnchor), [monthAnchor]);
  const monthGrid = useMemo(() => buildMonthGrid(monthDays), [monthDays]);
  const activeWeekDays = useMemo(() => buildWeekDays(monthAnchor), [monthAnchor]);
  const activeRangeDays = viewMode === "week" ? activeWeekDays : monthDays;
  const activeRangeDayKeys = useMemo(() => new Set(activeRangeDays.map((day) => day.key)), [activeRangeDays]);
  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return calendarPosts.find((post) => post.id === selectedPostId) ?? null;
  }, [calendarPosts, selectedPostId]);
  const quickPreviewPost = useMemo(() => {
    if (!quickPreviewPostId) return null;
    return calendarPosts.find((post) => post.id === quickPreviewPostId) ?? null;
  }, [calendarPosts, quickPreviewPostId]);
  const rescheduleDraftPost = useMemo(() => {
    if (!rescheduleDraftPostId) return null;
    return calendarPosts.find((post) => post.id === rescheduleDraftPostId) ?? null;
  }, [calendarPosts, rescheduleDraftPostId]);
  const assetByPostId = useMemo(() => {
    const map = new Map<number, MediaAsset>();
    for (const asset of assets) {
      if (asset.post_id && !map.has(asset.post_id)) map.set(asset.post_id, asset);
    }
    return map;
  }, [assets]);

  const now = Date.now();
  const todayKey = jalaliDateKey(new Date().toISOString());
  const nextPost = calendarPosts.find((post) => {
    const time = dateTime(post.scheduled_at);
    return time !== null && time >= now && ["scheduled", "publishing"].includes(post.status);
  });
  const attentionPosts = calendarPosts.filter((post) => {
    const time = dateTime(post.scheduled_at);
    return post.status === "failed" || (post.status === "scheduled" && time !== null && time < now);
  });
  const monthPostCount = filteredPosts.filter((post) => postsByDay.has(jalaliDateKey(post.scheduled_at)) && monthDays.some((day) => day.key === jalaliDateKey(post.scheduled_at))).length;
  const activeDayKey = selectedDayKey ?? (selectedPost?.scheduled_at ? jalaliDateKey(selectedPost.scheduled_at) : todayKey);
  const selectedDayPosts = useMemo(() => (activeDayKey ? postsByDay.get(activeDayKey) ?? [] : []), [activeDayKey, postsByDay]);
  const selectedDay = [...monthDays, ...activeWeekDays].find((day) => day.key === activeDayKey) ?? null;
  const selectedDayValue = selectedDay?.date ?? monthAnchor;
  const selectedDayLabel = formatJalaliDate(selectedDayValue);
  const publishedCount = calendarPosts.filter((post) => post.status === "published").length;
  const scheduledCount = calendarPosts.filter((post) => post.status === "scheduled").length;
  const failedCount = calendarPosts.filter((post) => post.status === "failed").length;
  const publishingCount = calendarPosts.filter((post) => post.status === "publishing").length;
  const plannerHealthTone = attentionPosts.length ? "alert" : failedCount ? "warning" : "success";
  const plannerHealthLabel = attentionPosts.length ? `${attentionPosts.length} اقدام فوری` : failedCount ? `${failedCount} خطا` : "برنامه پایدار";
  const currentRangeLabel = viewMode === "week" ? dayRangeLabel(activeWeekDays) : viewMode === "list" ? "فهرست برنامه" : formatJalaliMonth(monthAnchor);
  const visibleRangeCount = filteredPosts.filter((post) => post.scheduled_at && activeRangeDayKeys.has(jalaliDateKey(post.scheduled_at))).length;
  const visiblePostLimit = viewMode === "week" ? (densityMode === "compact" ? 4 : 6) : densityMode === "compact" ? 2 : 3;
  const calendarCellHeight = densityMode === "compact" ? "min-h-24" : "min-h-36";

  const rescheduleDraftIso = useMemo(() => {
    if (!rescheduleDraftPost || !rescheduleDraftDay) return null;
    return jalaliDateToIsoAtTime(rescheduleDraftDay, rescheduleDraftHour, rescheduleDraftMinute, scheduleTimezone);
  }, [rescheduleDraftDay, rescheduleDraftHour, rescheduleDraftMinute, rescheduleDraftPost]);
  const rescheduleDraftConflicts = useMemo(() => {
    if (!rescheduleDraftPost || !rescheduleDraftIso) return [];
    const targetTime = dateTime(rescheduleDraftIso);
    if (targetTime === null) return [];
    const targetDayKey = jalaliDateKey(rescheduleDraftIso);
    return calendarPosts.filter((post) => {
      if (post.id === rescheduleDraftPost.id || !post.scheduled_at) return false;
      if (jalaliDateKey(post.scheduled_at) !== targetDayKey) return false;
      const gap = minutesBetween(rescheduleDraftIso, post.scheduled_at);
      return gap !== null && gap < 90;
    });
  }, [calendarPosts, rescheduleDraftIso, rescheduleDraftPost]);

  useEffect(() => {
    if (!quickPreviewPost && !rescheduleDraftPost) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQuickPreviewPostId(null);
        setRescheduleDraftPostId(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quickPreviewPost, rescheduleDraftPost]);
  const selectedCampaignWorkload = useMemo(() => {
    if (!selectedCampaignOption) return null;
    const rangePosts = calendarPosts
      .filter((post) => campaignKeyForPost(post) === selectedCampaignOption.value)
      .filter((post) => post.scheduled_at && activeRangeDayKeys.has(jalaliDateKey(post.scheduled_at)));
    return {
      total: rangePosts.length,
      scheduled: rangePosts.filter((post) => post.status === "scheduled").length,
      publishing: rangePosts.filter((post) => post.status === "publishing").length,
      published: rangePosts.filter((post) => post.status === "published").length,
      failed: rangePosts.filter((post) => post.status === "failed").length
    };
  }, [activeRangeDayKeys, calendarPosts, selectedCampaignOption]);
  const selectedDayInsights = useMemo(() => {
    const sortedDayPosts = sortByScheduleAsc(selectedDayPosts);
    const conflicts: Array<{ first: Post; second: Post; gap: number }> = [];
    sortedDayPosts.forEach((post, index) => {
      const nextPostForDay = sortedDayPosts[index + 1];
      if (!nextPostForDay) return;
      const gap = minutesBetween(post.scheduled_at, nextPostForDay.scheduled_at);
      if (gap !== null && gap < 90) conflicts.push({ first: post, second: nextPostForDay, gap: Math.round(gap) });
    });
    const missingMedia = sortedDayPosts.filter((post) => !assetByPostId.has(post.id));
    const failed = sortedDayPosts.filter((post) => post.status === "failed" || post.last_error);
    const publishablePosts = sortedDayPosts.filter((post) => ["scheduled", "publishing"].includes(post.status));
    const rubikaBlocked = publishablePosts.length > 0 && !isRubikaConnected(rubikaSettings);
    const busyHours = new Set(sortedDayPosts.map((post) => getJalaliPickerParts(post.scheduled_at, scheduleTimezone).hour));
    const suggestedSlots = [9, 12, 15, 18, 21]
      .filter((hour) => !busyHours.has(hour))
      .slice(0, 3)
      .map((hour) => ({ hour, label: `${String(hour).padStart(2, "0")}:00` }));
    return { conflicts, missingMedia, failed, publishablePosts, rubikaBlocked, suggestedSlots };
  }, [assetByPostId, rubikaSettings, selectedDayPosts]);

  const selectedDayNextAction = useMemo(() => {
    if (selectedDayInsights.rubikaBlocked) return { tone: "alert" as const, title: "اتصال کانال را بررسی کنید", detail: rubikaStatusLabel(rubikaSettings) };
    if (selectedDayInsights.failed.length) return { tone: "alert" as const, title: "پست خطادار را اصلاح کنید", detail: `${selectedDayInsights.failed.length} پست نیازمند بررسی است` };
    if (selectedDayInsights.conflicts.length) return { tone: "warning" as const, title: "فاصله انتشار را بهتر کنید", detail: `${selectedDayInsights.conflicts.length} تداخل نزدیک پیدا شد` };
    if (selectedDayInsights.missingMedia.length) return { tone: "warning" as const, title: "رسانه پست‌ها را کامل کنید", detail: `${selectedDayInsights.missingMedia.length} پست بدون رسانه است` };
    if (!selectedDayPosts.length) return { tone: "primary" as const, title: "روز خالی آماده برنامه‌ریزی است", detail: "از زمان‌های پیشنهادی یک پست تازه بسازید" };
    return { tone: "success" as const, title: "روز آماده انتشار است", detail: "فاصله‌بندی و وضعیت پست‌ها پایدار است" };
  }, [rubikaSettings, selectedDayInsights, selectedDayPosts.length]);
  const selectedDayTimeline = useMemo(() => {
    const sorted = sortByScheduleAsc(selectedDayPosts);
    const occupied = sorted.map((post) => ({
      type: "post" as const,
      post,
      label: formatJalaliTime(post.scheduled_at),
      accent: campaignColorForPost(post, campaigns)
    }));
    const suggestions = selectedDayInsights.suggestedSlots.map((slot) => ({
      type: "slot" as const,
      hour: slot.hour,
      label: slot.label,
      accent: "rgb(var(--n-color-primary))"
    }));
    return [...occupied.slice(0, 5), ...suggestions].slice(0, 7);
  }, [campaigns, selectedDayInsights.suggestedSlots, selectedDayPosts]);
  const quickPreviewReadiness = useMemo(() => {
    if (!quickPreviewPost) return [];
    const dayConflicts = quickPreviewPost.scheduled_at
      ? calendarPosts.filter((post) => {
          if (post.id === quickPreviewPost.id || !post.scheduled_at) return false;
          if (jalaliDateKey(post.scheduled_at) !== jalaliDateKey(quickPreviewPost.scheduled_at)) return false;
          const gap = minutesBetween(quickPreviewPost.scheduled_at, post.scheduled_at);
          return gap !== null && gap < 90;
        })
      : [];
    const publishable = ["scheduled", "publishing"].includes(quickPreviewPost.status);
    return [
      { label: "رسانه", value: assetByPostId.has(quickPreviewPost.id) ? "آماده" : "نیازمند رسانه", tone: assetByPostId.has(quickPreviewPost.id) ? "success" as const : "warning" as const },
      { label: "کانال", value: !publishable || isRubikaConnected(rubikaSettings) ? "متصل" : "نیازمند اتصال", tone: !publishable || isRubikaConnected(rubikaSettings) ? "success" as const : "alert" as const },
      { label: "فاصله زمانی", value: dayConflicts.length ? `${dayConflicts.length} تداخل` : "ایمن", tone: dayConflicts.length ? "warning" as const : "success" as const },
      { label: "خطا", value: quickPreviewPost.last_error ? "نیازمند بررسی" : "بدون خطا", tone: quickPreviewPost.last_error ? "alert" as const : "success" as const }
    ];
  }, [assetByPostId, calendarPosts, quickPreviewPost, rubikaSettings]);

  function selectPost(post: Post) {
    setSelectedPostId(post.id);
    if (post.scheduled_at) setMonthAnchor(post.scheduled_at);
    if (post.scheduled_at) setSelectedDayKey(jalaliDateKey(post.scheduled_at));
  }

  function focusSelectedDayAgenda(dayKey: string) {
    setAgendaPulseKey(`${dayKey}-${Date.now()}`);
    window.setTimeout(() => {
      agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => {
      setAgendaPulseKey((current) => (current.startsWith(`${dayKey}-`) ? "" : current));
    }, 1000);
  }

  function selectDay(day: CalendarDay, dayPosts: Post[], focusAgenda = false) {
    setSelectedDayKey(day.key);
    setMonthAnchor(day.date);
    setSelectedPostId(dayPosts[0]?.id ?? null);
    if (focusAgenda) focusSelectedDayAgenda(day.key);
  }

  function movePlannerMonth(direction: -1 | 1) {
    const nextAnchor = shiftPersianMonth(monthAnchor, direction);
    setMonthAnchor(nextAnchor);
    setSelectedDayKey(jalaliDateKey(nextAnchor));
    setSelectedPostId(null);
  }

  function goToToday() {
    const today = new Date().toISOString();
    setMonthAnchor(today);
    setSelectedDayKey(jalaliDateKey(today));
    setSelectedPostId(null);
    focusSelectedDayAgenda(jalaliDateKey(today));
  }

  function openQuickCreateAt(value: string, hour = 9, minute = 0) {
    setQuickCreateAt(jalaliDateToIsoAtTime(value, hour, minute) ?? value);
  }

  function openQuickCreate(value: string) {
    openQuickCreateAt(value, 9, 0);
  }

  function canReschedule(post: Post) {
    return post.status === "scheduled" && Boolean(post.scheduled_at);
  }

  function suggestedSlotsForDay(value: string, excludedPostId?: number) {
    const dayKey = jalaliDateKey(value);
    const busyHours = new Set(
      calendarPosts
        .filter((post) => post.id !== excludedPostId && post.scheduled_at && jalaliDateKey(post.scheduled_at) === dayKey)
        .map((post) => getJalaliPickerParts(post.scheduled_at, scheduleTimezone).hour)
    );
    return [9, 12, 15, 18, 21]
      .filter((hour) => !busyHours.has(hour))
      .map((hour) => ({ hour, minute: 0, label: `${String(hour).padStart(2, "0")}:00` }));
  }

  function openRescheduleDraft(post: Post, nextDay = post.scheduled_at ?? selectedDayValue) {
    if (!canReschedule(post)) {
      showToast({ title: "تغییر زمان فعال نیست", description: "فقط پست‌های زمان‌بندی‌شده قابل جابجایی هستند.", tone: "warning" });
      return;
    }
    const parts = getJalaliPickerParts(post.scheduled_at, scheduleTimezone);
    setQuickPreviewPostId(null);
    setRescheduleDraftPostId(post.id);
    setRescheduleDraftDay(nextDay);
    setRescheduleDraftHour(parts.hour);
    setRescheduleDraftMinute(parts.minute);
  }

  async function saveRescheduleDraft() {
    if (!rescheduleDraftPost || !rescheduleDraftIso || rescheduleDraftConflicts.length > 0) return;
    const originalScheduledAt = rescheduleDraftPost.scheduled_at;
    if (!originalScheduledAt) return;
    const nextScheduledAt = rescheduleDraftIso;
    const nextDayKey = jalaliDateKey(nextScheduledAt);
    const originalDayKey = jalaliDateKey(originalScheduledAt);

    setError("");
    setReschedulingPostId(rescheduleDraftPost.id);
    setPosts((current) => current.map((item) => item.id === rescheduleDraftPost.id ? { ...item, scheduled_at: nextScheduledAt } : item));
    setSelectedDayKey(nextDayKey);
    setSelectedPostId(rescheduleDraftPost.id);
    setMonthAnchor(nextScheduledAt);

    try {
      const response = await fetch(`${apiUrl}/posts/${rescheduleDraftPost.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ scheduled_at: nextScheduledAt, timezone: scheduleTimezone })
      });
      if (!response.ok) throw new Error("زمان‌بندی جدید پست ذخیره نشد");
      const savedPost = await response.json() as Post;
      setPosts((current) => current.map((item) => item.id === rescheduleDraftPost.id ? savedPost : item));
      setRescheduleDraftPostId(null);
      showToast({ title: "زمان انتشار بروزرسانی شد", description: `${savedPost.title} · ${formatJalaliDateTime(savedPost.scheduled_at)}`, tone: "success" });
      focusSelectedDayAgenda(nextDayKey);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "تغییر زمان پست ناموفق بود";
      setPosts((current) => current.map((item) => item.id === rescheduleDraftPost.id ? { ...item, scheduled_at: originalScheduledAt } : item));
      setSelectedDayKey(originalDayKey);
      setMonthAnchor(originalScheduledAt);
      setError(nextError);
      showToast({ title: "تغییر زمان پست ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setReschedulingPostId(null);
    }
  }

  function startDraggingPost(event: DragEvent<HTMLButtonElement>, post: Post) {
    if (post.status !== "scheduled" || !post.scheduled_at) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(post.id));
    setDraggingPostId(post.id);
  }

  function stopDraggingPost() {
    setDraggingPostId(null);
    setDragTargetDayKey(null);
  }

  function allowDropOnDay(event: DragEvent<HTMLDivElement>, day: CalendarDay) {
    if (!draggingPostId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragTargetDayKey(day.key);
  }

  async function reschedulePost(post: Post, day: CalendarDay) {
    if (!post.scheduled_at || post.status !== "scheduled") return;
    const originalScheduledAt = post.scheduled_at;
    const originalDayKey = jalaliDateKey(originalScheduledAt);
    if (originalDayKey === day.key) return;

    const time = getJalaliPickerParts(originalScheduledAt, scheduleTimezone);
    const scheduledAt = jalaliDateToIsoAtTime(day.date, time.hour, time.minute, scheduleTimezone);
    if (!scheduledAt) {
      showToast({ title: "جابجایی پست ناموفق بود", description: "تاریخ مقصد قابل تبدیل نیست.", tone: "alert" });
      return;
    }

    setError("");
    setReschedulingPostId(post.id);
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, scheduled_at: scheduledAt } : item));
    setSelectedDayKey(day.key);
    setSelectedPostId(post.id);

    try {
      const response = await fetch(`${apiUrl}/posts/${post.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ scheduled_at: scheduledAt, timezone: scheduleTimezone })
      });
      if (!response.ok) throw new Error("زمان‌بندی جدید پست ذخیره نشد");
      const savedPost = await response.json() as Post;
      setPosts((current) => current.map((item) => item.id === post.id ? savedPost : item));
      showToast({ title: "زمان انتشار جابجا شد", description: `${post.title} · ${formatJalaliDateTime(savedPost.scheduled_at)}`, tone: "success" });
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "جابجایی پست ناموفق بود";
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, scheduled_at: originalScheduledAt } : item));
      setSelectedDayKey(originalDayKey);
      setError(nextError);
      showToast({ title: "جابجایی پست ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setReschedulingPostId(null);
    }
  }

  function dropPostOnDay(event: DragEvent<HTMLDivElement>, day: CalendarDay) {
    event.preventDefault();
    const postId = Number(event.dataTransfer.getData("text/plain") || draggingPostId);
    const post = posts.find((item) => item.id === postId);
    stopDraggingPost();
    if (post) void reschedulePost(post, day);
  }

  function renderPostChip(post: Post, compact = false) {
    const selected = selectedPost?.id === post.id;
    const draggable = post.status === "scheduled" && Boolean(post.scheduled_at);
    const rescheduling = reschedulingPostId === post.id;
    const asset = assetByPostId.get(post.id);
    const previewUrl = asset ? mediaPreviewUrls[asset.id] : "";
    return (
      <button
        key={post.id}
        type="button"
        data-status={post.status}
        onClick={() => {
          selectPost(post);
          setQuickPreviewPostId(post.id);
        }}
        draggable={draggable}
        onDragStart={(event) => startDraggingPost(event, post)}
        onDragEnd={stopDraggingPost}
        className={`calendar-post-chip app-interactive ${compact ? "calendar-post-chip-compact" : ""} ${selected ? "calendar-post-chip-selected" : ""} ${draggable ? "calendar-post-chip-draggable" : ""} ${rescheduling ? "calendar-post-chip-saving" : ""}`}
        style={{ "--campaign-accent": campaignColorForPost(post, campaigns) } as CSSProperties}
        title={draggable ? "برای تغییر روز انتشار، پست را روی روز جدید بکشید." : undefined}
      >
        <span className="calendar-post-chip-rail" aria-hidden="true" />
        <span className="calendar-post-chip-inner">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="calendar-post-chip-media" />
          ) : (
            !compact ? (
              <span className="calendar-post-chip-media calendar-post-chip-media-empty">
                <ImageIcon className="calendar-post-chip-media-icon" aria-hidden="true" />
              </span>
            ) : null
          )}
          <span className="calendar-post-chip-body">
            <span className="calendar-post-chip-top">
              <span className="calendar-post-chip-time">{formatJalaliTime(post.scheduled_at)}</span>
              <span className="calendar-post-chip-status">{postStatusLabel(post.status)}</span>
            </span>
            <span className="calendar-post-chip-title">{post.title}</span>
            <span className="calendar-post-chip-campaign">
              <span className="calendar-post-chip-dot" aria-hidden="true" />
              <span className="truncate">{campaignKeyForPost(post) !== "none" ? campaignLabelForPost(post, campaigns) : (!compact ? post.caption : "") || "بدون کمپین"}</span>
            </span>
          </span>
        </span>
      </button>
    );
  }

  function renderAgendaPost(post: Post) {
    const selected = selectedPost?.id === post.id;
    const asset = assetByPostId.get(post.id);
    const previewUrl = asset ? mediaPreviewUrls[asset.id] : "";
    return (
      <article
        key={post.id}
        role="button"
        tabIndex={0}
        className={`calendar-day-agenda-post ${selected ? "calendar-day-agenda-post-active" : ""}`}
        style={{ "--campaign-accent": campaignColorForPost(post, campaigns) } as CSSProperties}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a,button")) return;
          selectPost(post);
          setQuickPreviewPostId(post.id);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selectPost(post);
          setQuickPreviewPostId(post.id);
        }}
      >
        <span className="calendar-day-agenda-post-rail" aria-hidden="true" />
        {previewUrl ? (
          <img src={previewUrl} alt={asset?.original_filename ?? ""} className="calendar-day-agenda-thumb" />
        ) : (
          <span className="calendar-day-agenda-thumb calendar-day-agenda-thumb-empty">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="calendar-day-agenda-body">
          <div className="calendar-day-agenda-meta">
            <span className="calendar-day-agenda-time">{formatJalaliTime(post.scheduled_at)}</span>
            <StatusBadge status={post.status} />
            <ChannelBadges platform={post.platform} compact />
          </div>
          <h3>{post.title}</h3>
          <p>{post.caption || campaignLabelForPost(post, campaigns)}</p>
          <div className="calendar-day-agenda-tags">
            <span className="calendar-post-preview-campaign" style={{ "--campaign-accent": campaignColorForPost(post, campaigns) } as CSSProperties}>
              <span aria-hidden="true" />
              {campaignLabelForPost(post, campaigns)}
            </span>
            <CountdownBadge status={post.status} scheduledAt={post.scheduled_at} />
          </div>
        </div>
        <div className="calendar-day-agenda-actions">
          {canReschedule(post) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openRescheduleDraft(post)}
            >
              تغییر زمان
            </Button>
          ) : null}
          <Button
            type="button"
            variant={selected ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              selectPost(post);
              setQuickPreviewPostId(post.id);
            }}
          >
            پیش‌نمایش
          </Button>
          <Button href={`/compose?postId=${post.id}`} variant="ghost" size="sm">ویرایش</Button>
        </div>
      </article>
    );
  }

  function renderMonthDayDensity(dayPosts: Post[], hiddenCount: number) {
    if (dayPosts.length === 0) {
      return <span className="calendar-day-empty-hint">برای ساخت پست کلیک کنید</span>;
    }

    return (
      <div className="calendar-day-density-list" aria-label={`${dayPosts.length} پست در این روز`}>
        {dayPosts.slice(0, 3).map((post) => (
          <span key={post.id} className="calendar-day-density-item" style={{ "--campaign-accent": campaignColorForPost(post, campaigns) } as CSSProperties}>
            <span className="calendar-day-density-dot" aria-hidden="true" />
            <span>{formatJalaliTime(post.scheduled_at)}</span>
          </span>
        ))}
        {hiddenCount > 0 ? <span className="calendar-day-density-more">+{hiddenCount} بیشتر</span> : null}
      </div>
    );
  }

  function renderPostPreviewContent(post: Post) {
    const asset = assetByPostId.get(post.id);
    const previewUrl = asset ? mediaPreviewUrls[asset.id] : "";
    return (
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[80vh] md:max-h-none p-1">
        <div className="calendar-post-preview-media">
          {previewUrl ? (
            <img src={previewUrl} alt={asset?.original_filename ?? ""} className="calendar-post-preview-image rounded-lg w-full max-h-48 object-cover border border-app-border" />
          ) : (
            <span className="calendar-post-preview-image calendar-post-preview-image-empty flex flex-col items-center justify-center bg-slate-50 border border-dashed border-app-border py-8 rounded-lg text-app-muted">
              <ImageIcon className="h-6 w-6 mb-1.5" aria-hidden="true" />
              بدون رسانه
            </span>
          )}
        </div>

        <div className="calendar-post-preview-details calendar-post-detail-summary flex flex-col gap-2">
          <div className="calendar-post-preview-status flex flex-wrap gap-1.5 items-center">
            <StatusBadge status={post.status} />
            <ChannelBadges platform={post.platform} compact />
            <CountdownBadge status={post.status} scheduledAt={post.scheduled_at} />
            <span className="calendar-post-preview-campaign text-xs font-black inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-app-border bg-white" style={{ "--campaign-accent": campaignColorForPost(post, campaigns) } as CSSProperties}>
              <span className="h-2 w-2 rounded-full bg-[var(--campaign-accent)]" aria-hidden="true" />
              {campaignLabelForPost(post, campaigns)}
            </span>
          </div>
          <DetailGrid
            items={[
              { label: "زمان انتشار", value: formatJalaliDateTime(post.scheduled_at) },
              { label: "کانال", value: post.platform || "Rubika" },
              { label: "کمپین", value: campaignLabelForPost(post, campaigns) },
              { label: "تلاش انتشار", value: `${post.attempt_count}` }
            ]}
          />
          <div className="calendar-post-readiness-grid grid grid-cols-2 gap-2 mt-2">
            {quickPreviewReadiness.map((item) => (
              <div key={item.label} className="calendar-post-readiness-item flex flex-col p-2 rounded-md border border-app-border bg-slate-50" data-tone={item.tone}>
                <span className="text-[10px] text-app-muted font-bold">{item.label}</span>
                <strong className="text-xs font-black mt-0.5">{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-post-detail-grid flex flex-col gap-3 mt-2">
          <section className="calendar-post-detail-card p-3 rounded-lg border border-app-border bg-slate-50">
            <p className="app-section-kicker text-[10px] font-black mb-1">کپشن</p>
            <p className="calendar-post-preview-caption text-xs leading-relaxed text-app-text whitespace-pre-wrap">{post.caption || "کپشن برای این پست ثبت نشده است."}</p>
          </section>
          <section className="calendar-post-detail-card p-3 rounded-lg border border-app-border bg-slate-50">
            <p className="app-section-kicker text-[10px] font-black mb-1.5">مسیر انتشار</p>
            <Timeline
              items={[
                {
                  title: "ساخت محتوا",
                  description: "پست در فضای کاری ثبت شده است.",
                  meta: formatJalaliDateTime(post.created_at),
                  tone: "primary"
                },
                {
                  title: "ورود به برنامه انتشار",
                  description: formatJalaliDateTime(post.scheduled_at),
                  meta: campaignLabelForPost(post, campaigns),
                  tone: "warning"
                },
                {
                  title: "وضعیت فعلی",
                  description: post.last_error || postStatusLabel(post.status),
                  meta: formatJalaliDateTime(post.updated_at),
                  tone: postTimelineTone(post.status)
                }
              ]}
            />
          </section>
        </div>

        {post.last_error ? <NoticeBanner tone="alert">{post.last_error}</NoticeBanner> : null}
      </div>
    );
  }

  function renderPostPreviewFooter(post: Post) {
    return (
      <div className="flex flex-wrap gap-2 justify-end w-full border-t border-app-border p-3 bg-slate-50">
        <Button href={`/compose?postId=${post.id}`} size="sm">ویرایش پست</Button>
        {canReschedule(post) ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => openRescheduleDraft(post, post.scheduled_at ?? selectedDayValue)}>تغییر زمان</Button>
        ) : null}
        <Button href="/queue" variant="secondary" size="sm">صف انتشار</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setQuickPreviewPostId(null)}>بستن</Button>
      </div>
    );
  }

  function renderRescheduleContent(post: Post) {
    return (
      <div className="flex flex-col gap-4 p-2 overflow-y-auto h-full">
        <div className="calendar-reschedule-body flex flex-col gap-3">
          <div className="calendar-reschedule-day-card p-3 rounded-lg border border-app-border bg-slate-50">
            <p className="text-[10px] font-black text-app-muted">روز انتشار</p>
            <div className="calendar-reschedule-day-value flex items-center gap-2 mt-1.5 text-sm font-black text-app-text">
              <CalendarDays className="h-4 w-4 text-app-primary" aria-hidden="true" />
              <span>{rescheduleDraftDay ? formatJalaliDate(rescheduleDraftDay) : "روز انتخاب نشده"}</span>
            </div>
            <div className="calendar-reschedule-day-actions flex gap-2 mt-2.5">
              <Button type="button" variant="secondary" size="sm" onClick={() => setRescheduleDraftDay(selectedDayValue)}>
                روز فعال تقویم
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRescheduleDraftDay(addDays(post.scheduled_at ?? selectedDayValue, 1).toISOString())}>
                فردا
              </Button>
            </div>
          </div>

          <div className="calendar-reschedule-time-card p-3 rounded-lg border border-app-border bg-slate-50">
            <p className="text-[10px] font-black text-app-muted">ساعت انتشار</p>
            <div className="calendar-reschedule-selectors grid grid-cols-2 gap-3 mt-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-app-muted">ساعت</span>
                <select value={rescheduleDraftHour} onChange={(event) => setRescheduleDraftHour(Number(event.target.value))} className="w-full border border-app-border bg-white rounded-md p-1.5 text-xs outline-none">
                  {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-app-muted">دقیقه</span>
                <select value={rescheduleDraftMinute} onChange={(event) => setRescheduleDraftMinute(Number(event.target.value))} className="w-full border border-app-border bg-white rounded-md p-1.5 text-xs outline-none">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}
                </select>
              </label>
            </div>
            <div className="calendar-reschedule-slots flex flex-wrap gap-1.5 mt-3">
              {suggestedSlotsForDay(rescheduleDraftDay || selectedDayValue, post.id).slice(0, 5).map((slot) => (
                <Button
                  key={slot.hour}
                  type="button"
                  variant={rescheduleDraftHour === slot.hour && rescheduleDraftMinute === slot.minute ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => {
                    setRescheduleDraftHour(slot.hour);
                    setRescheduleDraftMinute(slot.minute);
                  }}
                >
                  {slot.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {rescheduleDraftConflicts.length ? (
          <NoticeBanner tone="alert" title="تداخل زمانی">
            این زمان با {rescheduleDraftConflicts.length} پست دیگر کمتر از ۹۰ دقیقه فاصله دارد. یک ساعت پیشنهادی دیگر انتخاب کنید.
          </NoticeBanner>
        ) : (
          <NoticeBanner tone="success" title="زمان امن">
            این زمان برای انتشار پشت‌سرهم مناسب است و تداخل نزدیک ندارد.
          </NoticeBanner>
        )}
      </div>
    );
  }

  function renderRescheduleFooter(post: Post) {
    return (
      <div className="flex gap-2 justify-end w-full border-t border-app-border p-3 bg-slate-50">
        <Button type="button" onClick={() => void saveRescheduleDraft()} disabled={!rescheduleDraftIso || rescheduleDraftConflicts.length > 0 || reschedulingPostId === post.id} size="sm">
          {reschedulingPostId === post.id ? "در حال ذخیره" : "ذخیره زمان جدید"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setRescheduleDraftPostId(null)} size="sm">انصراف</Button>
      </div>
    );
  }

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="calendar-pro-page">
          <nav className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface/70 px-1.5 py-1.5 shadow-hairline backdrop-blur-sm" aria-label="زیرمنوی برنامه‌ریز">
            <Link href="/calendar" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-black bg-white text-app-primary shadow-hairline border border-app-border/80 transition">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              تقویم انتشار
            </Link>
            <Link href="/queue" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold text-app-muted hover:bg-white hover:text-app-text hover:shadow-hairline transition">
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              صف انتشار
            </Link>
          </nav>

          <section className="calendar-pro-hero">
            <div className="calendar-pro-hero-copy">
              <p className="app-section-kicker calendar-pro-kicker text-[10px] font-black">برنامه‌ریز</p>
              <h1>تقویم انتشار</h1>
              <p>نمای عملیاتی برنامه محتوا؛ ببینید چه چیزی زمان‌دار است، چه چیزی گیر کرده و کدام روز ظرفیت دارد.</p>
            </div>
            <div className="calendar-pro-hero-actions">
              <StatusToken tone={plannerHealthTone}>{plannerHealthLabel}</StatusToken>
              <Button type="button" onClick={() => openQuickCreate(selectedDayValue)} size="sm">
                <Plus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                پست جدید
              </Button>
            </div>
          </section>

          <section className="dashboard-kpi-strip calendar-kpi-strip grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="خلاصه تقویم انتشار">
            {[
              { label: "بازه فعال", value: currentRangeLabel, detail: `${visibleRangeCount} در دید · ${publishedCount} منتشر`, tone: "primary" as const, icon: CalendarDays },
              { label: "زمان‌بندی‌شده", value: scheduledCount, detail: "در انتظار انتشار", tone: "warning" as const, icon: Clock3 },
              { label: "در انتشار", value: publishingCount, detail: "job فعال", tone: "primary" as const, icon: Rows3 },
              { label: "ریسک", value: attentionPosts.length, detail: failedCount ? `${failedCount} ناموفق` : "بدون مانع جدی", tone: attentionPosts.length ? "alert" as const : "success" as const, icon: AlertCircle }
            ].map((item) => (
              <NMetricTile key={item.label} {...item} />
            ))}
          </section>

          {error ? <NoticeBanner tone="alert" title="نیاز به بررسی">{error}</NoticeBanner> : null}

          <div className="flex xl:hidden items-center justify-center p-1 mb-3 bg-app-surface/60 backdrop-blur-md border border-app-border rounded-lg shadow-hairline gap-1.5 max-w-md mx-auto w-full">
            <button
              type="button"
              onClick={() => setMobileView("grid")}
              className={`flex-1 py-3 px-3 rounded-md text-xs font-black text-center transition ${mobileView === "grid" ? "bg-white text-app-primary shadow-hairline border border-app-border/80" : "text-app-muted hover:text-app-text"}`}
            >
              <Grid3X3 className="inline-block ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              نمای تقویم
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileView("agenda");
                focusSelectedDayAgenda(activeDayKey);
              }}
              className={`flex-1 py-3 px-3 rounded-md text-xs font-black text-center transition ${mobileView === "agenda" ? "bg-white text-app-primary shadow-hairline border border-app-border/80" : "text-app-muted hover:text-app-text"}`}
            >
              <List className="inline-block ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              برنامه روز ({selectedDayPosts.length})
            </button>
          </div>

          <section className="calendar-pro-workspace grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <section className={`app-studio-panel calendar-pro-planner min-w-0 overflow-hidden rounded-lg ${mobileView === "grid" ? "block" : "hidden xl:block"}`}>
              <div className="calendar-pro-toolbar border-b border-app-border px-3 py-2.5 sm:py-3">
                <div className="calendar-toolbar-main">
                  <div className="calendar-toolbar-title-row flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-app-text">{viewMode === "week" ? dayRangeLabel(activeWeekDays) : formatJalaliMonth(monthAnchor)}</h2>
                    <div className="calendar-toolbar-status-chips flex flex-wrap items-center gap-2">
                      <StatusToken tone="neutral">{monthPostCount} پست در ماه</StatusToken>
                      {nextPost ? <StatusToken tone="success">بعدی: {formatJalaliDateTime(nextPost.scheduled_at)}</StatusToken> : null}
                      <StatusToken tone={attentionPosts.length ? "alert" : "success"}>{attentionPosts.length ? `${attentionPosts.length} نیازمند توجه` : "برنامه پایدار"}</StatusToken>
                      <StatusToken tone="info">پست زمان‌بندی‌شده را برای تغییر روز بکشید</StatusToken>
                      {reschedulingPostId ? <StatusToken tone="warning">در حال ذخیره جابجایی</StatusToken> : null}
                    </div>
                  </div>
                  <div className="calendar-month-controls" aria-label="کنترل بازه تقویم">
                    <button type="button" onClick={() => movePlannerMonth(1)} className="calendar-month-nav-button" aria-label="ماه بعد">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      <span>ماه بعد</span>
                    </button>
                    <button type="button" onClick={goToToday} className="calendar-today-button">
                      امروز
                    </button>
                    <button type="button" onClick={() => movePlannerMonth(-1)} className="calendar-month-nav-button" aria-label="ماه قبل">
                      <span>ماه قبل</span>
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="calendar-toolbar-filter-row mt-2 grid gap-2 2xl:grid-cols-[minmax(220px,1fr)_190px_auto_auto] 2xl:items-center">
                  <DataSearchField
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="جست‌وجوی عنوان، کپشن، کمپین یا خطا"
                  />
                  <label className="calendar-toolbar-campaign-filter flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted shadow-hairline">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      <option value="all">همه کمپین‌ها</option>
                      {campaignOptions.map((campaign) => <option key={campaign.value} value={campaign.value}>{campaign.label} · {campaign.count}</option>)}
                    </select>
                  </label>
                  <div className="calendar-segment-control" aria-label="نوع نمایش تقویم">
                    {viewModes.map((mode) => {
                      const Icon = mode.icon;
                      const active = viewMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => setViewMode(mode.value)}
                          className={`calendar-segment-option ${active ? "calendar-segment-option-active" : ""}`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="calendar-segment-control calendar-toolbar-density-toggle" aria-label="تراکم تقویم">
                    <button
                      type="button"
                      onClick={() => setDensityMode("compact")}
                      className={`calendar-segment-option ${densityMode === "compact" ? "calendar-segment-option-active" : ""}`}
                    >
                      <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      فشرده
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensityMode("comfortable")}
                      className={`calendar-segment-option ${densityMode === "comfortable" ? "calendar-segment-option-active" : ""}`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      باز
                    </button>
                  </div>
                </div>

                <div className="calendar-toolbar-status-filter-row mt-2 flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
                  <div className="calendar-status-filter-group">
                    {calendarFilters.map((filter) => {
                      const active = statusFilter === filter.value;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setStatusFilter(filter.value)}
                          className={`calendar-status-filter-chip ${active ? "calendar-status-filter-chip-active" : ""}`}
                        >
                          {filter.label}
                          <span>
                            {statusCount(calendarPosts, filter.value)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden items-center gap-2 text-[11px] font-bold text-app-muted 2xl:flex">
                      {[
                        { label: "زمان‌بندی", tone: "bg-blue-500" },
                        { label: "در انتشار", tone: "bg-sky-500" },
                        { label: "منتشر", tone: "bg-emerald-500" },
                        { label: "ناموفق", tone: "bg-rose-500" }
                      ].map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-1">
                          <span className={`h-2 w-2 rounded-full ${item.tone}`} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedCampaignOption && selectedCampaignWorkload ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-app-border bg-white px-3 py-2 shadow-hairline">
                    <span className="inline-flex items-center gap-2 text-xs font-black text-app-text">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedCampaignOption.color }} />
                      برنامه کمپین: {selectedCampaignOption.label}
                    </span>
                    <StatusToken tone="neutral">{selectedCampaignWorkload.total} در بازه</StatusToken>
                    <StatusToken tone="warning">{selectedCampaignWorkload.scheduled} زمان‌بندی</StatusToken>
                    <StatusToken tone="primary">{selectedCampaignWorkload.publishing} در انتشار</StatusToken>
                    <StatusToken tone="success">{selectedCampaignWorkload.published} منتشر</StatusToken>
                    <StatusToken tone={selectedCampaignWorkload.failed ? "alert" : "success"}>{selectedCampaignWorkload.failed} خطا</StatusToken>
                    {selectedCampaignIdForRoute ? <Button href={`/campaigns?campaignId=${selectedCampaignIdForRoute}`} variant="ghost" size="sm">مدیر کمپین</Button> : null}
                  </div>
                ) : null}
              </div>

              {loading ? <LoadingRows rows={5} /> : null}

              {!loading && viewMode !== "list" ? (
                <div className="calendar-planner-viewport">
                  <div className="calendar-planner-board">
                    <div className="calendar-week-header grid grid-cols-7 border-b border-app-border bg-slate-50 text-center text-xs font-black text-slate-500">
                      {weekDays.map((day) => <div key={day} className="px-2 py-2.5">{day}</div>)}
                    </div>
                    <div className="calendar-days-grid grid grid-cols-7">
                      {(viewMode === "week" ? activeWeekDays : monthGrid).map((day, index) => {
                        const dayPosts = day ? postsByDay.get(day.key) ?? [] : [];
                        const isToday = day?.key === todayKey;
                        const isSelectedDay = Boolean(day && activeDayKey === day.key);
                        const dayRisk = dayPosts.some((post) => {
                          const time = dateTime(post.scheduled_at);
                          return post.status === "failed" || (post.status === "scheduled" && time !== null && time < now);
                        });
                        const weekdayLabel = day ? weekDays[weekOffset(new Date(day.date))] : "";
                        const dayStateLabel = dayRisk ? "ریسک" : dayPosts.length ? `${dayPosts.length} پست` : "خالی";

                        const hasConflict = day ? hasDayConflicts(dayPosts) : false;

                        return (
                          <div
                            key={day?.key ?? `empty-${index}`}
                            onClick={() => day ? selectDay(day, dayPosts, true) : undefined}
                            onDragOver={(event) => day ? allowDropOnDay(event, day) : undefined}
                            onDrop={(event) => day ? dropPostOnDay(event, day) : undefined}
                            className={`calendar-day-cell ${day ? "" : "calendar-day-empty"} ${calendarCellHeight} ${dayPosts.length ? "calendar-day-has-posts" : ""} ${dayRisk ? "calendar-day-risk" : ""} ${isToday ? "calendar-day-today" : ""} ${isSelectedDay ? "calendar-day-selected" : ""} ${day && draggingPostId && dragTargetDayKey === day.key ? "calendar-day-drop-target" : ""} ${day && draggingPostId ? "calendar-day-can-drop" : ""}`}
                          >
                            {day ? (
                              <>
                                <div className="calendar-day-head">
                                  <span className="calendar-day-date">
                                    <span className="calendar-day-weekday">{weekdayLabel}</span>
                                    <span className="calendar-day-number">{day.day}</span>
                                    {hasConflict ? (
                                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="تداخل فاصله انتشار کمتر از ۹۰ دقیقه" />
                                    ) : null}
                                  </span>
                                  <div className="calendar-day-actions">
                                    <span className="calendar-day-state">{dayStateLabel}</span>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openQuickCreate(day.date);
                                      }}
                                      className="calendar-day-add"
                                      aria-label={`افزودن پست در ${formatJalaliDate(day.date)}`}
                                      title="افزودن پست در این روز"
                                    >
                                      <Plus className="calendar-day-add-icon" aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                                <div className="calendar-day-posts" onClick={viewMode === "week" ? (event) => event.stopPropagation() : undefined}>
                                  {viewMode === "month" ? (
                                    renderMonthDayDensity(dayPosts, Math.max(0, dayPosts.length - 3))
                                  ) : (
                                    <>
                                      {dayPosts.slice(0, visiblePostLimit).map((post) => renderPostChip(post, false))}
                                      {dayPosts.length > visiblePostLimit ? (
                                        <button
                                          type="button"
                                          className="calendar-day-more"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            selectDay(day, dayPosts, true);
                                          }}
                                        >
                                          +{dayPosts.length - visiblePostLimit} مورد دیگر
                                        </button>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {!loading && viewMode === "list" && filteredPosts.length > 0 ? (
                <div>
                  <div className="hidden grid-cols-[150px_minmax(0,1fr)_140px_110px] gap-4 border-b border-app-border bg-slate-50 px-4 py-3 text-xs font-black text-app-muted lg:grid">
                    <span>زمان</span>
                    <span>محتوا</span>
                    <span>وضعیت</span>
                    <span>عملیات</span>
                  </div>
                  <div className="divide-y divide-app-border">
                    {filteredPosts.map((post) => {
                      const asset = assetByPostId.get(post.id);
                      const previewUrl = asset ? mediaPreviewUrls[asset.id] : "";
                      return (
                      <article key={post.id} className="relative grid gap-3 overflow-hidden px-4 py-3 transition hover:bg-slate-50 lg:grid-cols-[150px_minmax(0,1fr)_140px_110px] lg:items-center">
                        <span className="absolute inset-y-0 right-0 w-1" style={{ backgroundColor: campaignColorForPost(post, campaigns) }} />
                        <div className="text-xs leading-6 text-app-muted">
                          <p className="font-bold text-app-text">{formatJalaliDate(post.scheduled_at)}</p>
                          <p>{formatJalaliTime(post.scheduled_at)}</p>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          {previewUrl ? (
                            <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-app-border" />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-app-surfaceMuted text-slate-400 shadow-hairline">
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-app-text">{post.title}</span>
                            <span className="mt-1 block truncate text-sm text-app-muted">{campaignKeyForPost(post) !== "none" ? campaignLabelForPost(post, campaigns) : post.caption || "بدون کمپین"}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={post.status} />
                          <ChannelBadges platform={post.platform} compact />
                          <CountdownBadge status={post.status} scheduledAt={post.scheduled_at} />
                        </div>
                        <Button type="button" variant={selectedPost?.id === post.id ? "primary" : "secondary"} size="sm" onClick={() => selectPost(post)}>
                          جزئیات
                        </Button>
                      </article>
                    );
                    })}
                  </div>
                </div>
              ) : null}

              {!loading && viewMode === "list" && filteredPosts.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                    title="پستی برای این فیلتر وجود ندارد"
                    description="فیلتر را تغییر دهید یا برای روز انتخاب‌شده یک پست جدید بسازید."
                    action={<Button type="button" onClick={() => openQuickCreate(selectedDayValue)}>ایجاد پست زمان‌بندی‌شده</Button>}
                  />
                </div>
              ) : null}
            </section>

            <aside ref={agendaRef} className={`calendar-action-rail overflow-y-auto max-h-[85vh] xl:max-h-none ${agendaPulseKey ? "calendar-day-agenda-pulse" : ""} ${mobileView === "agenda" ? "block" : "hidden xl:block"}`} aria-label="عملیات برنامه‌ریز">
              <div className="calendar-action-rail-head">
                <div className="min-w-0">
                  <p className="app-section-kicker text-[10px] font-black">مرکز کنترل</p>
                  <h2>برنامه روز {selectedDayLabel}</h2>
                  <p>{selectedDayPosts.length ? `${selectedDayPosts.length} پست زمان‌دار برای این روز` : "روز آزاد برای ساخت برنامه جدید"}</p>
                </div>
                <div className="calendar-action-rail-context flex flex-col gap-1 items-end">
                  <StatusToken tone={selectedDayInsights.conflicts.length || selectedDayInsights.failed.length || selectedDayInsights.rubikaBlocked ? "alert" : selectedDayInsights.missingMedia.length ? "warning" : "success"}>
                    {selectedDayInsights.conflicts.length || selectedDayInsights.failed.length || selectedDayInsights.rubikaBlocked ? "نیازمند رسیدگی" : selectedDayInsights.missingMedia.length ? "قابل بهبود" : "آماده انتشار"}
                  </StatusToken>
                  <StatusToken tone="neutral">{selectedDayPosts.length} پست</StatusToken>
                </div>
              </div>

              {/* Next Action Banner */}
              <div className="calendar-day-next-action mt-3" data-tone={selectedDayNextAction.tone}>
                <span className="calendar-day-next-action-icon" aria-hidden="true">
                  {selectedDayNextAction.tone === "alert" ? <AlertCircle className="h-4 w-4" /> : selectedDayNextAction.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <strong className="block text-xs font-black">{selectedDayNextAction.title}</strong>
                  <small className="block text-[10px] text-app-muted mt-0.5">{selectedDayNextAction.detail}</small>
                </span>
              </div>

              {/* Slot Timeline */}
              <div className="calendar-day-slot-studio mt-3" aria-label="مسیر زمانی روز انتخاب‌شده">
                <div className="calendar-day-slot-studio-head flex justify-between items-center text-xs mb-1.5">
                  <p className="font-black text-app-text">مسیر زمانی روز</p>
                  <span className="text-[10px] text-app-muted">{selectedDayTimeline.length ? `${selectedDayTimeline.length} نقطه زمانی` : "بدون برنامه"}</span>
                </div>
                <div className="calendar-day-slot-rail flex gap-1.5 overflow-x-auto pb-1">
                  {selectedDayTimeline.length ? selectedDayTimeline.map((item) => (
                    item.type === "post" ? (
                      <button
                        key={`post-${item.post.id}`}
                        type="button"
                        className="calendar-day-slot-pill calendar-day-slot-pill-post flex-shrink-0 text-right p-1.5 rounded border border-app-border text-[10px] bg-white min-w-[100px]"
                        style={{ "--campaign-accent": item.accent } as CSSProperties}
                        onClick={() => {
                          selectPost(item.post);
                          setQuickPreviewPostId(item.post.id);
                        }}
                      >
                        <span className="text-app-muted block font-semibold">{item.label}</span>
                        <strong className="text-app-text block truncate font-black mt-0.5">{item.post.title}</strong>
                      </button>
                    ) : (
                      <button
                        key={`slot-${item.hour}`}
                        type="button"
                        className="calendar-day-slot-pill calendar-day-slot-pill-free flex-shrink-0 text-right p-1.5 rounded border border-dashed border-app-border text-[10px] bg-slate-50 min-w-[100px]"
                        onClick={() => openQuickCreateAt(selectedDayValue, item.hour, 0)}
                      >
                        <span className="text-app-muted block font-semibold">{item.label}</span>
                        <strong className="text-app-primary block font-black mt-0.5">زمان خالی</strong>
                      </button>
                    )
                  )) : (
                    <button type="button" className="calendar-day-slot-pill calendar-day-slot-pill-free flex-shrink-0 text-right p-1.5 rounded border border-dashed border-app-border text-[10px] bg-slate-50 w-full" onClick={() => openQuickCreate(selectedDayValue)}>
                      <span className="text-app-muted block">۰۹:۰۰</span>
                      <strong className="text-app-primary block font-black">شروع برنامه</strong>
                    </button>
                  )}
                </div>
              </div>

              {/* Day Agenda Posts List */}
              <div className="calendar-day-agenda-list mt-3 flex flex-col gap-2">
                {selectedDayPosts.length ? selectedDayPosts.map((post) => renderAgendaPost(post)) : (
                  <EmptyState
                    icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                    title="برای این روز هنوز برنامه‌ای نیست"
                    description="یک زمان پیشنهادی انتخاب کنید یا پست تازه بسازید."
                    action={<Button type="button" onClick={() => openQuickCreate(selectedDayValue)}>ساخت پست برای این روز</Button>}
                  />
                )}
              </div>

              {/* Actions Stack */}
              <div className="calendar-action-rail-stack flex flex-col gap-2 mt-4 pt-3 border-t border-app-border">
                <Button type="button" onClick={() => openQuickCreate(selectedDayValue)} className="calendar-action-primary w-full justify-center" size="sm">
                  <Plus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  پست جدید برای این روز
                </Button>
                {selectedPost ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" className="w-full justify-center" onClick={() => setQuickPreviewPostId(selectedPost.id)}>
                      پیش‌نمایش پست انتخابی
                    </Button>
                    {canReschedule(selectedPost) ? (
                      <Button type="button" variant="secondary" size="sm" className="w-full justify-center" onClick={() => openRescheduleDraft(selectedPost, selectedDayValue)}>
                        تغییر زمان پست
                      </Button>
                    ) : null}
                    <Button href={`/compose?postId=${selectedPost.id}`} variant="secondary" className="w-full justify-center" size="sm">
                      ویرایش پست انتخابی
                    </Button>
                  </>
                ) : null}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button href="/queue" variant="ghost" className="w-full justify-center shadow-hairline border border-app-border/80 text-xs" size="sm">صف انتشار</Button>
                  <Button href="/campaigns" variant="ghost" className="w-full justify-center shadow-hairline border border-app-border/80 text-xs" size="sm">مدیر کمپین</Button>
                </div>
              </div>

              <div className="calendar-action-rail-status mt-3 pt-3 border-t border-app-border text-center">
                {attentionPosts.length ? (
                  <Link href="/content?status=failed" className="calendar-action-rail-alert inline-flex w-full justify-center">
                    <AlertCircle className="h-4 w-4 ml-1.5" aria-hidden="true" />
                    {attentionPosts.length} مورد نیازمند رسیدگی
                  </Link>
                ) : (
                  <p className="calendar-action-rail-ok inline-flex w-full justify-center">
                    <CheckCircle2 className="h-4 w-4 ml-1.5" aria-hidden="true" />
                    برنامه انتشار پایدار است
                  </p>
                )}
              </div>
            </aside>
          </section>

          {quickPreviewPost ? (
            isMobile ? (
              <NInspectorDrawer
                open={Boolean(quickPreviewPost)}
                title="جزئیات انتشار"
                description={quickPreviewPost.title}
                onClose={() => setQuickPreviewPostId(null)}
                side="left"
                footer={renderPostPreviewFooter(quickPreviewPost)}
              >
                {renderPostPreviewContent(quickPreviewPost)}
              </NInspectorDrawer>
            ) : typeof document !== "undefined" ? (
              createPortal(
                <div className="calendar-post-preview-backdrop" role="presentation" onClick={() => setQuickPreviewPostId(null)}>
                  <section className="calendar-post-preview-modal calendar-post-detail-sheet animate-nashville-in" role="dialog" aria-modal="true" aria-label={`جزئیات ${quickPreviewPost.title}`} onClick={(event) => event.stopPropagation()}>
                    <div className="calendar-post-preview-head border-b border-app-border pb-3 mb-3">
                      <div className="min-w-0">
                        <p className="app-section-kicker text-[10px] font-black">جزئیات انتشار</p>
                        <h2 className="text-sm font-black text-app-text mt-1">{quickPreviewPost.title}</h2>
                        <p className="text-[10px] text-app-muted mt-0.5">{formatJalaliDateTime(quickPreviewPost.scheduled_at)} · {campaignLabelForPost(quickPreviewPost, campaigns)}</p>
                      </div>
                      <button type="button" className="calendar-post-preview-close" onClick={() => setQuickPreviewPostId(null)} aria-label="بستن پیش‌نمایش">
                        <X className="calendar-post-preview-close-icon" aria-hidden="true" />
                      </button>
                    </div>
                    {renderPostPreviewContent(quickPreviewPost)}
                    {renderPostPreviewFooter(quickPreviewPost)}
                  </section>
                </div>,
                document.body
              )
            ) : null
          ) : null}

          {rescheduleDraftPost ? (
            isMobile ? (
              <NInspectorDrawer
                open={Boolean(rescheduleDraftPost)}
                title="زمان‌بندی سریع"
                description={rescheduleDraftPost.title}
                onClose={() => setRescheduleDraftPostId(null)}
                side="left"
                footer={renderRescheduleFooter(rescheduleDraftPost)}
              >
                {renderRescheduleContent(rescheduleDraftPost)}
              </NInspectorDrawer>
            ) : typeof document !== "undefined" ? (
              createPortal(
                <div className="calendar-post-preview-backdrop" role="presentation" onClick={() => setRescheduleDraftPostId(null)}>
                  <section className="calendar-reschedule-modal animate-nashville-in" role="dialog" aria-modal="true" aria-label={`تغییر زمان ${rescheduleDraftPost.title}`} onClick={(event) => event.stopPropagation()}>
                    <div className="calendar-post-preview-head border-b border-app-border pb-3 mb-3">
                      <div className="min-w-0">
                        <p className="app-section-kicker text-[10px] font-black">زمان‌بندی سریع</p>
                        <h2 className="text-sm font-black text-app-text mt-1">{rescheduleDraftPost.title}</h2>
                        <p className="text-[10px] text-app-muted mt-0.5">روز مقصد: {rescheduleDraftDay ? formatJalaliDate(rescheduleDraftDay) : "انتخاب نشده"} · زمان فعلی: {formatJalaliDateTime(rescheduleDraftPost.scheduled_at)}</p>
                      </div>
                      <button type="button" className="calendar-post-preview-close" onClick={() => setRescheduleDraftPostId(null)} aria-label="بستن تغییر زمان">
                        <X className="calendar-post-preview-close-icon" aria-hidden="true" />
                      </button>
                    </div>
                    {renderRescheduleContent(rescheduleDraftPost)}
                    {renderRescheduleFooter(rescheduleDraftPost)}
                  </section>
                </div>,
                document.body
              )
            ) : null
          ) : null}
          <PlannerComposerDrawer scheduledAt={quickCreateAt} defaultCampaign={selectedCampaignOption?.label ?? ""} onClose={() => setQuickCreateAt(null)} onCreated={() => loadPosts(true)} />
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

