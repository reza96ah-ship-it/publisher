"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Megaphone,
  MessageSquare,
  PlugZap,
  RefreshCw,
  Target
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toPersianDigits } from "../lib/utils";
import { AppShell } from "../components/app-shell";
import { AuthGate } from "../components/auth-gate";
import { WorkspaceAvatar } from "../components/brand-mark";
import { Skeleton } from "../components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { MetricTile } from "@/components/ui/metric-tile";
import { Tag } from "@/components/ui/tag";
import {
  NEmptyState,
  NNotice,
  NPage,
  NRow,
  NSection,
  NTabs
} from "../components/nashrino-ui";
import { Campaign, loadCampaigns } from "../lib/campaigns";
import { useMediaPreviewUrl } from "../lib/media-preview";
import {
  emptyOperationalNotifications,
  loadOperationalNotifications,
  loadReadNotificationIds,
  OperationalNotifications
} from "../lib/notifications";
import { apiUrl, authHeaders, Post } from "../lib/posts";
import { productName } from "../lib/product";
import { isRubikaConnected, isStoreConfigured, loadWorkspaceOverview, RubikaSettings, StoreProfile } from "../lib/workspace";

function statusCount(posts: Post[], status: string) {
  return posts.filter((post) => post.status === status).length;
}

function dateTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateFromPost(post: Post) {
  const value = post.published_at || post.scheduled_at || post.created_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function conicGradient(items: Array<{ color: string; value: number }>, total: number) {
  if (!total) return "conic-gradient(rgb(var(--n-chart-empty)) 0deg 360deg)";
  let cursor = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      const size = (item.value / total) * 360;
      cursor += size;
      return `${item.color} ${start}deg ${cursor}deg`;
    });
  return `conic-gradient(${segments.length ? segments.join(", ") : "rgb(var(--n-chart-empty)) 0deg 360deg"})`;
}

function deliveryScore(post: Post) {
  if (post.status === "published") return 100;
  if (post.status === "scheduled") return 82;
  if (post.status === "ready" || post.status === "manual_ready") return 72;
  if (post.status === "publishing") return 64;
  if (post.status === "draft") return 38;
  if (post.status === "failed") return 18;
  return 42;
}

function statusTone(status: string) {
  if (status === "failed") return "alert" as const;
  if (status === "published") return "success" as const;
  if (status === "scheduled" || status === "publishing") return "warning" as const;
  return "primary" as const;
}

function approvalTone(status?: string | null) {
  if (status === "approved") return "success" as const;
  if (status === "pending" || status === "changes_requested") return "warning" as const;
  if (status === "rejected") return "alert" as const;
  return "neutral" as const;
}

