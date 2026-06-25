"use client";

import { Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowDownUp, ArrowUpLeft, CalendarClock, CheckCircle2, Clock3, FileImage, ImageIcon, Layers3, LineChart, Link2 as LinkIcon, MessageSquareText, Search, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { WorkspaceAvatar } from "../../components/brand-mark";
import { LoadingPanel } from "../../components/loading-skeleton";
import { NNotice, NPage, NPageHeader, NSavedViewToolbar } from "../../components/nashrino-ui";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { Panel } from "../../components/ui/panel";
import { MetricTile } from "../../components/ui/metric-tile";
import { Tag } from "../../components/ui/tag";
import { DataRow, DataTable } from "../../components/ui/data-row";
import { DetailGrid, EmptyState, StatusToken } from "../../components/workspace-ui";
import { buildCampaignFilterOptions, campaignColorForPost, campaignKeyForPost, campaignLabelForPost, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { useMediaPreviewUrl } from "../../lib/media-preview";
import { apiUrl, authHeaders, formatDateTime, type Post } from "../../lib/posts";
import { loadWorkspaceOverview, type StoreProfile } from "../../lib/workspace";
import { loadAutomationEvents, loadLinkMetrics, type InstagramAutomationEvent, type LinkClickStats } from "../../lib/automation";


type PublishAttempt = {
  id: number;
  post_id: number;
  post_title: string;
  action: string;
  status: string;
  request_payload: string;
  response_payload: string;
  error: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  folder: string;
  tags: string;
  url: string;
};

type TimeRange = "7d" | "30d" | "90d" | "all";
type PostFilter = "all" | "failed" | "queued" | "published" | "draft";
type PostSort = "activity" | "attempts" | "title";
type ParsedPayload = Record<string, unknown> | null;

const rangeOptions: Array<{ label: string; value: TimeRange }> = [
  { label: "۷ روز", value: "7d" },
  { label: "۳۰ روز", value: "30d" },
  { label: "۹۰ روز", value: "90d" },
  { label: "همه داده‌ها", value: "all" }
];

const postFilterOptions: Array<{ label: string; value: PostFilter }> = [
  { label: "همه", value: "all" },
  { label: "نیازمند توجه", value: "failed" },
  { label: "در جریان", value: "queued" },
  { label: "منتشرشده", value: "published" },
  { label: "پیش‌نویس", value: "draft" }
];

const statusLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  ready: "آماده",
  scheduled: "زمان‌بندی",
  publishing: "در حال انتشار",
  published: "منتشر",
  failed: "ناموفق",
  cancelled: "لغوشده"
};

const statusProgressClasses: Record<string, string> = {
  draft: "bg-slate-400",
  ready: "bg-sky-500",
  scheduled: "bg-blue-500",
  publishing: "bg-amber-500",
  published: "bg-emerald-500",
  failed: "bg-rose-500",
  cancelled: "bg-slate-300"
};

function parsePayload(value: string): ParsedPayload {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function attemptMode(attempt: PublishAttempt) {
  const payload = parsePayload(attempt.request_payload);
  if (payload?.mode === "media" || payload?.media_asset_id) return "media";
  return "text";
}

function toTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
}

function rangeStart(range: TimeRange) {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function rangeDays(range: TimeRange) {
  if (range === "all") return null;
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

function isInRange(value: string | null | undefined, range: TimeRange) {
  const start = rangeStart(range);
  if (start === null) return true;
  const time = toTime(value);
  return time !== null && time >= start;
}

function isInPreviousRange(value: string | null | undefined, range: TimeRange) {
  const days = rangeDays(range);
  const time = toTime(value);
  if (!days || time === null) return false;
  const duration = days * 24 * 60 * 60 * 1000;
  const end = Date.now() - duration;
  return time >= end - duration && time < end;
}

function postActivityDate(post: Post) {
  return post.published_at || post.failed_at || post.scheduled_at || post.updated_at || post.created_at;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  if (key === "unknown") return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(`${key}T00:00:00Z`));
}

function trendRangeLabel(startKey: string, endKey: string) {
  if (startKey === endKey) return dayLabel(startKey);
  return `${dayLabel(startKey)} تا ${dayLabel(endKey)}`;
}

function deltaPercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function summarizeAttempts(source: PublishAttempt[]) {
  const success = source.filter((attempt) => attempt.status === "success").length;
  const failed = source.filter((attempt) => attempt.status === "failed").length;
  const started = source.filter((attempt) => attempt.status === "started").length;
  const media = source.filter((attempt) => attemptMode(attempt) === "media").length;
  const text = source.length - media;
  const completed = success + failed;
  return { success, failed, started, media, text, completed, successRate: percent(success, completed) };
}

function postHealthScore(post: Post, hasMedia: boolean) {
  let score = 50;
  if (post.status === "published") score += 32;
  if (post.status === "scheduled" || post.status === "ready") score += 16;
  if (post.status === "failed" || post.last_error) score -= 34;
  if (hasMedia) score += 10;
  if (post.caption.trim()) score += 5;
  if (post.hashtags.trim()) score += 3;
  score -= Math.min(18, Math.max(0, post.attempt_count - 1) * 6);
  return Math.max(0, Math.min(100, score));
}

function hourLabel(hour: number | null) {
  if (hour === null) return "نامشخص";
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function AnalyticsPanel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "mt-4",
  variant = "glass"
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  variant?: "glass" | "solid" | "muted";
}) {
  return (
    <Panel variant={variant} className={`flex flex-col ${className}`}>
      <div className="flex flex-col justify-between gap-2 border-b border-app-border/40 pb-3 mb-4 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-app-text">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </Panel>
  );
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [automationEvents, setAutomationEvents] = useState<InstagramAutomationEvent[]>([]);
  const [linkMetrics, setLinkMetrics] = useState<LinkClickStats[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [selectedTrendKey, setSelectedTrendKey] = useState("");
  const [postFilter, setPostFilter] = useState<PostFilter>("all");
  const [postSort, setPostSort] = useState<PostSort>("activity");
  const [postSearch, setPostSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    const headers = authHeaders();
    const [postsResponse, attemptsResponse, campaignsResponse, mediaResponse, overview, events, links] = await Promise.all([
      fetch(`${apiUrl}/posts`, { headers }),
      fetch(`${apiUrl}/publish-attempts`, { headers }),
      loadCampaigns(),
      fetch(`${apiUrl}/media`, { headers }),
      loadWorkspaceOverview(),
      loadAutomationEvents().catch(() => []),
      loadLinkMetrics().catch(() => [])
    ]);

    if (!postsResponse.ok) throw new Error("دریافت پست‌ها برای تحلیل ناموفق بود");
    if (!attemptsResponse.ok) throw new Error("دریافت لاگ انتشار برای تحلیل ناموفق بود");

    setPosts(await postsResponse.json());
    setAttempts(await attemptsResponse.json());
    setCampaigns(campaignsResponse);
    setMediaAssets(mediaResponse.ok ? await mediaResponse.json() : []);
    setStore(overview.store);
    setAutomationEvents(events);
    setLinkMetrics(links);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAnalytics().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت تحلیل عملکرد");
      setLoading(false);
    });
  }, [loadAnalytics]);

  useEffect(() => {
    if (!selectedTrendKey) return;
    function clearSelectedTrend(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-trend-inspector]")) return;
      setSelectedTrendKey("");
    }
    document.addEventListener("pointerdown", clearSelectedTrend);
    return () => document.removeEventListener("pointerdown", clearSelectedTrend);
  }, [selectedTrendKey]);

  useEffect(() => {
    if (mediaAssets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const imageAssets = mediaAssets
        .filter((asset) => asset.post_id && asset.content_type.startsWith("image/"))
        .slice(0, 36);
      const entries = await Promise.all(
        imageAssets.map(async (asset) => {
          try {
            const response = await fetch(`${apiUrl}/media/${asset.id}/file`, {
              headers: authHeaders()
            });
            if (!response.ok) return null;
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return [asset.id, url] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setMediaPreviewUrls(Object.fromEntries(entries.filter(Boolean) as Array<[number, string]>));
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaAssets]);

  const rangePosts = useMemo(() => posts.filter((post) => isInRange(postActivityDate(post), timeRange)), [posts, timeRange]);
  const previousRangePosts = useMemo(() => posts.filter((post) => isInPreviousRange(postActivityDate(post), timeRange)), [posts, timeRange]);
  const campaignOptions = useMemo(() => buildCampaignFilterOptions(rangePosts, campaigns), [campaigns, rangePosts]);
  const scopedPosts = useMemo(() => {
    return rangePosts.filter((post) => campaignFilter === "all" || campaignKeyForPost(post) === campaignFilter);
  }, [campaignFilter, rangePosts]);
  const scopedPostIds = useMemo(() => new Set(scopedPosts.map((post) => post.id)), [scopedPosts]);
  const scopedAttempts = useMemo(() => {
    return attempts.filter((attempt) => isInRange(attempt.created_at, timeRange) && (campaignFilter === "all" || scopedPostIds.has(attempt.post_id)));
  }, [attempts, campaignFilter, scopedPostIds, timeRange]);
  const previousPosts = useMemo(() => {
    return previousRangePosts.filter((post) => campaignFilter === "all" || campaignKeyForPost(post) === campaignFilter);
  }, [campaignFilter, previousRangePosts]);
  const previousPostIds = useMemo(() => new Set(previousPosts.map((post) => post.id)), [previousPosts]);
  const previousAttempts = useMemo(() => {
    return attempts.filter((attempt) => isInPreviousRange(attempt.created_at, timeRange) && (campaignFilter === "all" || previousPostIds.has(attempt.post_id)));
  }, [attempts, campaignFilter, previousPostIds, timeRange]);
  const mediaByPostId = useMemo(() => {
    const grouped = new Map<number, MediaAsset[]>();
    mediaAssets.forEach((asset) => {
      if (!asset.post_id) return;
      grouped.set(asset.post_id, [...(grouped.get(asset.post_id) ?? []), asset]);
    });
    return grouped;
  }, [mediaAssets]);

  const statusCounts = useMemo(() => {
    return scopedPosts.reduce<Record<string, number>>((acc, post) => {
      acc[post.status] = (acc[post.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [scopedPosts]);

  const attemptSummary = useMemo(() => summarizeAttempts(scopedAttempts), [scopedAttempts]);
  const previousAttemptSummary = useMemo(() => summarizeAttempts(previousAttempts), [previousAttempts]);
  const previousStatusCounts = useMemo(() => {
    return previousPosts.reduce<Record<string, number>>((acc, post) => {
      acc[post.status] = (acc[post.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [previousPosts]);

  const trend = useMemo(() => {
    const start = rangeStart(timeRange);
    const sourceAttempts = timeRange === "all" ? scopedAttempts.slice(0, 14) : scopedAttempts;
    const keys = new Set<string>();

    if (start !== null) {
      const days = rangeDays(timeRange) ?? 30;
      for (let index = days - 1; index >= 0; index -= 1) {
        keys.add(dayKey(new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString()));
      }
    } else {
      sourceAttempts.forEach((attempt) => keys.add(dayKey(attempt.created_at)));
    }

    const dailyTrend = Array.from(keys).sort().map((key) => {
      const dayAttempts = scopedAttempts.filter((attempt) => dayKey(attempt.created_at) === key);
      const success = dayAttempts.filter((attempt) => attempt.status === "success").length;
      const failed = dayAttempts.filter((attempt) => attempt.status === "failed").length;
      const started = dayAttempts.filter((attempt) => attempt.status === "started").length;
      return { key, startKey: key, endKey: key, label: dayLabel(key), success, failed, started, total: dayAttempts.length };
    });

    const bucketSize = timeRange === "7d" ? 1 : timeRange === "30d" ? 2 : timeRange === "90d" ? 7 : Math.max(1, Math.ceil(dailyTrend.length / 12));
    if (bucketSize === 1) return dailyTrend;

    const buckets = [];
    for (let index = 0; index < dailyTrend.length; index += bucketSize) {
      const slice = dailyTrend.slice(index, index + bucketSize);
      const startKey = slice[0]?.startKey ?? "unknown";
      const endKey = slice[slice.length - 1]?.endKey ?? startKey;
      buckets.push({
        key: `${startKey}-${endKey}`,
        startKey,
        endKey,
        label: trendRangeLabel(startKey, endKey),
        success: slice.reduce((sum, item) => sum + item.success, 0),
        failed: slice.reduce((sum, item) => sum + item.failed, 0),
        started: slice.reduce((sum, item) => sum + item.started, 0),
        total: slice.reduce((sum, item) => sum + item.total, 0)
      });
    }
    return buckets;
  }, [scopedAttempts, timeRange]);

  const maxTrendTotal = Math.max(1, ...trend.map((item) => item.total));
  const trendTickInterval = timeRange === "7d" ? 1 : timeRange === "30d" ? 2 : timeRange === "90d" ? 1 : Math.max(1, Math.ceil(trend.length / 6));
  function showTrendTick(index: number) {
    return index === 0 || index === trend.length - 1 || index % trendTickInterval === 0;
  }
  const selectedTrend = trend.find((item) => item.key === selectedTrendKey) ?? null;
  const selectedTrendAttempts = useMemo(() => {
    if (!selectedTrendKey) return [];
    return scopedAttempts
      .filter((attempt) => {
        const key = dayKey(attempt.created_at);
        const selected = trend.find((item) => item.key === selectedTrendKey);
        return selected ? key >= selected.startKey && key <= selected.endKey : key === selectedTrendKey;
      })
      .sort((first, second) => (toTime(second.created_at) ?? 0) - (toTime(first.created_at) ?? 0))
      .slice(0, 5);
  }, [scopedAttempts, selectedTrendKey, trend]);
  const failedPosts = scopedPosts.filter((post) => post.status === "failed" || post.last_error).slice(0, 5);
  const queuedPosts = scopedPosts.filter((post) => ["ready", "scheduled", "publishing"].includes(post.status)).slice(0, 5);
  const highAttemptPosts = useMemo(() => {
    return [...scopedPosts]
      .sort((first, second) => second.attempt_count - first.attempt_count)
      .filter((post) => post.attempt_count > 0)
      .slice(0, 5);
  }, [scopedPosts]);
  const mediaAttachedCount = scopedPosts.filter((post) => (mediaByPostId.get(post.id) ?? []).length > 0).length;
  const visualReadinessRate = percent(mediaAttachedCount, scopedPosts.length);
  const bestPublishHour = useMemo(() => {
    const buckets = new Map<number, number>();
    scopedAttempts
      .filter((attempt) => attempt.status === "success")
      .forEach((attempt) => {
        const time = toTime(attempt.finished_at || attempt.created_at);
        if (time === null) return;
        const hour = new Date(time).getHours();
        buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
      });
    const sorted = Array.from(buckets.entries()).sort((first, second) => second[1] - first[1]);
    return sorted[0] ? { hour: sorted[0][0], count: sorted[0][1] } : null;
  }, [scopedAttempts]);
  const campaignPerformance = useMemo(() => {
    const grouped = new Map<string, { label: string; color: string; total: number; published: number; failed: number; queued: number; media: number }>();
    scopedPosts.forEach((post) => {
      const campaign = campaignKeyForPost(post);
      const current = grouped.get(campaign) ?? { label: campaignLabelForPost(post, campaigns), color: campaignColorForPost(post, campaigns), total: 0, published: 0, failed: 0, queued: 0, media: 0 };
      current.total += 1;
      if (post.status === "published") current.published += 1;
      if (post.status === "failed" || post.last_error) current.failed += 1;
      if (["ready", "scheduled", "publishing"].includes(post.status)) current.queued += 1;
      if ((mediaByPostId.get(post.id) ?? []).length > 0) current.media += 1;
      grouped.set(campaign, current);
    });
    return Array.from(grouped.entries())
      .map(([campaignKey, stats]) => ({
        campaignKey,
        ...stats,
        score: stats.published * 3 + stats.queued * 1.5 + stats.media - stats.failed * 2
      }))
      .sort((first, second) => second.score - first.score || second.total - first.total)
      .slice(0, 4);
  }, [campaigns, mediaByPostId, scopedPosts]);
  const topOperationalPosts = useMemo(() => {
    return [...scopedPosts]
      .map((post) => {
        const media = mediaByPostId.get(post.id) ?? [];
        return {
          post,
          media,
          score: postHealthScore(post, media.length > 0)
        };
      })
      .sort((first, second) => second.score - first.score || (toTime(postActivityDate(second.post)) ?? 0) - (toTime(postActivityDate(first.post)) ?? 0))
      .slice(0, 4);
  }, [mediaByPostId, scopedPosts]);
  const lastAttempt = scopedAttempts[0] ?? null;
  const publishedCount = statusCounts.published ?? 0;
  const failedCount = (statusCounts.failed ?? 0) + attemptSummary.failed;
  const queuedCount = (statusCounts.ready ?? 0) + (statusCounts.scheduled ?? 0) + (statusCounts.publishing ?? 0);
  const brandColor = store?.brand_primary_color || "#0F766E";
  const brandAccentColor = store?.brand_accent_color || "#2563EB";
  const brandAvatarUrl = useMediaPreviewUrl(store?.avatar_asset_id ?? store?.logo_asset_id);
  const brandLogoUrl = useMediaPreviewUrl(store?.logo_asset_id);
  const previousPublishedCount = previousStatusCounts.published ?? 0;
  const previousQueuedCount = (previousStatusCounts.ready ?? 0) + (previousStatusCounts.scheduled ?? 0) + (previousStatusCounts.publishing ?? 0);
  const successRateDelta = attemptSummary.successRate - previousAttemptSummary.successRate;
  const hasComparison = timeRange !== "all";
  
  const autoRepliesCount = automationEvents.filter(e => e.event_status === "sent").length;
  const operatorTakeoversCount = automationEvents.filter(e => e.conversation_status === "operator_takeover").length;
  const autoRepliesDelta = 0; // Stub for delta
  
  const totalAutomationTriggers = automationEvents.filter(e => e.event_status !== "no_match").length;
  const totalLinkClicks = linkMetrics.reduce((acc, link) => acc + link.total_clicks, 0);
  const topLinks = [...linkMetrics].sort((a, b) => b.total_clicks - a.total_clicks).slice(0, 5);
  const drilldownPosts = useMemo(() => {
    const normalizedSearch = postSearch.trim().toLowerCase();
    const queuedStatuses = ["ready", "scheduled", "publishing"];
    return scopedPosts
      .filter((post) => {
        const matchesSearch = !normalizedSearch || `${post.title} ${post.caption} ${campaignLabelForPost(post, campaigns)} ${post.status}`.toLowerCase().includes(normalizedSearch);
        const matchesFilter =
          postFilter === "all" ||
          (postFilter === "failed" && (post.status === "failed" || Boolean(post.last_error))) ||
          (postFilter === "queued" && queuedStatuses.includes(post.status)) ||
          post.status === postFilter;
        return matchesSearch && matchesFilter;
      })
      .sort((first, second) => {
        if (postSort === "attempts") return second.attempt_count - first.attempt_count;
        if (postSort === "title") return first.title.localeCompare(second.title, "fa");
        return (toTime(postActivityDate(second)) ?? 0) - (toTime(postActivityDate(first)) ?? 0);
      });
  }, [campaigns, postFilter, postSearch, postSort, scopedPosts]);
  const dashboardMetrics = [
    { label: "منتشرشده", value: publishedCount, detail: "خروجی موفق در بازه", icon: CheckCircle2, tone: "text-emerald-700", tileTone: "success" as const, delta: deltaPercent(publishedCount, previousPublishedCount), positiveIsGood: true, href: "/content?status=published" },
    { label: "موفقیت ارسال", value: `${attemptSummary.successRate}%`, detail: `${attemptSummary.success} از ${attemptSummary.completed} تلاش کامل`, icon: Target, tone: attemptSummary.successRate >= 80 ? "text-emerald-700" : "text-amber-700", tileTone: attemptSummary.successRate >= 80 ? "success" as const : "warning" as const, delta: successRateDelta, positiveIsGood: true, href: "/logs" },
    { label: "دایرکت خودکار", value: autoRepliesCount, detail: `${operatorTakeoversCount} ارجاع به اپراتور`, icon: Zap, tone: "text-purple-700", tileTone: "neutral" as const, delta: autoRepliesDelta, positiveIsGood: true, href: "/inbox" },
    { label: "در جریان", value: queuedCount, detail: "آماده، زمان‌بندی یا ارسال", icon: CalendarClock, tone: "text-app-primary", tileTone: "primary" as const, delta: deltaPercent(queuedCount, previousQueuedCount), positiveIsGood: true, href: "/queue" }
  ];
  const insightCards = [
    {
      title: "بهترین پنجره ارسال",
      value: bestPublishHour ? hourLabel(bestPublishHour.hour) : "در انتظار داده",
      detail: bestPublishHour ? `${bestPublishHour.count} ارسال موفق در این ساعت ثبت شده` : "پس از چند ارسال موفق، پنجره پیشنهادی مشخص می‌شود.",
      icon: Clock3,
      tone: "text-sky-700",
      token: bestPublishHour ? "زمان پیشنهادی" : "داده کم"
    },
    {
      title: "آمادگی بصری محتوا",
      value: `${visualReadinessRate}%`,
      detail: `${mediaAttachedCount} از ${scopedPosts.length} پست این بازه رسانه متصل دارند.`,
      icon: ImageIcon,
      tone: visualReadinessRate >= 60 ? "text-emerald-700" : "text-amber-700",
      token: visualReadinessRate >= 60 ? "پوشش مناسب" : "نیاز به رسانه"
    },
    {
      title: "کمپین پیشرو",
      value: campaignPerformance[0]?.label ?? "نامشخص",
      detail: campaignPerformance[0] ? `${campaignPerformance[0].published} منتشرشده، ${campaignPerformance[0].queued} در جریان` : "هنوز کمپین قابل رتبه‌بندی وجود ندارد.",
      icon: Layers3,
      tone: "text-app-primary",
      token: campaignPerformance[0] ? "سیگنال کمپین" : "بدون کمپین"
    }
  ];

  function primaryMediaForPost(post: Post) {
    return (mediaByPostId.get(post.id) ?? [])[0] ?? null;
  }

  function previewUrlForPost(post: Post) {
    const asset = primaryMediaForPost(post);
    return asset ? mediaPreviewUrls[asset.id] ?? "" : "";
  }

  return (
    <AuthGate>
      <AppShell>
        <NPage className="analytics-pro-page pb-6">
          <nav className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface/70 px-1.5 py-1.5 shadow-hairline backdrop-blur-sm" aria-label="زیرمنوی گزارش‌ها">
            <Link href="/analytics" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-black bg-white text-app-primary shadow-hairline border border-app-border/80 transition">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              تحلیل عملکرد
            </Link>
            <Link href="/logs" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold text-app-muted hover:bg-white hover:text-app-text hover:shadow-hairline transition">
              <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
              سابقه انتشار
            </Link>
          </nav>

          <NPageHeader
            eyebrow="مرکز تحلیل چندکاناله"
            title="تحلیل عملکرد"
            description="نمای تصمیم‌ساز برای روند انتشار، سلامت کمپین‌ها، آمادگی رسانه‌ای و پست‌هایی که نیاز به اقدام دارند."
            meta={(
              <>
                <Tag tone={attemptSummary.failed ? "alert" : "success"}>{attemptSummary.failed ? `${attemptSummary.failed} تلاش ناموفق` : "ارسال پایدار"}</Tag>
                <Tag tone="primary">{scopedPosts.length} پست مرتبط</Tag>
              </>
            )}
            action={<Button href="/logs" variant="secondary" size="sm">سلامت انتشار</Button>}
            className="analytics-pro-header"
          />

          <section className="analytics-command-strip grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-2 md:grid-cols-3">
              {insightCards.map((insight) => {
                const Icon = insight.icon;
                return (
                  <div key={insight.title} className="analytics-insight-card app-row rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`analytics-insight-icon flex h-9 w-9 items-center justify-center rounded-md ${insight.tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <Tag tone="neutral" className="text-[10px]">{insight.token}</Tag>
                    </div>
                    <p className="mt-3 text-[11px] font-black text-app-muted">{insight.title}</p>
                    <p className={`mt-1 truncate text-base font-black ${insight.tone}`}>{insight.value}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-muted">{insight.detail}</p>
                  </div>
                );
              })}
            </div>
            <div className="analytics-next-signal rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="analytics-live-orb flex h-9 w-9 items-center justify-center rounded-md text-app-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-app-text">سیگنال اجرایی امروز</p>
                  <p className="mt-1 text-[11px] text-app-muted">اولویت بعدی بر اساس داده همین بازه</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-app-border bg-app-surface/82 p-3">
                <p className="text-sm font-black text-app-text">
                  {failedCount ? "ابتدا خطاهای انتشار را پاک کنید" : visualReadinessRate < 60 ? "پوشش تصویری پست‌ها را کامل‌تر کنید" : queuedCount ? "صف زمان‌بندی را برای ارسال بعدی بررسی کنید" : "عملکرد بازه فعلی پایدار است"}
                </p>
                <p className="mt-2 text-xs leading-5 text-app-muted">
                  {failedCount ? `${failedCount} مورد نیازمند توجه در پست‌ها یا تلاش‌ها دیده می‌شود.` : visualReadinessRate < 60 ? "پست‌های دارای تصویر در مقایسه با کل محتوا هنوز کم هستند." : queuedCount ? `${queuedCount} پست آماده یا زمان‌بندی‌شده در جریان است.` : "برای رشد بهتر، کمپین بعدی را با رسانه و زمان پیشنهادی بسازید."}
                </p>
              </div>
            </div>
          </section>

          <NSavedViewToolbar
            views={rangeOptions.map((option) => ({ label: option.label, value: option.value }))}
            activeView={timeRange}
            onViewChange={(value) => setTimeRange(value as TimeRange)}
            filters={(
              <label className="flex min-h-9 min-w-[190px] items-center gap-2 rounded-md border border-app-border bg-white px-3 text-xs font-bold text-app-muted shadow-hairline">
                <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                  <option value="all">همه کمپین‌ها</option>
                  {campaignOptions.map((campaign) => <option key={campaign.value} value={campaign.value}>{campaign.label} · {campaign.count}</option>)}
                </select>
              </label>
            )}
            meta={(
              <>
                <Tag tone="neutral">{scopedAttempts.length} تلاش</Tag>
                {campaignFilter !== "all" ? <Tag tone="primary">فیلتر کمپین</Tag> : null}
                {hasComparison ? <Tag tone="info">مقایسه فعال</Tag> : <Tag tone="neutral">بدون مقایسه</Tag>}
              </>
            )}
          />

          {error ? <NNotice tone="alert" title="نیاز به بررسی">{error}</NNotice> : null}

          <section className="analytics-kpi-grid grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map((metric) => {
              const deltaIsGood = metric.delta === 0 ? null : metric.positiveIsGood === false ? metric.delta < 0 : metric.delta > 0;
              return (
                <div key={metric.label} className="analytics-kpi-wrap">
                  <MetricTile label={metric.label} value={metric.value} icon={metric.icon} href={metric.href} />
                  {hasComparison && metric.delta !== null ? (
                    <p className={`analytics-kpi-delta mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-black ${deltaIsGood === true ? "text-emerald-700" : deltaIsGood === false ? "text-rose-700" : "text-slate-500"}`}>
                      {metric.delta > 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : metric.delta < 0 ? <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      <span className="font-outfit">{metric.delta > 0 ? "+" : ""}{metric.delta}%</span> نسبت به بازه قبل
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>

          <section className="analytics-funnel-grid grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <AnalyticsPanel title="قیف تبدیل اتوماسیون" description="عملکرد اتوماسیون پاسخ‌گویی از کامنت تا کلیک روی لینک.">
              {loading ? <LoadingPanel /> : (
                <div className="flex flex-col gap-4 mt-4">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 w-full relative h-24 bg-app-surface border border-app-border rounded-xl flex flex-col justify-center items-center overflow-hidden">
                      <div className="absolute inset-0 bg-blue-500/10"></div>
                      <p className="text-2xl font-black text-blue-700 font-outfit">{totalAutomationTriggers}</p>
                      <p className="text-xs font-bold text-app-muted mt-1">تطابق کلیدواژه</p>
                    </div>
                    <ArrowLeft className="hidden md:block h-6 w-6 text-app-border shrink-0" />
                    <ArrowDown className="md:hidden h-6 w-6 text-app-border shrink-0" />
                    <div className="flex-1 w-full relative h-24 bg-app-surface border border-app-border rounded-xl flex flex-col justify-center items-center overflow-hidden">
                      <div className="absolute inset-0 bg-indigo-500/10" style={{ right: 0, width: `${totalAutomationTriggers ? (autoRepliesCount / totalAutomationTriggers) * 100 : 0}%` }}></div>
                      <p className="text-2xl font-black text-indigo-700 font-outfit">{autoRepliesCount}</p>
                      <p className="text-xs font-bold text-app-muted mt-1">دایرکت ارسال شده</p>
                    </div>
                    <ArrowLeft className="hidden md:block h-6 w-6 text-app-border shrink-0" />
                    <ArrowDown className="md:hidden h-6 w-6 text-app-border shrink-0" />
                    <div className="flex-1 w-full relative h-24 bg-app-surface border border-app-border rounded-xl flex flex-col justify-center items-center overflow-hidden">
                      <div className="absolute inset-0 bg-emerald-500/10" style={{ right: 0, width: `${autoRepliesCount ? (totalLinkClicks / autoRepliesCount) * 100 : 0}%` }}></div>
                      <p className="text-2xl font-black text-emerald-700 font-outfit">{totalLinkClicks}</p>
                      <p className="text-xs font-bold text-app-muted mt-1">کلیک روی لینک</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-app-muted mt-2 px-4">
                    <span>نرخ تحویل: <span className="font-outfit">{totalAutomationTriggers ? Math.round((autoRepliesCount / totalAutomationTriggers) * 100) : 0}%</span></span>
                    <span>نرخ تبدیل (CTR): <span className="font-outfit">{autoRepliesCount ? Math.round((totalLinkClicks / autoRepliesCount) * 100) : 0}%</span></span>
                  </div>
                </div>
              )}
            </AnalyticsPanel>
            
            <AnalyticsPanel title="لینک‌های پربازدید" description="لینک‌های کوتاه شده با بیشترین کلیک">
              {loading ? <LoadingPanel /> : topLinks.length === 0 ? (
                <EmptyState icon={<LinkIcon className="h-5 w-5" />} title="آماری ثبت نشده" description="هنوز هیچ کلیکی روی لینک‌ها ثبت نشده است." />
              ) : (
                <ul className="space-y-3 mt-4">
                  {topLinks.map((link) => (
                    <li key={link.short_link_id} className="flex justify-between items-center border-b border-app-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1 ml-3">
                        <p className="text-xs font-bold text-app-text truncate text-left" dir="ltr">{link.original_url}</p>
                        <p className="text-[10px] text-app-muted mt-1 flex items-center gap-1 font-outfit">
                          <LinkIcon className="h-3 w-3" />
                          /r/{link.short_code}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-sm font-black text-emerald-700 font-outfit">{link.total_clicks}</p>
                        <p className="text-[9px] text-app-muted">کلیک</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AnalyticsPanel>
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-3">
              <AnalyticsPanel
                title="روند تلاش‌های انتشار"
                description="مقایسه تلاش‌های موفق، ناموفق و در حال اجرا در بازه انتخاب‌شده."
                action={(
                  <div className="flex items-center gap-2">
                    {selectedTrend ? (
                      <button
                        type="button"
                        onClick={() => setSelectedTrendKey("")}
                        className="app-interactive inline-flex items-center gap-1 text-xs font-bold text-app-primary hover:text-app-primaryHover"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        لغو انتخاب
                      </button>
                    ) : null}
                    <StatusToken tone="neutral"><span className="font-outfit">{trend.length}</span> نقطه زمانی</StatusToken>
                  </div>
                )}
              >
                {loading ? <LoadingPanel /> : null}
                {!loading && trend.length === 0 ? (
                  <EmptyState
                    icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
                    title="هنوز روندی برای نمایش وجود ندارد"
                    description="پس از ثبت تلاش‌های انتشار، نمودار عملیاتی اینجا کامل می‌شود."
                  />
                ) : null}
                <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-bold text-app-muted">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> موفق</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> ناموفق</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> در حال اجرا</span>
                </div>
                <div className="analytics-trend-stage pb-2">
                  <div
                    className="grid h-48 min-w-0 items-end gap-1.5 border-b border-app-border px-2 pt-3 sm:gap-2 sm:px-4"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, trend.length)}, minmax(0, 1fr))` }}
                  >
                    {trend.map((item, index) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedTrendKey((current) => current === item.key ? "" : item.key)}
                        data-trend-inspector
                        data-trend-bar
                        className={`analytics-trend-bucket relative flex h-full min-w-0 flex-col justify-end overflow-visible rounded-t pb-6 text-center transition ${selectedTrend?.key === item.key ? "analytics-trend-bucket-active ring-1 ring-inset ring-blue-100" : ""}`}
                        title={`${item.label}: ${item.total} تلاش`}
                      >
                        <p className="mb-2 text-[10px] font-black text-app-muted font-outfit">{item.total || ""}</p>
                        <div className="flex h-40 items-end justify-center">
                          <div
                            className={`flex w-5 flex-col-reverse overflow-hidden rounded-t bg-slate-100 transition ${selectedTrend?.key === item.key ? "ring-2 ring-app-primary ring-offset-2" : ""}`}
                            style={{ height: item.total ? `${Math.max(8, percent(item.total, maxTrendTotal))}%` : "0%" }}
                            title={`${item.label}: ${item.total} تلاش`}
                          >
                            <span className="bg-emerald-500" style={{ height: `${percent(item.success, Math.max(1, item.total))}%` }} />
                            <span className="bg-rose-500" style={{ height: `${percent(item.failed, Math.max(1, item.total))}%` }} />
                            <span className="bg-sky-500" style={{ height: `${percent(item.started, Math.max(1, item.total))}%` }} />
                          </div>
                        </div>
                        <p className={`absolute bottom-0 left-1/2 min-h-4 max-w-[5.5rem] -translate-x-1/2 truncate whitespace-nowrap text-center text-[10px] font-bold ${showTrendTick(index) ? "text-app-muted" : "text-transparent"}`}>
                          {showTrendTick(index) ? item.label : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel
                title="ترکیب عملیات محتوا"
                description="وضعیت چرخه پست‌ها و نوع ارسال در یک نمای فشرده."
              >
                <div className="grid gap-3 border-b border-app-border pb-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-app-surfaceMuted p-3 shadow-hairline">
                    <span className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-app-primary" aria-hidden="true" />
                      <span className="text-sm font-black text-app-text">ارسال متنی</span>
                    </span>
                    <span className="text-sm font-black text-app-text font-outfit">{attemptSummary.text} <span className="text-xs text-app-muted">({percent(attemptSummary.text, scopedAttempts.length)}%)</span></span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md bg-app-surfaceMuted p-3 shadow-hairline">
                    <span className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-app-primary" aria-hidden="true" />
                      <span className="text-sm font-black text-app-text">ارسال رسانه‌ای</span>
                    </span>
                    <span className="text-sm font-black text-app-text font-outfit">{attemptSummary.media} <span className="text-xs text-app-muted">({percent(attemptSummary.media, scopedAttempts.length)}%)</span></span>
                  </div>
                </div>
                <div className="mt-2 divide-y divide-app-border">
                  {Object.entries(statusLabels).map(([status, label]) => {
                    const count = statusCounts[status] ?? 0;
                    const ratio = percent(count, Math.max(1, scopedPosts.length));
                    return (
                      <div key={status} className="grid gap-2 py-3 md:grid-cols-[150px_minmax(0,1fr)_36px] md:items-center">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} />
                          <span className="text-xs font-black text-app-text">{label}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${statusProgressClasses[status] ?? "bg-app-primary"}`} style={{ width: `${ratio}%` }} />
                        </div>
                        <span className="text-left text-xs font-black text-app-text font-outfit">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel
                title="جزئیات عملکرد پست‌ها"
                description="پست‌های بازه را جست‌وجو، مرتب و برای بررسی عملیاتی باز کنید."
                action={<StatusToken tone="neutral"><span className="font-outfit">{drilldownPosts.length}</span> نتیجه</StatusToken>}
                bodyClassName="p-3"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px]">
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 ring-app-primary focus-within:ring-2">
                    <Search className="h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
                    <input
                      value={postSearch}
                      onChange={(event) => setPostSearch(event.target.value)}
                      placeholder="جست‌وجوی عنوان، کمپین یا وضعیت"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={postSort} onChange={(event) => setPostSort(event.target.value as PostSort)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      <option value="activity">آخرین فعالیت</option>
                      <option value="attempts">بیشترین تلاش</option>
                      <option value="title">عنوان پست</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {postFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPostFilter(option.value)}
                        className={`app-interactive nashrino-control-radius inline-flex min-h-8 items-center px-3 text-xs font-bold transition ${postFilter === option.value ? "bg-app-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-app-primary"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <DataTable
                  columns={["پست", "وضعیت", "تلاش", "آخرین فعالیت", "اقدام"]}
                  gridClassName="lg:grid-cols-[minmax(0,1fr)_120px_80px_150px_100px]"
                  empty={drilldownPosts.length === 0 ? <EmptyState title="پستی با این فیلتر پیدا نشد" description="عبارت جست‌وجو یا فیلتر وضعیت را تغییر دهید." /> : null}
                >
                  {drilldownPosts.map((post) => (
                    <DataRow key={post.id} gridClassName="lg:grid-cols-[minmax(0,1fr)_120px_80px_150px_100px]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 ring-1 ring-app-border">
                          {previewUrlForPost(post) ? (
                            <img src={previewUrlForPost(post)} alt={primaryMediaForPost(post)?.original_filename ?? post.title} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-app-text">{post.title}</p>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-app-muted">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: campaignColorForPost(post, campaigns) }} />
                            {campaignLabelForPost(post, campaigns)}
                          </p>
                        </div>
                      </div>
                      <div><StatusBadge status={post.status} /></div>
                      <div>
                        <p className="text-xs font-black text-app-text font-outfit">{post.attempt_count}</p>
                        <p className="mt-1 text-[11px] text-app-muted">بار ارسال</p>
                      </div>
                      <p className="text-xs leading-5 text-app-muted font-outfit">{formatDateTime(postActivityDate(post))}</p>
                      <Button href={`/compose?postId=${post.id}`} variant="secondary" size="sm" className="w-full">
                        <ArrowUpLeft className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        باز کردن
                      </Button>
                    </DataRow>
                  ))}
                </DataTable>
              </AnalyticsPanel>
            </div>

            <aside className="grid gap-3 lg:grid-cols-2 xl:block xl:space-y-3 xl:self-start">
              <AnalyticsPanel title="هویت گزارش" description="برندی که این تحلیل با آن آماده می‌شود." bodyClassName="p-4">
                <div className="flex items-center gap-3">
                  <WorkspaceAvatar name={store?.name || "فضای کاری اجتماعی"} size="lg" color={brandColor} imageUrl={brandAvatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-app-text">{store?.name || "پروفایل فروشگاه"}</p>
                    <p className="mt-1 truncate text-xs text-app-muted">{store?.brand_voice || "لحن برند ثبت نشده"}</p>
                  </div>
                </div>
                {brandLogoUrl ? (
                  <div className="mt-4 rounded-md border border-app-border bg-app-surfaceMuted p-3">
                    <p className="mb-2 text-[11px] font-black text-app-muted">لوگوی گزارش</p>
                    <img src={brandLogoUrl} alt="لوگوی برند" className="max-h-20 max-w-full rounded object-contain" />
                  </div>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-app-surfaceMuted p-2">
                    <p className="text-[10px] font-black text-app-muted">رنگ اصلی</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-5 w-5 rounded shadow-hairline" style={{ backgroundColor: brandColor }} />
                      <span className="text-xs font-black text-app-text font-outfit" dir="ltr">{brandColor}</span>
                    </div>
                  </div>
                  <div className="rounded-md bg-app-surfaceMuted p-2">
                    <p className="text-[10px] font-black text-app-muted">رنگ مکمل</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="h-5 w-5 rounded shadow-hairline" style={{ backgroundColor: brandAccentColor }} />
                      <span className="text-xs font-black text-app-text font-outfit" dir="ltr">{brandAccentColor}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-app-muted">{store?.default_cta || "CTA پیش‌فرض برای گزارش‌های بعدی هنوز ثبت نشده است."}</p>
              </AnalyticsPanel>

              {selectedTrend ? (
                <AnalyticsPanel
                  title="بازرس روز انتخاب‌شده"
                  description={selectedTrend.label}
                  action={(
                    <button
                      type="button"
                      onClick={() => setSelectedTrendKey("")}
                      className="app-interactive nashrino-control-radius flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-app-text"
                      aria-label="بستن جزئیات روز"
                      title="بستن جزئیات روز"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  bodyClassName="p-4"
                >
                  <div data-trend-inspector>
                    <div className="grid grid-cols-4 divide-x divide-x-reverse divide-app-border overflow-hidden rounded-md bg-app-surfaceMuted text-center shadow-hairline">
                      <div className="p-2"><p className="text-sm font-black text-app-text font-outfit">{selectedTrend.total}</p><p className="mt-1 text-[10px] text-app-muted">کل تلاش</p></div>
                      <div className="p-2"><p className="text-sm font-black text-emerald-700 font-outfit">{selectedTrend.success}</p><p className="mt-1 text-[10px] text-app-muted">موفق</p></div>
                      <div className="p-2"><p className="text-sm font-black text-rose-700 font-outfit">{selectedTrend.failed}</p><p className="mt-1 text-[10px] text-app-muted">ناموفق</p></div>
                      <div className="p-2"><p className="text-sm font-black text-sky-700 font-outfit">{selectedTrend.started}</p><p className="mt-1 text-[10px] text-app-muted">در اجرا</p></div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-app-primary" aria-hidden="true" />
                      <p className="text-xs font-black text-app-text">فعالیت‌های ثبت‌شده</p>
                    </div>
                    {selectedTrendAttempts.length ? (
                      <div className="mt-3 divide-y divide-app-border">
                        {selectedTrendAttempts.map((attempt) => (
                          <article key={attempt.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-xs font-black text-app-text">{attempt.post_title}</p>
                              <StatusToken tone={attempt.status === "success" ? "success" : attempt.status === "failed" ? "alert" : "info"}>
                                {attempt.status === "success" ? "موفق" : attempt.status === "failed" ? "ناموفق" : "در اجرا"}
                              </StatusToken>
                            </div>
                            <p className="mt-1 text-[11px] text-app-muted font-outfit">{formatDateTime(attempt.created_at)}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-app-muted">برای این روز تلاش انتشاری ثبت نشده است.</p>
                    )}
                  </div>
                </AnalyticsPanel>
              ) : null}
              <AnalyticsPanel
                title="پست‌های پیشرو"
                description="محتواهایی که از نظر وضعیت، رسانه و تلاش ارسال آماده‌تر هستند."
                action={<StatusToken tone="primary"><span className="font-outfit">{topOperationalPosts.length}</span> مورد</StatusToken>}
                bodyClassName="p-3"
              >
                {topOperationalPosts.length === 0 ? (
                  <EmptyState
                    icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
                    title="هنوز پست قابل رتبه‌بندی وجود ندارد"
                    description="پس از ساخت یا انتشار پست، رتبه‌بندی عملکرد اینجا نمایش داده می‌شود."
                  />
                ) : null}
                <div className="space-y-2">
                  {topOperationalPosts.map(({ post, media, score }) => {
                    const previewUrl = previewUrlForPost(post);
                    return (
                      <article key={post.id} className="app-row overflow-hidden rounded-md border border-app-border bg-white shadow-hairline">
                        <div className="flex gap-3 p-2.5">
                          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 ring-1 ring-app-border">
                            {previewUrl ? (
                              <img src={previewUrl} alt={media[0]?.original_filename ?? post.title} className="h-full w-full object-cover" />
                            ) : (
                              <FileImage className="h-5 w-5 text-slate-400" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-xs font-black leading-5 text-app-text">{post.title}</p>
                              <StatusToken tone={score >= 75 ? "success" : score >= 50 ? "warning" : "alert"}><span className="font-outfit">{score}</span></StatusToken>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <StatusBadge status={post.status} />
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-app-muted">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: campaignColorForPost(post, campaigns) }} />
                                {campaignLabelForPost(post, campaigns)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel
                title="اقدام‌های پیشنهادی"
                description="مواردی که بهتر است اول بررسی شوند."
                action={<StatusToken tone={failedPosts.length ? "alert" : "success"}><span className="font-outfit">{failedPosts.length}</span> رسیدگی</StatusToken>}
              >
                {failedPosts.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                    title="فعلاً مورد بحرانی وجود ندارد"
                    description="خطاهای انتشار یا پست‌های شکست‌خورده در این بازه دیده نمی‌شود."
                  />
                ) : null}
                <div className="space-y-2">
                  {failedPosts.map((post) => (
                    <article key={post.id} className="rounded-md border border-app-border bg-white p-3 shadow-hairline">
                      <div className="flex gap-3">
                        <div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-rose-50 ring-1 ring-rose-100">
                          {previewUrlForPost(post) ? (
                            <img src={previewUrlForPost(post)} alt={primaryMediaForPost(post)?.original_filename ?? post.title} className="h-full w-full object-cover" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={post.status} />
                            <span className="text-xs text-app-muted">تلاش: <span className="font-outfit">{post.attempt_count}</span></span>
                          </div>
                          <h3 className="mt-2 truncate text-sm font-black text-app-text">{post.title}</h3>
                        </div>
                      </div>
                      {post.last_error ? <p className="mt-1 line-clamp-2 text-xs leading-6 text-rose-600">{post.last_error}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <Button href={`/compose?postId=${post.id}`} variant="secondary" size="sm">باز کردن</Button>
                        <Button href="/logs" variant="secondary" size="sm">لاگ‌ها</Button>
                      </div>
                    </article>
                  ))}
                </div>
              </AnalyticsPanel>

              <AnalyticsPanel title="خلاصه عملیاتی" description="سیگنال‌های قابل اتکا برای تصمیم بعدی.">
                <DetailGrid
                  items={[
                    { label: "تلاش کامل‌شده", value: <span className="font-outfit">{attemptSummary.completed}</span>, hint: "موفق + ناموفق" },
                    { label: "در حال اجرا", value: <span className="font-outfit">{attemptSummary.started}</span>, hint: "تلاش شروع‌شده" },
                    { label: "پست در جریان", value: <span className="font-outfit">{queuedCount}</span>, hint: "آماده یا زمان‌بندی‌شده" },
                    { label: "کل تلاش‌ها", value: <span className="font-outfit">{scopedAttempts.length}</span>, hint: "ثبت‌شده در بازه" }
                  ]}
                />
                {campaignPerformance.length ? (
                  <div className="mt-4 rounded-md border border-app-border bg-app-surfaceMuted p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-app-primary" aria-hidden="true" />
                      <p className="text-xs font-black text-app-text">رتبه‌بندی کمپین‌ها</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {campaignPerformance.map((campaign) => (
                        <div key={campaign.campaignKey} className="rounded bg-white p-2 shadow-hairline">
                          <div className="flex items-center justify-between gap-3">
                            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-black text-app-text">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: campaign.color }} />
                              {campaign.label}
                            </p>
                            <span className="text-[11px] font-black text-app-primary"><span className="font-outfit">{campaign.total}</span> پست</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-app-primary" style={{ width: `${percent(campaign.published + campaign.queued, Math.max(1, campaign.total))}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-app-muted"><span className="font-outfit">{campaign.published}</span> منتشرشده · <span className="font-outfit">{campaign.queued}</span> در جریان · <span className="font-outfit">{campaign.media}</span> دارای رسانه</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 divide-y divide-app-border border-t border-app-border">
                  <div className="py-3">
                    <p className="text-[11px] font-black text-app-muted">آخرین تلاش ثبت‌شده</p>
                    <p className="mt-1 text-sm font-black text-app-text font-outfit">{lastAttempt ? formatDateTime(lastAttempt.created_at) : "—"}</p>
                  </div>
                  <div className="py-3">
                    <p className="text-[11px] font-black text-app-muted">نزدیک‌ترین پست در جریان</p>
                    {queuedPosts[0] ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={queuedPosts[0].status} />
                          <span className="text-xs text-app-muted font-outfit">{formatDateTime(queuedPosts[0].scheduled_at)}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-black text-app-text">{queuedPosts[0].title}</p>
                      </>
                    ) : <p className="mt-1 text-sm text-app-muted font-outfit">پست فعالی در صف نیست.</p>}
                  </div>
                  <div className="py-3">
                    <p className="text-[11px] font-black text-app-muted">بیشترین تلاش انتشار</p>
                    {highAttemptPosts[0] ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-black text-app-text">{highAttemptPosts[0].title}</p>
                        <StatusToken tone={highAttemptPosts[0].attempt_count > 1 ? "warning" : "neutral"}><span className="font-outfit">{highAttemptPosts[0].attempt_count}</span> تلاش</StatusToken>
                      </div>
                    ) : <p className="mt-1 text-sm text-app-muted font-outfit">داده‌ای برای رتبه‌بندی وجود ندارد.</p>}
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <Button href="/queue" variant="secondary">باز کردن صف انتشار</Button>
                  <Button href="/content" variant="secondary">میز محتوا</Button>
                </div>
              </AnalyticsPanel>
            </aside>
          </section>
        </NPage>
      </AppShell>
    </AuthGate>
  );
}

