"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Clipboard, ExternalLink, ImageIcon, ListChecks, RefreshCw, RotateCcw, TimerReset, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { ApprovalBadge } from "../../components/approval-badge";
import { ChannelBadges } from "../../components/channel-badges";
import { CountdownBadge } from "../../components/countdown-badge";
import { DataSearchField, DataToolbar } from "../../components/data-view";
import { LoadingRows } from "../../components/loading-skeleton";
import { ContentOperationCard } from "../../components/pro-product-ui";
import { PublishingWorkspaceHeader } from "../../components/publishing-workspace";
import { StatusBadge } from "../../components/status-badge";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { DetailGrid, EmptyState, NoticeBanner, StatusToken, Timeline, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { buildCampaignFilterOptions, campaignColorForPost, campaignKeyForPost, campaignLabelForPost, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { channelCanAutoPublish, channelCanManualPublish, channelIsReady, channelStatusLabel, findChannelAccount, loadChannelAccounts, type ChannelAccount } from "../../lib/channel-accounts";
import { normalizeChannels } from "../../lib/channels";
import { notifyNotificationsUpdated } from "../../lib/notifications";
import { apiUrl, approvalBlocksPublishing, approvalConfig, authHeaders, formatDateTime, postFinalText, readApiError, recoveryGuidance, type Post } from "../../lib/posts";

type QueueFilter = "all" | "ready" | "scheduled" | "publishing" | "manual_ready" | "failed";

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

const queueFilters: Array<{ label: string; value: QueueFilter }> = [
  { label: "همه صف", value: "all" },
  { label: "آماده", value: "ready" },
  { label: "زمان‌بندی‌شده", value: "scheduled" },
  { label: "در حال انتشار", value: "publishing" },
  { label: "آماده دستی", value: "manual_ready" },
  { label: "ناموفق", value: "failed" }
];

const queueStatuses = new Set(["ready", "scheduled", "publishing", "manual_ready", "failed"]);
const queuePriority: Record<string, number> = {
  failed: 0,
  publishing: 1,
  manual_ready: 2,
  scheduled: 3,
  ready: 4
};
function scheduleTime(post: Post) {
  const date = post.scheduled_at ? new Date(post.scheduled_at) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function sortQueuePosts(posts: Post[]) {
  return [...posts].sort((first, second) => {
    const priorityDiff = (queuePriority[first.status] ?? 9) - (queuePriority[second.status] ?? 9);
    if (priorityDiff !== 0) return priorityDiff;
    return scheduleTime(first) - scheduleTime(second);
  });
}

function visibleQueueText(post: Post) {
  return [post.title, post.caption, post.hashtags, post.campaign, post.internal_note, post.last_error].filter(Boolean).join(" ").toLowerCase();
}

export default function QueuePage() {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channelAccounts, setChannelAccounts] = useState<ChannelAccount[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<QueueFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingPostId, setRetryingPostId] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [markingManualPostId, setMarkingManualPostId] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadQueue = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const headers = authHeaders();
      const [response, campaignsResponse, channelData, mediaResponse] = await Promise.all([
        fetch(`${apiUrl}/posts`, { headers }),
        loadCampaigns(),
        loadChannelAccounts(),
        fetch(`${apiUrl}/media`, { headers })
      ]);
      if (!response.ok) throw new Error("دریافت صف انتشار ناموفق بود");
      const allPosts = (await response.json()) as Post[];
      const queuePosts = sortQueuePosts(allPosts.filter((post) => queueStatuses.has(post.status)));
      setPosts(queuePosts);
      setCampaigns(campaignsResponse);
      setChannelAccounts(channelData.accounts);
      setMediaAssets(mediaResponse.ok ? await mediaResponse.json() : []);
      setSelectedPostId((current) => current ?? queuePosts[0]?.id ?? null);
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت صف انتشار");
      setLoading(false);
    });
  }, [loadQueue]);

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
        .slice(0, 48);
      const entries = await Promise.all(
        imageAssets.map(async (asset) => {
          try {
            const response = await fetch(`${apiUrl}/media/${asset.id}/file`, { headers: authHeaders() });
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

  async function retryPost(post: Post) {
    setMessage("");
    setError("");
    setRetryingPostId(post.id);
    const previousPosts = posts;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, status: "scheduled", scheduled_at: new Date().toISOString(), failed_at: null, last_error: "" } : item));
    const response = await fetch(`${apiUrl}/posts/${post.id}/retry`, {
      method: "POST",
      headers: authHeaders()
    });
    if (!response.ok) {
      setPosts(previousPosts);
      const detail = await readApiError(response, "تلاش مجدد انتشار ناموفق بود");
      setError(detail);
      setRetryingPostId(null);
      showToast({ title: "تلاش مجدد ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    setMessage("پست برای تلاش مجدد وارد صف انتشار شد");
    showToast({ title: "پست دوباره وارد صف شد", description: post.title, tone: "success" });
    setRetryingPostId(null);
    notifyNotificationsUpdated();
    await loadQueue(true);
  }

  async function retryAllFailed() {
    setMessage("");
    setError("");
    setRetryingAll(true);
    const response = await fetch(`${apiUrl}/posts/retry-failed`, {
      method: "POST",
      headers: authHeaders()
    });
    if (!response.ok) {
      const detail = await readApiError(response, "بازیابی گروهی صف ناموفق بود");
      setError(detail);
      setRetryingAll(false);
      showToast({ title: "بازیابی صف ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    const result = (await response.json()) as { retried_count: number };
    setMessage(`${result.retried_count} پست دوباره وارد صف انتشار شد`);
    showToast({ title: "بازیابی صف انجام شد", description: `${result.retried_count} پست برای تلاش مجدد آماده شد`, tone: "success" });
    setRetryingAll(false);
    notifyNotificationsUpdated();
    await loadQueue(true);
  }

  async function cancelPost(post: Post) {
    setMessage("");
    setError("");
    const previousPosts = posts;
    setPosts((current) => current.filter((item) => item.id !== post.id));
    const response = await fetch(`${apiUrl}/posts/${post.id}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify({ status: "cancelled" })
    });
    if (!response.ok) {
      setPosts(previousPosts);
      setError("لغو پست ناموفق بود");
      showToast({ title: "لغو پست ناموفق بود", description: post.title, tone: "alert" });
      return;
    }
    setMessage("پست از صف انتشار خارج شد");
    showToast({ title: "پست از صف خارج شد", description: post.title, tone: "success" });
    notifyNotificationsUpdated();
    await loadQueue();
  }

  async function copyManualCaption(post: Post) {
    const text = postFinalText(post) || post.title;
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: "کپشن کپی شد", description: "حالا می‌توانید آن را در Instagram جای‌گذاری کنید.", tone: "success" });
    } catch {
      showToast({ title: "کپی خودکار ناموفق بود", description: "کپشن را از پنل بازبین انتخاب و دستی کپی کنید.", tone: "warning" });
    }
  }

  function openInstagram() {
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  async function markManualPublished(post: Post) {
    setMessage("");
    setError("");
    setMarkingManualPostId(post.id);
    const response = await fetch(`${apiUrl}/posts/${post.id}/manual-published`, {
      method: "POST",
      headers: authHeaders()
    });
    if (!response.ok) {
      const detail = await readApiError(response, "ثبت انتشار دستی ناموفق بود");
      setError(detail);
      setMarkingManualPostId(null);
      showToast({ title: "ثبت انتشار دستی ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    const updated = (await response.json()) as Post;
    setPosts((current) => current.filter((item) => item.id !== updated.id));
    setSelectedPostId((current) => current === updated.id ? null : current);
    setMessage("پست به عنوان منتشرشده ثبت شد");
    setMarkingManualPostId(null);
    notifyNotificationsUpdated();
    showToast({ title: "انتشار دستی ثبت شد", description: updated.title, tone: "success" });
    await loadQueue(true);
  }

  const filteredPosts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return posts
      .filter((post) => statusFilter === "all" || post.status === statusFilter)
      .filter((post) => campaignFilter === "all" || campaignKeyForPost(post) === campaignFilter)
      .filter((post) => !query || visibleQueueText(post).includes(query));
  }, [campaignFilter, posts, searchTerm, statusFilter]);

  const campaignOptions = useMemo(() => buildCampaignFilterOptions(posts, campaigns), [campaigns, posts]);

  const counts = useMemo(() => {
    return {
      ready: posts.filter((post) => post.status === "ready").length,
      scheduled: posts.filter((post) => post.status === "scheduled").length,
      publishing: posts.filter((post) => post.status === "publishing").length,
      manual_ready: posts.filter((post) => post.status === "manual_ready").length,
      failed: posts.filter((post) => post.status === "failed").length,
      blockedByReview: posts.filter((post) => approvalBlocksPublishing(post)).length
    };
  }, [posts]);

  const mediaByPostId = useMemo(() => {
    const grouped = new Map<number, MediaAsset[]>();
    mediaAssets.forEach((asset) => {
      if (!asset.post_id) return;
      grouped.set(asset.post_id, [...(grouped.get(asset.post_id) ?? []), asset]);
    });
    return grouped;
  }, [mediaAssets]);

  const nextScheduled = useMemo(() => {
    const now = Date.now();
    return posts.find((post) => post.status === "scheduled" && scheduleTime(post) >= now);
  }, [posts]);

  const selectedPost = selectedPostId ? posts.find((post) => post.id === selectedPostId) ?? filteredPosts[0] ?? null : filteredPosts[0] ?? posts[0] ?? null;
  const readyChannelCount = channelAccounts.filter(channelIsReady).length;
  const filterCount = (filter: QueueFilter) => filter === "all" ? posts.length : counts[filter];
  const queueSummary = [
    {
      label: "آماده",
      detail: "منتظر انتخاب زمان",
      status: "ready" as const,
      count: counts.ready,
      icon: CheckCircle2,
      tone: "text-app-primary"
    },
    {
      label: "زمان‌بندی‌شده",
      detail: "داخل برنامه انتشار",
      status: "scheduled" as const,
      count: counts.scheduled,
      icon: CalendarClock,
      tone: "text-amber-700"
    },
    {
      label: "در حال انتشار",
      detail: "در اختیار worker",
      status: "publishing" as const,
      count: counts.publishing,
      icon: TimerReset,
      tone: "text-sky-700"
    },
    {
      label: "آماده دستی",
      detail: "نیازمند انتشار دستی",
      status: "manual_ready" as const,
      count: counts.manual_ready,
      icon: CheckCircle2,
      tone: counts.manual_ready ? "text-sky-700" : "text-slate-500"
    },
    {
      label: "ناموفق",
      detail: "نیازمند بازیابی",
      status: "failed" as const,
      count: counts.failed,
      icon: AlertTriangle,
      tone: counts.failed ? "text-rose-700" : "text-slate-500"
    }
  ];

  function primaryMediaForPost(post: Post) {
    return (mediaByPostId.get(post.id) ?? [])[0] ?? null;
  }

  function previewUrlForPost(post: Post) {
    const asset = primaryMediaForPost(post);
    return asset ? mediaPreviewUrls[asset.id] ?? "" : "";
  }

  function postChannelReadiness(post: Post) {
    return normalizeChannels(post.platform).map((channel) => {
      const account = findChannelAccount(channelAccounts, channel);
      const label = channel === "rubika" ? "روبیکا" : "اینستاگرام";
      const mode = account?.mode === "instagram_personal_manual" ? "دستی" : channelCanAutoPublish(account) ? "خودکار" : channelCanManualPublish(account) ? "دستی" : "نیازمند تنظیم";
      return {
        label,
        value: channelStatusLabel(account),
        hint: mode
      };
    });
  }

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="space-y-4">
          <PublishingWorkspaceHeader
            activeTab="queue"
            title="صف انتشار"
            description="گلوگاه‌های انتشار، زمان‌بندی و بازیابی خطا را در یک نمای عملیاتی کنترل کنید."
            counts={{
              queue: posts.length
            }}
            meta={(
              <>
                <StatusToken tone="primary">{posts.length} پست در صف</StatusToken>
                <StatusToken tone={counts.failed ? "alert" : "success"}>{counts.failed ? `${counts.failed} خطای فعال` : "بدون خطای فعال"}</StatusToken>
                <StatusToken tone={counts.blockedByReview ? "warning" : "success"}>{counts.blockedByReview ? `${counts.blockedByReview} منتظر تایید` : "بازبینی پاک"}</StatusToken>
                <StatusToken tone={readyChannelCount ? "success" : "warning"}>{readyChannelCount}/{channelAccounts.length || 2} کانال آماده</StatusToken>
                {lastUpdatedAt ? <StatusToken tone="neutral">به‌روزرسانی {lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</StatusToken> : null}
              </>
            )}
            action={(
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => loadQueue(true)}>
                  <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  به‌روزرسانی
                </Button>
                {counts.failed ? (
                  <Button type="button" size="sm" disabled={retryingAll || posts.some((post) => post.status === "failed" && approvalBlocksPublishing(post))} onClick={retryAllFailed}>
                    <RotateCcw className={`ml-2 h-4 w-4 ${retryingAll ? "animate-spin" : ""}`} aria-hidden="true" />
                    بازیابی همه خطاها
                  </Button>
                ) : null}
              </div>
            )}
          />

          {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}
          {message ? <NoticeBanner tone="success">{message}</NoticeBanner> : null}
          {posts.some((post) => post.status === "failed" && approvalBlocksPublishing(post)) ? (
            <NoticeBanner tone="warning" title="بازیابی گروهی محدود شده است">
              بعضی پست‌های ناموفق هنوز تایید بازبینی ندارند. آن‌ها را از لیست محتوا تایید کنید یا جداگانه بررسی کنید.
            </NoticeBanner>
          ) : null}
          {!readyChannelCount ? (
            <NoticeBanner tone="warning" title="هیچ کانال آماده‌ای فعال نیست">
              برای زمان‌بندی و بازیابی صف، ابتدا وضعیت روبیکا یا اینستاگرام را در مرکز کانال‌ها کامل کنید.
            </NoticeBanner>
          ) : null}

          <section className="grid overflow-hidden rounded-md border border-app-border bg-white sm:grid-cols-2 xl:grid-cols-4">
            {queueSummary.map((item) => {
              const Icon = item.icon;
              const active = statusFilter === item.status;
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => setStatusFilter(active ? "all" : item.status)}
                  className={`flex min-w-0 items-start gap-3 border-b border-app-border p-3 text-right transition hover:bg-slate-50 sm:border-l sm:last:border-l-0 xl:border-b-0 ${
                    active ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 ${item.tone}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className={`text-lg font-black ${item.tone}`}>{item.count}</span>
                      <span className="truncate text-xs font-bold text-app-text">{item.label}</span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-app-muted">{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <WorkspacePanel
              title="عملیات صف"
              description="پست‌های صف را اسکن کنید و اقدام‌های اصلی را از بازبین کناری انجام دهید."
              bodyClassName="p-4"
              action={<Button href="/logs" variant="secondary" size="sm">سلامت انتشار</Button>}
            >
              <DataToolbar
                meta={(
                  <>
                    <StatusToken tone="neutral">{filteredPosts.length} نتیجه</StatusToken>
                    <StatusToken tone="neutral">{posts.length} کل صف</StatusToken>
                  </>
                )}
              >
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_180px] xl:items-center">
                  <DataSearchField
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="جست‌وجوی عنوان، کپشن، کمپین، یادداشت یا خطا"
                  />
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as QueueFilter)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      {queueFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label} · {filterCount(filter.value)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      <option value="all">همه کمپین‌ها</option>
                      {campaignOptions.map((campaign) => <option key={campaign.value} value={campaign.value}>{campaign.label} · {campaign.count}</option>)}
                    </select>
                  </label>
                </div>
              </DataToolbar>

              <div className="mt-3 max-h-[66vh] overflow-y-auto rounded-lg bg-app-surfaceMuted/50 p-2 shadow-inner sm:mt-4">
                {loading ? <LoadingRows /> : null}
                {!loading && filteredPosts.length === 0 ? (
                  <EmptyState
                    icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
                    title="برای این فیلتر پستی در صف نیست."
                    description="از استودیو تولید یک پست آماده یا زمان‌بندی‌شده بسازید."
                    action={<Button href="/compose">ایجاد پست جدید</Button>}
                  />
                ) : null}
                {!loading && filteredPosts.length > 0 ? (
                  <div className="grid gap-2.5">
                    {filteredPosts.map((post) => {
                      const previewUrl = previewUrlForPost(post);
                      const media = primaryMediaForPost(post);
                      const campaignKey = campaignKeyForPost(post);
                      const selected = selectedPost?.id === post.id;
                      return (
                        <ContentOperationCard
                          key={post.id}
                          action={(
                            <Button type="button" variant={selected ? "primary" : "secondary"} size="sm" onClick={() => setSelectedPostId(post.id)}>
                              بازبینی
                            </Button>
                          )}
                          approval={<ApprovalBadge status={post.approval_status} compact />}
                          campaignColor={campaignColorForPost(post, campaigns)}
                          campaignLabel={campaignKey !== "none" ? campaignLabelForPost(post, campaigns) : "بدون کمپین"}
                          caption={post.caption || "بدون کپشن"}
                          error={post.last_error}
                          lifecycle={(
                            <>
                              <StatusBadge status={post.status} />
                              <CountdownBadge status={post.status} scheduledAt={post.scheduled_at} />
                            </>
                          )}
                          mediaLabel={media ? "رسانه آماده" : "بدون رسانه"}
                          meta={(
                            <>
                              <p>زمان‌بندی: {formatDateTime(post.scheduled_at)}</p>
                              <p>تلاش انتشار: {post.attempt_count}</p>
                              <p>آخرین تغییر: {formatDateTime(post.updated_at)}</p>
                            </>
                          )}
                          onSelect={() => setSelectedPostId(post.id)}
                          platform={post.platform}
                          previewAlt={media?.original_filename ?? post.title}
                          previewUrl={previewUrl}
                          selected={selected}
                          title={post.title}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </WorkspacePanel>

            <aside className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <div className="space-y-4">
                <WorkspacePanel title="بازبین صف" description="جزئیات و اقدام‌های پست انتخاب‌شده." bodyClassName="max-h-[68vh] overflow-y-auto p-3 sm:p-4 lg:max-h-none">
                  {selectedPost ? (
                    <div>
                      <div className="mb-4 overflow-hidden rounded-md bg-slate-50 ring-1 ring-app-border">
                        {previewUrlForPost(selectedPost) ? (
                          <img src={previewUrlForPost(selectedPost)} alt={primaryMediaForPost(selectedPost)?.original_filename ?? selectedPost.title} className="aspect-video w-full object-cover" />
                        ) : (
                          <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-app-muted">
                            <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                            این پست بدون رسانه وارد صف شده است
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={selectedPost.status} />
                        <ChannelBadges platform={selectedPost.platform} compact />
                        <ApprovalBadge status={selectedPost.approval_status} />
                        <CountdownBadge status={selectedPost.status} scheduledAt={selectedPost.scheduled_at} />
                        {primaryMediaForPost(selectedPost) ? <StatusToken tone="success">رسانه آماده</StatusToken> : <StatusToken tone="warning">نیازمند رسانه</StatusToken>}
                      </div>
                      <h2 className="mt-3 font-black text-app-text">{selectedPost.title}</h2>
                      <p className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-app-border bg-slate-50 p-3 text-sm leading-7 text-app-muted">
                        {selectedPost.caption || "بدون کپشن"}
                      </p>
                      <div className="mt-4">
                        <DetailGrid
                          items={[
                            { label: "زمان‌بندی", value: formatDateTime(selectedPost.scheduled_at) },
                            { label: "کمپین", value: campaignLabelForPost(selectedPost, campaigns) },
                            { label: "بازبینی", value: approvalConfig(selectedPost.approval_status).label },
                            { label: "تلاش انتشار", value: selectedPost.attempt_count },
                            { label: "آخرین تغییر", value: formatDateTime(selectedPost.updated_at) },
                            { label: "شناسه پست", value: `#${selectedPost.id}` },
                            ...postChannelReadiness(selectedPost)
                          ]}
                        />
                      </div>
                      <div className="mt-4">
                        <p className="mb-3 text-xs font-black text-app-text">مسیر صف</p>
                        <Timeline items={[
                          {
                            title: "ساخت محتوا",
                            description: "رکورد پست در فضای کاری ایجاد شده است.",
                            meta: formatDateTime(selectedPost.created_at),
                            tone: "primary"
                          },
                          {
                            title: selectedPost.scheduled_at ? "ورود به برنامه انتشار" : "آماده‌سازی برای صف",
                            description: selectedPost.scheduled_at ? "زمان انتشار برای این پست ثبت شده است." : "پست منتظر تصمیم بعدی مدیر فضای کاری است.",
                            meta: selectedPost.scheduled_at ? formatDateTime(selectedPost.scheduled_at) : undefined,
                            tone: selectedPost.scheduled_at ? "warning" : "neutral"
                          },
                          {
                            title: selectedPost.status === "failed" ? "نیازمند بازیابی" : selectedPost.status === "publishing" ? "در اختیار worker" : "وضعیت فعلی صف",
                            description: selectedPost.last_error || "وضعیت صف برای این پست پایدار است.",
                            meta: `آخرین تغییر: ${formatDateTime(selectedPost.updated_at)}`,
                            tone: selectedPost.status === "failed" ? "alert" : selectedPost.status === "publishing" ? "primary" : "success"
                          }
                        ]} />
                      </div>
                      {selectedPost.last_error ? (
                        <div className="mt-4 space-y-3">
                          <NoticeBanner tone="alert" title="آخرین خطا">
                            {selectedPost.last_error}
                          </NoticeBanner>
                          <NoticeBanner tone="info" title="پیشنهاد بازیابی">
                            {recoveryGuidance(selectedPost.last_error)}
                          </NoticeBanner>
                        </div>
                      ) : null}
                      {approvalBlocksPublishing(selectedPost) ? (
                        <NoticeBanner tone="warning" title="انتشار مسدود است">
                          {approvalConfig(selectedPost.approval_status).description}
                        </NoticeBanner>
                      ) : null}
                      {selectedPost.status === "manual_ready" ? (
                        <div className="mt-4 space-y-3">
                          <NoticeBanner tone="info" title="آماده انتشار دستی اینستاگرام">
                            کپشن را کپی کنید، تصویر را در Instagram انتخاب کنید و پس از انتشار، این پست را به عنوان منتشرشده ثبت کنید.
                          </NoticeBanner>
                          <div className="grid gap-2">
                            <Button type="button" onClick={() => copyManualCaption(selectedPost)}>
                              <Clipboard className="ml-2 h-4 w-4" aria-hidden="true" />
                              کپی کپشن
                            </Button>
                            <Button type="button" variant="secondary" onClick={openInstagram}>
                              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                              باز کردن Instagram
                            </Button>
                            <Button type="button" variant="secondary" disabled={markingManualPostId === selectedPost.id} onClick={() => markManualPublished(selectedPost)}>
                              <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden="true" />
                              {markingManualPostId === selectedPost.id ? "در حال ثبت" : "ثبت به عنوان منتشرشده"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2">
                        <Button href={`/compose?postId=${selectedPost.id}`} variant="secondary">باز کردن پست</Button>
                        {selectedPost.status === "failed" ? (
                          <Button type="button" disabled={retryingPostId === selectedPost.id || approvalBlocksPublishing(selectedPost)} onClick={() => retryPost(selectedPost)}>
                            <RotateCcw className={`ml-2 h-4 w-4 ${retryingPostId === selectedPost.id ? "animate-spin" : ""}`} aria-hidden="true" />
                            {retryingPostId === selectedPost.id ? "در حال ورود به صف" : "تلاش مجدد انتشار"}
                          </Button>
                        ) : null}
                        {["ready", "scheduled", "manual_ready"].includes(selectedPost.status) ? (
                          <Button type="button" variant="ghost" onClick={() => cancelPost(selectedPost)}>
                            لغو از صف
                          </Button>
                        ) : null}
                        <Button href="/logs" variant="secondary">مشاهده لاگ انتشار</Button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<XCircle className="h-5 w-5" aria-hidden="true" />}
                      title="پستی برای نمایش انتخاب نشده است."
                      action={<Button href="/compose">زمان‌بندی پست</Button>}
                    />
                  )}
                </WorkspacePanel>

                {nextScheduled ? (
                  <WorkspacePanel title="انتشار بعدی" description="نزدیک‌ترین پست زمان‌بندی‌شده در صف." bodyClassName="p-3" className="hidden xl:block">
                    <p className="font-black text-app-text">{nextScheduled.title}</p>
                    <p className="mt-2 text-sm leading-7 text-app-muted">{formatDateTime(nextScheduled.scheduled_at)}</p>
                    <CountdownBadge status={nextScheduled.status} scheduledAt={nextScheduled.scheduled_at} className="mt-3" />
                  </WorkspacePanel>
                ) : null}

              </div>
            </aside>
          </section>
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}