function compactDateTime(value?: string | null) {
  if (!value) return "بدون زمان";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "بدون زمان";
  return toPersianDigits(new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(date));
}

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [rubika, setRubika] = useState<RubikaSettings | null>(null);
  const [notifications, setNotifications] = useState<OperationalNotifications>(emptyOperationalNotifications);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dashboardView, setDashboardView] = useState("overview");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [response, overview, notificationData] = await Promise.all([
        fetch(`${apiUrl}/posts`, { headers: authHeaders() }),
        loadWorkspaceOverview(),
        loadOperationalNotifications()
      ]);
      if (!response.ok) throw new Error("دریافت داشبورد ناموفق بود");
      const postData: Post[] = await response.json();
      const campaignData = await loadCampaigns("all").catch(() => []);
      setPosts(postData);
      setCampaigns(campaignData);
      setStore(overview.store);
      setRubika(overview.rubika);
      setNotifications(notificationData);
      setReadIds(loadReadNotificationIds());
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت داشبورد");
      setLoading(false);
    });
  }, [loadDashboard]);

  const scheduledPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "scheduled" && post.scheduled_at)
      .sort((first, second) => dateTime(first.scheduled_at) - dateTime(second.scheduled_at));
  }, [posts]);

  const queueCounts = {
    ready: statusCount(posts, "ready"),
    scheduled: statusCount(posts, "scheduled"),
    publishing: statusCount(posts, "publishing"),
    failed: statusCount(posts, "failed")
  };
  const draftCount = statusCount(posts, "draft");
  const publishedCount = statusCount(posts, "published");
  const queueTotal = queueCounts.ready + queueCounts.scheduled + queueCounts.publishing + queueCounts.failed;
  const storeReady = isStoreConfigured(store);
  const rubikaReady = isRubikaConnected(rubika);
  const workspaceReady = storeReady && rubikaReady;
  const brandColor = store?.brand_primary_color;
  const brandImageUrl = useMediaPreviewUrl(store?.avatar_asset_id ?? store?.logo_asset_id);
  const priorityAlerts = notifications.notifications.filter((item) => item.action_required).slice(0, 4);
  const unreadAlerts = notifications.notifications.filter((item) => item.action_required && !readIds.has(item.id)).length;
  const nextPosts = scheduledPosts.slice(0, 3);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").slice(0, 4);
  const pendingApprovalCount = posts.filter((post) => ["pending", "changes_requested", "rejected"].includes(post.approval_status || "")).length;
  const blockedWorkCount = priorityAlerts.length + queueCounts.failed + pendingApprovalCount + Number(!storeReady) + Number(!rubikaReady);
  const completionRate = percent(publishedCount, Math.max(posts.length - draftCount, 0));
  const failureRate = percent(queueCounts.failed, Math.max(queueTotal, 0));
  const activeQueueCount = queueCounts.ready + queueCounts.scheduled + queueCounts.publishing;
  const operationsHealth = Math.max(0, Math.min(100, 100 - failureRate - Math.min(42, blockedWorkCount * 7)));
  const todayKey = dayKey(new Date());
  const scheduledTodayCount = scheduledPosts.filter((post) => {
    const date = post.scheduled_at ? new Date(post.scheduled_at) : null;
    return date && !Number.isNaN(date.getTime()) ? dayKey(date) === todayKey : false;
  }).length;

  const nextAction = priorityAlerts[0]
    ? { label: priorityAlerts[0].action_label, href: priorityAlerts[0].action_href, detail: priorityAlerts[0].title }
    : queueCounts.failed
      ? { label: "بازیابی صف انتشار", href: "/queue", detail: `${toPersianDigits(queueCounts.failed)} انتشار ناموفق منتظر بررسی است` }
      : pendingApprovalCount
        ? { label: "بازبینی محتوا", href: "/content?approval=pending", detail: `${toPersianDigits(pendingApprovalCount)} محتوا پشت گیت تایید مانده است` }
        : !workspaceReady
          ? { label: "تکمیل راه‌اندازی", href: "/onboarding", detail: "آماده‌سازی فقط تا زمان تکمیل مسیر نمایش داده می‌شود" }
          : nextPosts[0]
            ? { label: "بررسی انتشار بعدی", href: `/compose?postId=${nextPosts[0].id}`, detail: nextPosts[0].title }
            : draftCount
              ? { label: "تکمیل پیش‌نویس‌ها", href: "/content?status=draft", detail: `${toPersianDigits(draftCount)} پیش‌نویس آماده تکمیل است` }
              : { label: "ساخت پست تازه", href: "/compose", detail: "برنامه نزدیک هنوز محتوای کافی ندارد" };

  const briefing = priorityAlerts.length
    ? `${toPersianDigits(priorityAlerts.length)} هشدار عملیاتی قبل از ادامه برنامه انتشار نیازمند رسیدگی است.`
    : queueCounts.failed
      ? "صف انتشار خطای فعال دارد؛ اول بازیابی، بعد تولید محتوای جدید."
      : nextPosts.length
        ? "برنامه نزدیک روشن است. وضعیت کانال، کمپین و صف را از همین نما کنترل کنید."
        : activeCampaigns.length
          ? "کمپین‌ها فعال‌اند اما تقویم نزدیک سبک است. محتوا را وارد برنامه کنید."
          : "فضای کاری آماده تصمیم است. یک محتوا یا کمپین تازه می‌تواند برنامه امروز را فعال کند.";

  const healthTone = priorityAlerts.length || queueCounts.failed || pendingApprovalCount ? "alert" : workspaceReady ? "success" : "warning";
  const weekKeys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return dayKey(date);
  });
  const weeklyActivity = weekKeys.map((key) => posts.filter((post) => {
    const date = dateFromPost(post);
    return date ? dayKey(date) === key : false;
  }).length);
  const weeklyLabels = weekKeys.map((key) => new Date(`${key}T00:00:00`).toLocaleDateString("fa-IR", { weekday: "short" }));
  const maxWeeklyActivity = Math.max(1, ...weeklyActivity);
  const statusMixItems = [
    { label: "منتشر", value: publishedCount, color: "rgb(var(--n-chart-published))" },
    { label: "در صف", value: activeQueueCount, color: "rgb(var(--n-chart-scheduled))" },
    { label: "پیش‌نویس", value: draftCount, color: "rgb(var(--n-chart-draft))" },
    { label: "خطا", value: queueCounts.failed, color: "rgb(var(--n-chart-failed))" }
  ];
  const statusMixTotal = statusMixItems.reduce((sum, item) => sum + item.value, 0);
  const statusMixBackground = conicGradient(statusMixItems, statusMixTotal);
  
  const topMetrics = [
    {
      label: "زمان‌بندی امروز",
      value: scheduledTodayCount,
      detail: nextPosts[0]?.scheduled_at ? `بعدی ${compactDateTime(nextPosts[0].scheduled_at)}` : "امروز چیزی در برنامه نیست",
      icon: CalendarClock,
      tone: "warning" as const,
      href: "/calendar"
    },
    {
      label: "در معرض ریسک",
      value: blockedWorkCount,
      detail: "خطا، تایید، اتصال یا راه‌اندازی",
      icon: AlertTriangle,
      tone: blockedWorkCount ? "alert" as const : "success" as const,
      href: blockedWorkCount ? "/queue" : "/inbox"
    },
    {
      label: "پیام‌های موعددار",
      value: unreadAlerts,
      detail: unreadAlerts ? "اعلان تازه نیازمند اقدام" : "تعهد پاسخ آرام است",
      icon: MessageSquare,
      tone: unreadAlerts ? "warning" as const : "success" as const,
      href: "/inbox"
    },
    {
      label: "کمپین فعال",
      value: activeCampaigns.length,
      detail: "کمپین های در جریان",
      icon: Megaphone,
      tone: "primary" as const,
      href: "/campaigns?status=active"
    }
  ];
  const statusLabels: Record<string, string> = {
    draft: "پیش‌نویس",
    ready: "آماده",
    scheduled: "زمان‌بندی",
    publishing: "در انتشار",
    published: "منتشر",
    manual_ready: "دستی",
    failed: "ناموفق"
  };
  const approvalLabels: Record<string, string> = {
    not_required: "بدون الزام",
    pending: "در انتظار",
    approved: "تایید شده",
    rejected: "رد شده",
    changes_requested: "نیازمند اصلاح"
  };
  const contentPreviewItems = [...posts]
    .sort((first, second) => dateTime(second.updated_at || second.created_at) - dateTime(first.updated_at || first.created_at))
    .slice(0, 3)
    .map((post) => ({
      id: post.id,
      title: post.title || "محتوای بدون عنوان",
      caption: post.caption || post.internal_note || "متن کوتاه این محتوا هنوز تکمیل نشده است.",
      href: `/compose?postId=${post.id}`,
      channel: post.platform?.trim() || "چندکاناله",
      status: statusLabels[post.status] || post.status || "نامشخص",
      time: compactDateTime(post.scheduled_at || post.published_at || post.updated_at || post.created_at),
      tone: post.status === "failed" ? "alert" as const : post.status === "published" ? "success" as const : post.status === "scheduled" ? "warning" as const : "primary" as const
    }));
  const riskQueueItems = [
    ...(queueCounts.failed
      ? [{ id: "failed", icon: AlertTriangle, title: "انتشار ناموفق", detail: `${toPersianDigits(queueCounts.failed)} آیتم نیازمند بازیابی`, tone: "alert" as const, href: "/queue" }]
      : []),
    ...(pendingApprovalCount
      ? [{ id: "approval", icon: MessageSquare, title: "بازبینی مسدود", detail: `${toPersianDigits(pendingApprovalCount)} محتوا پشت تایید`, tone: "warning" as const, href: "/content?approval=pending" }]
      : []),
    ...(!rubikaReady
      ? [{ id: "rubika", icon: PlugZap, title: "اتصال کانال", detail: "روبیکا هنوز آماده انتشار نیست", tone: "warning" as const, href: "/channels" }]
      : []),
    ...(!storeReady
      ? [{ id: "store", icon: Target, title: "هویت کاری", detail: "مشخصات فضای کاری ناقص است", tone: "warning" as const, href: "/store" }]
      : []),
    ...priorityAlerts.slice(0, 2).map((alert) => ({
      id: alert.id,
      icon: alert.severity === "critical" ? CircleAlert : AlertTriangle,
      title: alert.title,
      detail: alert.description,
      tone: alert.severity === "critical" ? "alert" as const : "warning" as const,
      href: alert.action_href
    }))
  ];
  const plannerSnapshot = weekKeys.map((key, index) => {
    const postsForDay = scheduledPosts.filter((post) => {
      const date = post.scheduled_at ? new Date(post.scheduled_at) : null;
      return date && !Number.isNaN(date.getTime()) ? dayKey(date) === key : false;
    });
    return {
      key,
      label: weeklyLabels[index],
      count: postsForDay.length,
      campaign: postsForDay.find((post) => post.campaign)?.campaign || activeCampaigns[0]?.name || "",
      href: `/calendar?date=${key}`
    };
  });
  const publishMode = rubikaReady ? "API آماده" : "دستی/نیازمند اتصال";
  const publishState = queueCounts.publishing ? "در حال انتشار" : nextPosts[0] ? "زمان‌بندی شده" : queueCounts.ready ? "آماده صف" : "بدون برنامه نزدیک";
  const publishPulseSteps = [
    { label: "محتوا", detail: contentPreviewItems.length ? `${toPersianDigits(contentPreviewItems.length)} آیتم نزدیک آماده بررسی است` : "هنوز محتوای نزدیک ندارید", ready: Boolean(contentPreviewItems.length), status: contentPreviewItems.length ? "آماده" : "بسازید", action: contentPreviewItems.length ? "بازبینی" : "ساخت پست", href: contentPreviewItems.length ? "/content" : "/compose" },
    { label: "صف انتشار", detail: queueCounts.failed ? `${toPersianDigits(queueCounts.failed)} job ناموفق باید بازیابی شود` : queueTotal ? `${toPersianDigits(queueTotal)} job در چرخه انتشار است` : "صف هنوز خالی است", ready: queueTotal > 0 && !queueCounts.failed, status: queueCounts.failed ? "ریسک" : queueTotal ? "سالم" : "خالی", action: queueCounts.failed ? "بازیابی" : "دیدن صف", href: "/queue" },
    { label: "کانال", detail: rubikaReady ? "اتصال انتشار آماده است" : "اتصال کانال نیازمند بررسی است", ready: rubikaReady, status: rubikaReady ? "متصل" : "بررسی", action: rubikaReady ? "مدیریت" : "اتصال", href: "/channels" },
    { label: "زمان انتشار", detail: nextPosts[0] ? compactDateTime(nextPosts[0].scheduled_at) : "برای انتشار خودکار زمان انتخاب نشده", ready: Boolean(nextPosts[0]), status: nextPosts[0] ? "زمان‌دار" : "بدون زمان", action: nextPosts[0] ? "تقویم" : "زمان‌بندی", href: nextPosts[0]?.scheduled_at ? `/calendar?date=${dayKey(new Date(nextPosts[0].scheduled_at))}` : "/compose" }
  ];
  const insightTone = failureRate ? "warning" as const : completionRate >= 60 ? "success" as const : "info" as const;
  const reportInsight = failureRate
    ? { title: "ریسک انتشار بالاست", detail: `${toPersianDigits(failureRate)}٪ از صف فعال خطا دارد؛ بازیابی صف قبل از تولید تازه ارزشمندتر است.`, href: "/analytics?view=failures", tone: insightTone }
    : { title: "ریتم انتشار قابل اتکاست", detail: `${toPersianDigits(completionRate)}٪ تکمیل در داده فعلی؛ برنامه نزدیک را با یک پست زمان‌بندی‌شده تقویت کنید.`, href: "/analytics", tone: insightTone };
  const campaignMomentumItems = activeCampaigns.length ? activeCampaigns : campaigns.slice(0, 3);
  const dashboardRecentItems = [...posts]
    .sort((first, second) => dateTime(second.updated_at || second.created_at) - dateTime(first.updated_at || first.created_at))
    .slice(0, 4)
    .map((post) => ({
      id: post.id,
      title: post.title || "محتوای بدون عنوان",
      channel: post.platform?.trim() || "چندکاناله",
      status: statusLabels[post.status] || post.status || "نامشخص",
      statusTone: statusTone(post.status),
      publishTime: compactDateTime(post.scheduled_at || post.published_at),
      approval: approvalLabels[post.approval_status || "not_required"] || post.approval_status || "بدون الزام",
      approvalTone: approvalTone(post.approval_status),
      score: deliveryScore(post),
      href: `/compose?postId=${post.id}`
    }));
  const dashboardFocusTabs = [
    { label: "نمای امروز", value: "overview", count: blockedWorkCount },
    { label: "برنامه", value: "planner", count: nextPosts.length },
    { label: "ریسک", value: "risk", count: riskQueueItems.length },
    { label: "کمپین", value: "campaigns", count: campaignMomentumItems.length }
  ];
  const publishPulsePanel: ReactNode = (
    <NSection title="نبض انتشار" description="انتشار بعدی، وضعیت job و مسیر کانال در یک نمای عملیاتی." action={<Button href="/calendar" variant="secondary" size="sm">تقویم</Button>} className="dashboard-spec-card dashboard-publish-pulse">
      <div className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-app-muted">انتشار بعدی</p>
            <p className="dashboard-kpi-number mt-1 truncate text-2xl font-black text-app-text font-outfit">{compactDateTime(nextPosts[0]?.scheduled_at)}</p>
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-app-muted">{nextPosts[0]?.title || "برای فعال شدن نبض، یک پست زمان‌بندی کنید."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag tone={nextPosts[0] ? "warning" : "neutral"}>{publishState}</Tag>
            <Tag tone={rubikaReady ? "success" : "warning"}>{publishMode}</Tag>
          </div>
        </div>
        <div className="dashboard-publish-flow" aria-label="مسیر آمادگی انتشار">
          {publishPulseSteps.map((step, index) => (
            <Link key={step.label} href={step.href} className={`dashboard-publish-step app-interactive ${step.ready ? "dashboard-publish-step-ready" : "dashboard-publish-step-waiting"}`}>
              <span className="dashboard-publish-step-index" aria-hidden="true">
                {step.ready ? <CheckCircle2 className="dashboard-publish-step-icon" /> : toPersianDigits(index + 1)}
              </span>
              <span className="dashboard-publish-step-copy min-w-0">
                <span className="dashboard-publish-step-top">
                  <span className="dashboard-publish-step-label truncate font-black text-app-text">{step.label}</span>
                  <span className="dashboard-publish-step-status">{step.status}</span>
                </span>
                <span className="dashboard-publish-step-detail mt-1 block font-bold text-app-muted">{step.detail}</span>
              </span>
              <span className="dashboard-publish-step-action">
                {step.action}
                <ArrowUpLeft className="dashboard-publish-step-action-icon" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </NSection>
  );
  const plannerPanel: ReactNode = (
    <NSection title="نمای برنامه" description="هفت روز آینده با تراکم محتوا و اشاره کمپین." action={<Button href="/calendar" variant="secondary" size="sm">تقویم کامل</Button>} className="dashboard-spec-card dashboard-planner-snapshot">
      <div className="grid grid-cols-7 gap-1.5">
        {plannerSnapshot.map((day) => (
          <Link key={day.key} href={day.href} className={`dashboard-day-cell app-interactive rounded-xl p-2 ${day.count ? "dashboard-day-cell-active" : ""}`}>
            <span className="block text-center text-[10px] font-black text-app-muted">{day.label}</span>
            <span className="dashboard-kpi-number mt-2 block text-center text-lg font-black text-app-text font-outfit">{toPersianDigits(day.count)}</span>
            <span className="mx-auto mt-2 block h-1.5 w-8 rounded-full bg-app-primary/20">
              <span className="block h-full rounded-full bg-app-primary" style={{ width: `${Math.min(100, Math.max(12, day.count * 30))}%` }} />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 line-clamp-1 text-xs font-bold text-app-muted">{activeCampaigns[0]?.name ? `کمپین فعال: ${activeCampaigns[0].name}` : "کمپین فعالی روی برنامه نزدیک دیده نمی‌شود."}</p>
    </NSection>
  );
  const riskPanel: ReactNode = (
    <NSection title="صف ریسک" description="اگر چیزی مسدود باشد، اول همینجا دیده می‌شود." action={<Button href="/queue" variant="secondary" size="sm">بازیابی</Button>} className="dashboard-spec-card dashboard-risk-card">
      <div className="grid gap-2">
        {riskQueueItems.length ? riskQueueItems.slice(0, 4).map((item) => (
          <NRow key={item.id} icon={item.icon} title={item.title} detail={item.detail} tone={item.tone} href={item.href} meta={<Tag tone={item.tone}>اقدام</Tag>} />
        )) : <NEmptyState icon={CheckCircle2} title="ریسک فوری وجود ندارد" detail="صف، تایید و اتصال در وضعیت قابل قبول هستند." />}
      </div>
    </NSection>
  );
  const inboxPanel: ReactNode = (
    <NSection title="تریاژ پیام‌ها" description="تعهد پاسخ، پیام‌های عقب‌افتاده و کارهای من." action={<Button href="/inbox" variant="secondary" size="sm">Inbox</Button>} className="dashboard-spec-card dashboard-inbox-card">
      <div className="grid gap-2">
        <NRow icon={MessageSquare} title="پیام‌های نیازمند اقدام" detail={unreadAlerts ? `${toPersianDigits(unreadAlerts)} اعلان تازه` : "اعلان خوانده‌نشده عملیاتی نیست"} tone={unreadAlerts ? "warning" : "success"} href="/inbox" meta={<Tag tone={unreadAlerts ? "warning" : "success"}>{toPersianDigits(unreadAlerts)}</Tag>} />
        <NRow icon={Clock3} title="SLA امروز" detail={blockedWorkCount ? "اولویت با ریسک‌های فعال" : "زمان پاسخ در محدوده امن است"} tone={blockedWorkCount ? "warning" : "success"} href="/inbox" />
      </div>
    </NSection>
  );
  const campaignPanel: ReactNode = (
    <NSection title="حرکت کمپین‌ها" description="ریل‌های باریک کمپین، مرحله‌ها و تحویل بعدی." action={<Button href="/campaigns" variant="secondary" size="sm">کمپین‌ها</Button>} className="dashboard-spec-card dashboard-campaign-momentum">
      <div className="grid gap-2 md:grid-cols-3">
        {campaignMomentumItems.length ? campaignMomentumItems.slice(0, 3).map((campaign, index) => (
          <Link key={campaign.id} href={`/campaigns?campaignId=${campaign.id}`} className="dashboard-campaign-rail app-interactive rounded-xl p-3" style={{ "--campaign-accent": index === 0 ? "var(--n-chart-ready)" : index === 1 ? "var(--n-chart-scheduled)" : "var(--n-chart-draft)" } as CSSProperties}>
            <span className="block truncate text-sm font-black text-app-text">{campaign.name}</span>
            <span className="mt-1 block line-clamp-2 text-xs leading-5 text-app-muted">{campaign.goal || campaign.notes || "تحویل بعدی هنوز تعریف نشده است."}</span>
            <span className="mt-3 flex items-center justify-between text-[10px] font-black text-app-muted">
              <span>{campaign.status || "campaign"}</span>
              <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>
        )) : <NEmptyState icon={Megaphone} title="کمپین فعالی نیست" detail="برای دیدن ریل کمپین، یک کمپین تازه بسازید." />}
      </div>
    </NSection>
  );
  const insightPanel: ReactNode = (
    <NSection title="بینش امروز" description="یک پاسخ کوتاه، نه انبار آمار." action={<Button href={reportInsight.href} variant="secondary" size="sm">گزارش</Button>} className="dashboard-spec-card dashboard-insight-card">
      <div className="grid gap-3">
        <div className="flex items-start gap-3">
          <span className="nashrino-token-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-app-text">{reportInsight.title}</h2>
            <p className="mt-1 text-sm leading-7 text-app-muted">{reportInsight.detail}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone={reportInsight.tone}>{toPersianDigits(completionRate)}٪ تکمیل</Tag>
          <Tag tone={failureRate ? "warning" : "success"}>{toPersianDigits(failureRate)}٪ خطا</Tag>
        </div>
      </div>
    </NSection>
  );
  const dashboardFocusLayouts: Record<string, ReactNode> = {
    overview: <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">{publishPulsePanel}{insightPanel}</section>,
    planner: <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.9fr)]">{plannerPanel}{publishPulsePanel}</section>,
    risk: <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">{riskPanel}{inboxPanel}</section>,
    campaigns: <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">{campaignPanel}{insightPanel}</section>
  };

  return (
    <AuthGate>
      <AppShell>
        <NPage className="dashboard-spec-page pb-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <Panel variant="glass" className="col-span-1 md:col-span-12 lg:col-span-8 dashboard-command-brief relative overflow-hidden p-5 animate-fade-in">
              <div className={`absolute -top-12 -left-12 w-64 h-64 rounded-full blur-3xl pointer-events-none z-0 animate-pulse ${healthTone === 'success' ? 'bg-app-success/15' : healthTone === 'warning' ? 'bg-app-warning/15' : 'bg-app-alert/15'}`} />
              <div className="absolute top-8 left-8 flex items-center justify-center pointer-events-none z-0">
                <div className={`absolute w-5 h-5 rounded-full animate-ping opacity-75 ${healthTone === 'success' ? 'bg-app-success' : healthTone === 'warning' ? 'bg-app-warning' : 'bg-app-alert'}`} />
                <div className={`relative w-2.5 h-2.5 rounded-full shadow-lg ${healthTone === 'success' ? 'bg-app-success' : healthTone === 'warning' ? 'bg-app-warning' : 'bg-app-alert'}`} />
              </div>
              <div className="flex min-w-0 items-start gap-4 relative z-10">
                <WorkspaceAvatar name={store?.name || productName} size="lg" color={brandColor} imageUrl={brandImageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-section-kicker text-[10px] font-bold">داشبورد</p>
                    <Tag tone={healthTone}>{healthTone === "success" ? "فضای کاری پایدار" : healthTone === "warning" ? "نیازمند تکمیل" : "نیازمند رسیدگی"}</Tag>
                    {lastUpdatedAt ? <Tag tone="neutral" className="font-outfit">{toPersianDigits(lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}</Tag> : null}
                  </div>
                  <h1 className="mt-2 text-[22px] font-bold leading-8 text-app-text sm:text-2xl">داشبورد امروز</h1>
                  <p className="mt-1 max-w-4xl text-sm leading-7 text-app-muted">{briefing}</p>
                </div>
              </div>
            </Panel>

            <Panel variant="glass" className="col-span-1 md:col-span-12 lg:col-span-4 dashboard-next-action flex flex-col justify-between p-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="nashrino-live-signal mt-1 h-3 w-3 shrink-0 rounded-full bg-app-primary animate-pulse" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-app-primary">اقدام بعدی</p>
                  <h2 className="mt-1 line-clamp-1 text-base font-bold text-app-text">{nextAction.label}</h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-muted">{nextAction.detail}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button href={nextAction.href}>
                  <span>ادامه</span>
                  <ArrowUpLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => loadDashboard(true)} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  <span>تازه‌سازی</span>
                </Button>
              </div>
            </Panel>

            {(error || loading) && (
              <div className="col-span-1 md:col-span-12">
                {error ? <NNotice tone="alert">{error}</NNotice> : null}
                {loading ? <Skeleton className="h-4 w-44" /> : null}
              </div>
            )}

            {topMetrics.map((metric) => (
              <div key={metric.label} className="col-span-1 sm:col-span-6 lg:col-span-3">
                <MetricTile {...metric} />
              </div>
            ))}

            <Panel variant="glass" className="col-span-1 sm:col-span-6 lg:col-span-4 dashboard-visual-card relative overflow-hidden p-5 group">
              <div className="flex min-w-0 items-center gap-3 relative z-10">
                <div className="dashboard-donut shrink-0 h-14 w-14 rounded-full flex items-center justify-center font-outfit font-black text-lg shadow-md ring-1 ring-app-border/50 transition-transform duration-300 group-hover:scale-105" style={{ background: statusMixBackground }}>
                  <span className="bg-app-surface h-10 w-10 rounded-full flex items-center justify-center shadow-inner ring-1 ring-app-border/10 font-outfit font-black">{toPersianDigits(statusMixTotal)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-app-primary">ترکیب محتوا</p>
                  <h2 className="mt-1 text-sm font-bold text-app-text">وضعیت کل محتوا</h2>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {statusMixItems.map((item) => (
                      <span key={item.label} className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-app-muted">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.label}</span>
                        <span className="mr-auto font-outfit font-bold text-app-text">{toPersianDigits(item.value)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel variant="glass" className="col-span-1 sm:col-span-6 lg:col-span-4 dashboard-visual-card p-5">
              <div className="flex flex-col justify-between h-full gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-app-primary">سلامت عملیات</p>
                  <h2 className="mt-1 text-sm font-bold text-app-text font-outfit flex items-center gap-1">{toPersianDigits(operationsHealth)}٪ <span className="font-vazirmatn text-xs">آماده</span></h2>
                  <p className="mt-1 line-clamp-1 text-xs text-app-muted">{blockedWorkCount ? `${toPersianDigits(blockedWorkCount)} مورد نیازمند توجه` : "مسیر انتشار آرام است"}</p>
                </div>
                <div className="w-full h-2 bg-app-surfaceMuted rounded-full overflow-hidden mt-auto">
                  <div className="h-full bg-app-success transition-all duration-500 ease-out" style={{ width: `${operationsHealth}%` }} />
                </div>
              </div>
            </Panel>

            <Panel variant="glass" className="col-span-1 md:col-span-12 lg:col-span-4 dashboard-visual-card p-5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-app-primary">ریتم هفته</p>
                  <h2 className="mt-1 text-sm font-bold text-app-text">تراکم فعالیت</h2>
                </div>
                <Tag tone={weeklyActivity.some(Boolean) ? "primary" : "neutral"} className="font-outfit">{toPersianDigits(weeklyActivity.reduce((sum, value) => sum + value, 0))} <span className="font-vazirmatn px-1">رویداد</span></Tag>
              </div>
              <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
                {weeklyActivity.map((value, index) => (
                  <div key={weekKeys[index]} className="flex flex-1 flex-col items-center justify-end gap-2 h-full group">
                    <div className="relative flex w-full max-w-[14px] flex-1 flex-col justify-end bg-app-surfaceMuted/50 rounded-full overflow-hidden border border-app-border/30 shadow-inner">
                      <span className="w-full rounded-full bg-gradient-to-t from-app-primary to-app-primary/40 transition-all duration-700 ease-out group-hover:opacity-80" style={{ height: `${Math.max(12, (value / maxWeeklyActivity) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-app-muted/80">{weeklyLabels[index]}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel variant="glass" className="col-span-1 md:col-span-12 lg:col-span-8 dashboard-focus-shell p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 px-1">
                  <p className="text-[10px] font-bold text-app-primary">نمای متمرکز</p>
                  <h2 className="mt-1 text-sm font-bold text-app-text">هر بار فقط یک مسیر تصمیم‌گیری</h2>
                </div>
                <NTabs tabs={dashboardFocusTabs} activeTab={dashboardView} onTabChange={setDashboardView} className="w-full sm:w-auto" />
              </div>
              <div className="mt-5 dashboard-focus-panel">
                {dashboardFocusLayouts[dashboardView] ?? dashboardFocusLayouts.overview}
              </div>
            </Panel>

            <Panel variant="glass" className="col-span-1 md:col-span-12 lg:col-span-4 dashboard-recent-content flex flex-col p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-sm font-bold text-app-text">آخرین محتوا</h2>
                  <p className="text-xs text-app-muted mt-1">میانبر به پست‌های اخیر</p>
                </div>
                <Button href="/content" variant="secondary" size="sm">کتابخانه</Button>
              </div>
              
              {dashboardRecentItems.length ? (
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                  {dashboardRecentItems.map((item) => (
                    <Link key={item.id} href={item.href} className="group flex items-center justify-between p-3 rounded-xl border border-app-border bg-app-surface/50 hover:bg-app-surface transition-colors">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-app-text group-hover:text-app-primary transition-colors">{item.title}</span>
                        <span className="block truncate text-[10px] text-app-muted mt-0.5">{item.channel} · <span className="font-outfit">{item.publishTime}</span></span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mr-3">
                        <Tag tone={item.statusTone}>{item.status}</Tag>
                        <span className="font-outfit font-black text-xs text-app-muted bg-app-canvas px-1.5 py-0.5 rounded">{toPersianDigits(item.score)}٪</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <NEmptyState icon={FileText} title="محتوایی نیست" detail="اولین پست را بسازید" />
              )}
            </Panel>
          </div>
        </NPage>
      </AppShell>
    </AuthGate>
  );
}

