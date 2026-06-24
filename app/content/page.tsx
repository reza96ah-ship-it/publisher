"use client";

import {
  AlertCircle,
  ArrowDownUp,
  CalendarClock,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  FileText,
  ImageIcon,
  MessageSquareText,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { ApprovalBadge } from "../../components/approval-badge";
import { ChannelBadges } from "../../components/channel-badges";
import { CountdownBadge } from "../../components/countdown-badge";
import { LoadingRows } from "../../components/loading-skeleton";
import {
  NInspectorDrawer,
  NMetricTile,
  NNotice,
  NPage,
  NPageHeader,
  NSavedViewToolbar,
  NSection,
  NStatusPill
} from "../../components/nahrino-ui";
import { ContentOperationCard } from "../../components/pro-product-ui";
import { StatusBadge } from "../../components/status-badge";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { DetailGrid, EmptyState, StatusToken } from "../../components/workspace-ui";
import { buildCampaignFilterOptions, campaignColorForPost, campaignKeyForPost, campaignLabelForPost, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { notifyNotificationsUpdated } from "../../lib/notifications";
import { apiUrl, approvalConfig, approvalTabs, authHeaders, formatDateTime, Post, postFinalText, readApiError, workflowTabs } from "../../lib/posts";

type Metric = {
  label: string;
  value: number | string;
  hint: string;
  icon: typeof FileText;
  tone: "neutral" | "primary" | "success" | "warning" | "alert" | "info";
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

type SortMode = "priority" | "updated" | "schedule" | "title";
type ReviewAction = "submit-review" | "approve" | "reject" | "request-changes";
type ContentSavedView = "all" | "attention" | "ready" | "draft" | "published";

const searchableFields: Array<keyof Pick<Post, "title" | "caption" | "hashtags" | "campaign" | "internal_note">> = [
  "title",
  "caption",
  "hashtags",
  "campaign",
  "internal_note"
];
function statusCount(posts: Post[], status: string) {
  if (status === "all") return posts.length;
  return posts.filter((post) => post.status === status).length;
}

function compareBySchedule(a: Post, b: Post) {
  const first = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  const second = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  return first - second;
}

function visiblePostText(post: Post) {
  return searchableFields.map((field) => post[field] ?? "").join(" ").toLowerCase();
}

function postMatchesSavedView(post: Post, view: ContentSavedView) {
  if (view === "attention") {
    return post.status === "failed" || ["pending", "changes_requested", "rejected"].includes(post.approval_status || "");
  }
  if (view === "ready") return ["ready", "scheduled", "publishing"].includes(post.status);
  if (view === "draft") return post.status === "draft";
  if (view === "published") return post.status === "published";
  return true;
}

export default function ContentWorkspacePage() {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [activeView, setActiveView] = useState<ContentSavedView>("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reviewNote, setReviewNote] = useState("");
  const [reviewingAction, setReviewingAction] = useState<ReviewAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPosts = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const headers = authHeaders();
      const [response, campaignsResponse, mediaResponse] = await Promise.all([
        fetch(`${apiUrl}/posts`, { headers }),
        loadCampaigns(),
        fetch(`${apiUrl}/media`, { headers })
      ]);
      if (!response.ok) throw new Error("دریافت پست‌ها ناموفق بود");
      const data: Post[] = await response.json();
      setPosts(data);
      setCampaigns(campaignsResponse);
      setMediaAssets(mediaResponse.ok ? await mediaResponse.json() : []);
      setSelectedPostId((current) => current ?? data[0]?.id ?? null);
      setSelectedIds((current) => new Set([...current].filter((id) => data.some((post) => post.id === id))));
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت فضای محتوا");
      setLoading(false);
    });
  }, [loadPosts]);

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

  useEffect(() => {
    const requestedStatus = new URLSearchParams(window.location.search).get("status");
    if (requestedStatus && workflowTabs.some((tab) => tab.value === requestedStatus)) {
      setActiveStatus(requestedStatus);
    }
  }, []);

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts
      .filter((post) => postMatchesSavedView(post, activeView))
      .filter((post) => activeStatus === "all" || post.status === activeStatus)
      .filter((post) => campaignFilter === "all" || campaignKeyForPost(post) === campaignFilter)
      .filter((post) => approvalFilter === "all" || (post.approval_status || "not_required") === approvalFilter)
      .filter((post) => !query || visiblePostText(post).includes(query))
      .sort((a, b) => {
        if (sortMode === "updated") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (sortMode === "schedule") return compareBySchedule(a, b);
        if (sortMode === "title") return a.title.localeCompare(b.title, "fa");
        if (a.status === "failed" && b.status !== "failed") return -1;
        if (a.status !== "failed" && b.status === "failed") return 1;
        return compareBySchedule(a, b);
      });
  }, [activeStatus, activeView, approvalFilter, campaignFilter, posts, search, sortMode]);

  const campaignOptions = useMemo(() => buildCampaignFilterOptions(posts, campaigns), [campaigns, posts]);

  const savedViews = useMemo(() => ([
    { label: "همه", value: "all", count: posts.length },
    { label: "نیازمند رسیدگی", value: "attention", count: posts.filter((post) => postMatchesSavedView(post, "attention")).length },
    { label: "آماده انتشار", value: "ready", count: posts.filter((post) => postMatchesSavedView(post, "ready")).length },
    { label: "پیش‌نویس", value: "draft", count: posts.filter((post) => postMatchesSavedView(post, "draft")).length },
    { label: "منتشرشده", value: "published", count: posts.filter((post) => postMatchesSavedView(post, "published")).length }
  ]), [posts]);

  const mediaByPostId = useMemo(() => {
    const grouped = new Map<number, MediaAsset[]>();
    mediaAssets.forEach((asset) => {
      if (!asset.post_id) return;
      grouped.set(asset.post_id, [...(grouped.get(asset.post_id) ?? []), asset]);
    });
    return grouped;
  }, [mediaAssets]);

  const selectedPost = useMemo(() => {
    if (selectedPostId) {
      return posts.find((post) => post.id === selectedPostId) ?? filteredPosts[0] ?? null;
    }
    return filteredPosts[0] ?? posts[0] ?? null;
  }, [filteredPosts, posts, selectedPostId]);

  useEffect(() => {
    setReviewNote(selectedPost?.approval_note || "");
  }, [selectedPost?.id, selectedPost?.approval_note]);

  const metrics = useMemo<Metric[]>(() => {
    const failed = statusCount(posts, "failed");
    const scheduled = statusCount(posts, "scheduled");
    const ready = statusCount(posts, "ready");
    const pendingReview = posts.filter((post) => post.approval_status === "pending").length;
    const nextScheduled = posts
      .filter((post) => post.status === "scheduled" && post.scheduled_at)
      .sort(compareBySchedule)[0];

    return [
      {
        label: "کل محتوا",
        value: posts.length,
        hint: `${filteredPosts.length} پست در نمای فعلی`,
        icon: FileText,
        tone: "primary"
      },
      {
        label: "نیازمند رسیدگی",
        value: failed,
        hint: failed ? "پست ناموفق یا خطادار را بازبینی کنید" : "خطای فعال ندارید",
        icon: AlertCircle,
        tone: failed ? "alert" : "success"
      },
      {
        label: "در انتظار بازبینی",
        value: pendingReview,
        hint: pendingReview ? "تایید یا درخواست اصلاح را از پنل بازبینی انجام دهید" : "هیچ پست منتظر بازبینی نیست",
        icon: ShieldCheck,
        tone: pendingReview ? "warning" : "success"
      },
      {
        label: "آماده و زمان‌بندی‌شده",
        value: ready + scheduled,
        hint: nextScheduled ? `نزدیک‌ترین انتشار: ${formatDateTime(nextScheduled.scheduled_at)}` : "هنوز انتشار آینده ثبت نشده",
        icon: CalendarClock,
        tone: "warning"
      }
    ];
  }, [filteredPosts.length, posts]);

  const failedCount = statusCount(posts, "failed");
  const draftCount = statusCount(posts, "draft");
  const scheduledCount = statusCount(posts, "scheduled");
  const publishedCount = statusCount(posts, "published");
  const selectedVisibleIds = filteredPosts.map((post) => post.id);
  const allVisibleSelected = selectedVisibleIds.length > 0 && selectedVisibleIds.every((id) => selectedIds.has(id));

  function toggleSelected(postId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectedVisibleIds.forEach((id) => next.delete(id));
      else selectedVisibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkChangeStatus(status: "ready" | "cancelled") {
    if (!selectedIds.size) return;
    setMessage("");
    setError("");
    setBulkUpdating(true);
    const response = await fetch(`${apiUrl}/posts/bulk-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ post_ids: [...selectedIds], status })
    });
    if (!response.ok) {
      const detail = await readApiError(response, "به‌روزرسانی گروهی محتوا ناموفق بود");
      setError(detail);
      setBulkUpdating(false);
      showToast({ title: "عملیات گروهی ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    const result = (await response.json()) as { updated_count: number; skipped_post_ids: number[] };
    const skippedText = result.skipped_post_ids.length ? `، ${result.skipped_post_ids.length} مورد بدون تغییر باقی ماند` : "";
    setMessage(`${result.updated_count} پست به‌روزرسانی شد${skippedText}`);
    showToast({ title: "عملیات گروهی انجام شد", description: `${result.updated_count} پست به‌روزرسانی شد`, tone: "success" });
    setSelectedIds(new Set());
    setBulkUpdating(false);
    notifyNotificationsUpdated();
    await loadPosts(true);
  }

  async function changeStatus(post: Post, status: string) {
    setMessage("");
    setError("");
    const previousPosts = posts;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, status, scheduled_at: status === "cancelled" ? null : item.scheduled_at } : item));
    const response = await fetch(`${apiUrl}/posts/${post.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      setPosts(previousPosts);
      const detail = await readApiError(response, "تغییر وضعیت پست ناموفق بود");
      setError(detail);
      showToast({ title: "تغییر وضعیت ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    setMessage("وضعیت پست به‌روزرسانی شد");
    showToast({ title: "وضعیت پست به‌روزرسانی شد", description: post.title, tone: "success" });
    notifyNotificationsUpdated();
    await loadPosts(true);
  }

  async function retryPost(post: Post) {
    setMessage("");
    setError("");
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
      showToast({ title: "تلاش مجدد ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    setMessage("پست برای تلاش مجدد وارد صف انتشار شد");
    showToast({ title: "پست دوباره وارد صف شد", description: post.title, tone: "success" });
    notifyNotificationsUpdated();
    await loadPosts(true);
  }

  function clearFilters() {
    setActiveView("all");
    setActiveStatus("all");
    setSearch("");
    setCampaignFilter("all");
    setApprovalFilter("all");
    setSortMode("priority");
  }

  function selectPost(post: Post) {
    setSelectedPostId(post.id);
    setReviewNote(post.approval_note || "");
    setInspectorOpen(true);
  }

  function primaryMediaForPost(post: Post) {
    return (mediaByPostId.get(post.id) ?? [])[0] ?? null;
  }

  function previewUrlForPost(post: Post) {
    const asset = primaryMediaForPost(post);
    return asset ? mediaPreviewUrls[asset.id] ?? "" : "";
  }

  function canSubmitForReview(post: Post) {
    return ["draft", "ready", "failed", "cancelled"].includes(post.status) && post.approval_status !== "pending" && post.status !== "published";
  }

  function canReviewDecision(post: Post) {
    return post.approval_status === "pending";
  }

  async function reviewPost(post: Post, action: ReviewAction) {
    const actionTitle: Record<ReviewAction, string> = {
      "submit-review": "پست برای بازبینی ارسال شد",
      approve: "پست تایید شد",
      reject: "پست رد شد",
      "request-changes": "درخواست اصلاح ثبت شد"
    };

    setMessage("");
    setError("");
    setReviewingAction(action);
    const response = await fetch(`${apiUrl}/posts/${post.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ note: reviewNote })
    });

    if (!response.ok) {
      const detail = await readApiError(response, "عملیات بازبینی ناموفق بود");
      setError(detail);
      setReviewingAction(null);
      showToast({ title: "عملیات بازبینی ناموفق بود", description: detail, tone: "alert" });
      return;
    }

    const updated = (await response.json()) as Post;
    setPosts((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedPostId(updated.id);
    setReviewNote(updated.approval_note || "");
    setMessage(actionTitle[action]);
    setReviewingAction(null);
    notifyNotificationsUpdated();
    showToast({ title: actionTitle[action], description: updated.title, tone: action === "reject" || action === "request-changes" ? "warning" : "success" });
    await loadPosts(true);
  }

  return (
    <AuthGate>
      <AppShell>
        <NPage className="content-ops-page pb-5">
          <NPageHeader
            eyebrow="Content Ops"
            title="میز عملیات محتوا"
            description="یک نمای سبک برای بررسی، اولویت‌بندی و آماده‌سازی محتوای همه کانال‌ها بدون فیلترهای تکراری و پنل‌های همیشه باز."
            meta={(
              <>
                <NStatusPill tone="neutral">{draftCount} پیش‌نویس</NStatusPill>
                <NStatusPill tone="success">{publishedCount} منتشرشده</NStatusPill>
                <NStatusPill tone={failedCount ? "alert" : "success"}>{failedCount ? `${failedCount} نیازمند رسیدگی` : "بدون خطای فعال"}</NStatusPill>
                <NStatusPill tone="warning">{scheduledCount} زمان‌بندی‌شده</NStatusPill>
                {lastUpdatedAt ? <NStatusPill tone="neutral">به‌روزرسانی {lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</NStatusPill> : null}
              </>
            )}
            action={(
              <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => loadPosts(true)}>
                <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                به‌روزرسانی
              </Button>
            )}
          />

          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <NMetricTile
                key={metric.label}
                detail={metric.hint}
                icon={metric.icon}
                label={metric.label}
                tone={metric.tone}
                value={metric.value}
              />
            ))}
          </section>

          {message ? <NNotice tone="success" title="انجام شد">{message}</NNotice> : null}
          {error ? <NNotice tone="alert" title="نیاز به بررسی">{error}</NNotice> : null}

          <NSection
            title="نمای عملیاتی محتوا"
            description="نماهای ذخیره‌شده برای کار روزانه در اولویت هستند؛ فیلترهای جزئی فقط برای محدود کردن همان نما استفاده می‌شوند."
            bodyClassName="mt-3"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={toggleAllVisible}>
                    <CheckSquare2 className="ml-2 h-4 w-4" aria-hidden="true" />
                    {allVisibleSelected ? "لغو انتخاب نما" : "انتخاب همه نما"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>پاک کردن فیلتر</Button>
                </div>
              }
            >
              <NSavedViewToolbar
                views={savedViews}
                activeView={activeView}
                onViewChange={(value) => {
                  setActiveView(value as ContentSavedView);
                  setActiveStatus("all");
                }}
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="جست‌وجوی عنوان، کپشن، هشتگ، کمپین یا یادداشت"
                meta={(
                  <>
                    <NStatusPill tone="neutral">{filteredPosts.length} نتیجه</NStatusPill>
                    <NStatusPill tone="neutral">{posts.length} کل پست</NStatusPill>
                  </>
                )}
                filters={(
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={activeStatus} onChange={(event) => setActiveStatus(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      {workflowTabs.map((tab) => <option key={tab.value} value={tab.value}>{tab.label} · {statusCount(posts, tab.value)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      <option value="all">همه کمپین‌ها</option>
                      {campaignOptions.map((campaign) => <option key={campaign.value} value={campaign.value}>{campaign.label} · {campaign.count}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      {approvalTabs.map((tab) => <option key={tab.value} value={tab.value}>{tab.label}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-muted">
                    <ArrowDownUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-app-text outline-none">
                      <option value="priority">اولویت عملیاتی</option>
                      <option value="updated">آخرین تغییر</option>
                      <option value="schedule">زمان انتشار</option>
                      <option value="title">عنوان</option>
                    </select>
                  </label>
                </div>
                )}
              />

              {selectedIds.size ? (
                <div className="mt-4 flex flex-col justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-black text-app-text">{selectedIds.size} پست انتخاب شده است</p>
                    <p className="mt-1 text-xs leading-5 text-app-muted">عملیات گروهی فقط روی وضعیت‌های مجاز اجرا می‌شود و موارد ناسازگار بدون تغییر باقی می‌مانند.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={bulkUpdating} onClick={() => bulkChangeStatus("ready")}>
                      <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden="true" />
                      آماده‌سازی گروهی
                    </Button>
                    <Button type="button" variant="danger" size="sm" disabled={bulkUpdating} onClick={() => bulkChangeStatus("cancelled")}>
                      <XCircle className="ml-2 h-4 w-4" aria-hidden="true" />
                      لغو گروهی
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={bulkUpdating} onClick={() => setSelectedIds(new Set())}>پاک کردن انتخاب</Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 rounded-lg bg-app-surfaceMuted/50 p-2 shadow-inner sm:mt-4">
                {loading ? <LoadingRows /> : null}
                {!loading && filteredPosts.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                    title="هیچ پستی با این فیلتر پیدا نشد"
                    description="جست‌وجو یا وضعیت انتخاب‌شده را تغییر دهید."
                    action={<Button href="/compose">ایجاد پست جدید</Button>}
                  />
                ) : null}
                {!loading && filteredPosts.length > 0 ? (
                  <div className="grid gap-2.5">
                    {filteredPosts.map((post) => {
                      const selected = selectedPost?.id === post.id;
                      const previewUrl = previewUrlForPost(post);
                      const media = primaryMediaForPost(post);
                      const campaignKey = campaignKeyForPost(post);
                      return (
                        <ContentOperationCard
                          key={post.id}
                          action={(
                            <Button type="button" variant={selected ? "primary" : "secondary"} size="sm" onClick={() => selectPost(post)}>
                              بازبینی
                            </Button>
                          )}
                          approval={<ApprovalBadge status={post.approval_status} compact />}
                          campaignColor={campaignColorForPost(post, campaigns)}
                          campaignLabel={campaignKey !== "none" ? campaignLabelForPost(post, campaigns) : "بدون کمپین"}
                          caption={post.caption || "بدون کپشن"}
                          checked={selectedIds.has(post.id)}
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
                              <p className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                                {formatDateTime(post.scheduled_at)}
                              </p>
                              <p>تلاش انتشار: {post.attempt_count}</p>
                              <p>به‌روزرسانی: {formatDateTime(post.updated_at)}</p>
                            </>
                          )}
                          onCheckedChange={() => toggleSelected(post.id)}
                          onSelect={() => selectPost(post)}
                          platform={post.platform}
                          previewAlt={media?.original_filename ?? post.title}
                          previewUrl={previewUrl}
                          selected={selected}
                          title={post.title}
                        >
                          {post.hashtags ? <StatusToken tone="primary" className="max-w-full truncate">{post.hashtags}</StatusToken> : null}
                        </ContentOperationCard>
                      );
                    })}
                  </div>
                ) : null}
              </div>
          </NSection>

          <NInspectorDrawer
            open={Boolean(selectedPost && inspectorOpen)}
            side="left"
            title="بازبین پست"
            description="جزئیات، متن نهایی، گردش کار بازبینی و اقدام‌های انتشار."
            onClose={() => setInspectorOpen(false)}
            footer={selectedPost ? <ApprovalBadge status={selectedPost.approval_status} compact /> : null}
          >
            {selectedPost ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-md bg-slate-50 ring-1 ring-app-border">
                  {previewUrlForPost(selectedPost) ? (
                    <img src={previewUrlForPost(selectedPost)} alt={primaryMediaForPost(selectedPost)?.original_filename ?? selectedPost.title} className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-app-muted">
                      <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
                      رسانه‌ای برای این پست متصل نشده است
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedPost.status} />
                    <ChannelBadges platform={selectedPost.platform} compact />
                    <ApprovalBadge status={selectedPost.approval_status} />
                    <CountdownBadge status={selectedPost.status} scheduledAt={selectedPost.scheduled_at} />
                    {primaryMediaForPost(selectedPost) ? <StatusToken tone="success">رسانه آماده</StatusToken> : <StatusToken tone="warning">نیازمند رسانه</StatusToken>}
                  </div>
                  <h3 className="mt-3 text-lg font-black text-app-text">{selectedPost.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-app-muted">شناسه پست #{selectedPost.id}</p>
                </div>

                <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-app-border bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                  {postFinalText(selectedPost) || "متن نهایی برای این پست هنوز کامل نشده است."}
                </div>

                <DetailGrid
                  items={[
                    { label: "زمان‌بندی", value: formatDateTime(selectedPost.scheduled_at), hint: "زمان برنامه‌ریزی انتشار" },
                    { label: "کمپین", value: campaignLabelForPost(selectedPost, campaigns), hint: "برچسب عملیاتی محتوا" },
                    { label: "بازبینی", value: approvalConfig(selectedPost.approval_status).label, hint: approvalConfig(selectedPost.approval_status).description },
                    { label: "بازبین", value: selectedPost.reviewed_by || "ثبت نشده", hint: selectedPost.reviewed_at ? formatDateTime(selectedPost.reviewed_at) : "هنوز تصمیم نهایی ثبت نشده" },
                    { label: "تلاش انتشار", value: selectedPost.attempt_count, hint: "تعداد تلاش‌های ثبت‌شده" },
                    { label: "به‌روزرسانی", value: formatDateTime(selectedPost.updated_at), hint: "آخرین تغییر پست" }
                  ]}
                />

                <section className="rounded-md border border-app-border bg-app-surfaceMuted/70 p-3">
                  <div className="flex items-start gap-2">
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-app-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-black text-app-text">گردش کار بازبینی</p>
                      <p className="mt-1 text-xs leading-5 text-app-muted">{approvalConfig(selectedPost.approval_status).description}</p>
                    </div>
                  </div>
                  {selectedPost.submitted_at ? <p className="mt-3 text-xs text-app-muted">ارسال برای بازبینی: {formatDateTime(selectedPost.submitted_at)}</p> : null}
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    className="mt-3 min-h-20 w-full resize-y rounded-md border border-app-border bg-white px-3 py-2 text-sm leading-6 text-app-text outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    placeholder="یادداشت بازبین، دلیل رد یا اصلاح مورد نیاز..."
                  />
                  <div className="mt-3 grid gap-2">
                    {canSubmitForReview(selectedPost) ? (
                      <Button type="button" variant="secondary" disabled={Boolean(reviewingAction)} onClick={() => reviewPost(selectedPost, "submit-review")}>
                        <ShieldCheck className="ml-2 h-4 w-4" aria-hidden="true" />
                        {reviewingAction === "submit-review" ? "در حال ارسال" : "ارسال برای بازبینی"}
                      </Button>
                    ) : null}
                    {canReviewDecision(selectedPost) ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button type="button" size="sm" disabled={Boolean(reviewingAction)} onClick={() => reviewPost(selectedPost, "approve")}>
                          <ThumbsUp className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          تایید
                        </Button>
                        <Button type="button" variant="secondary" size="sm" disabled={Boolean(reviewingAction)} onClick={() => reviewPost(selectedPost, "request-changes")}>
                          <MessageSquareText className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          اصلاح
                        </Button>
                        <Button type="button" variant="danger" size="sm" disabled={Boolean(reviewingAction)} onClick={() => reviewPost(selectedPost, "reject")}>
                          <ThumbsDown className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          رد
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </section>

                {selectedPost.internal_note ? (
                  <div className="rounded-md border border-app-border bg-slate-50 p-3 text-xs leading-6 text-app-muted">
                    <p className="font-black text-app-text">یادداشت داخلی</p>
                    <p className="mt-1">{selectedPost.internal_note}</p>
                  </div>
                ) : null}

                {selectedPost.last_error ? (
                  <NNotice tone="alert" title="آخرین خطا">
                    {selectedPost.last_error}
                  </NNotice>
                ) : null}

                <div className="grid gap-2">
                  <Button href={`/compose?postId=${selectedPost.id}`} variant="secondary">
                    <Pencil className="ml-2 h-4 w-4" aria-hidden="true" />
                    ویرایش در کمپوزر
                  </Button>
                  {(selectedPost.status === "draft" || selectedPost.status === "failed" || selectedPost.status === "cancelled") ? (
                    <Button type="button" variant="secondary" onClick={() => changeStatus(selectedPost, "ready")}>
                      <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden="true" />
                      علامت‌گذاری به عنوان آماده
                    </Button>
                  ) : null}
                  {selectedPost.status === "failed" ? (
                    <Button type="button" onClick={() => retryPost(selectedPost)}>
                      <RotateCcw className="ml-2 h-4 w-4" aria-hidden="true" />
                      تلاش مجدد انتشار
                    </Button>
                  ) : null}
                  {selectedPost.status !== "cancelled" && selectedPost.status !== "published" ? (
                    <Button type="button" variant="ghost" onClick={() => changeStatus(selectedPost, "cancelled")}>
                      <XCircle className="ml-2 h-4 w-4" aria-hidden="true" />
                      لغو پست
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                title="پستی انتخاب نشده"
                description="برای مشاهده جزئیات، یک پست را از لیست انتخاب کنید."
              />
            )}
          </NInspectorDrawer>
        </NPage>
      </AppShell>
    </AuthGate>
  );
}
