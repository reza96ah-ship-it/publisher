"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock3, FileUp, ListChecks, MessageSquareText, RefreshCw, RotateCcw, Search, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { ChannelBadges } from "../../components/channel-badges";
import { DataRow, DataSearchField, DataTable, DataToolbar, FilterChip } from "../../components/data-view";
import { StatusBadge } from "../../components/status-badge";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { DetailGrid, EmptyState, NoticeBanner, StatusToken, Timeline, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { notifyNotificationsUpdated } from "../../lib/notifications";
import { apiUrl, authHeaders, formatDateTime, readApiError, recoveryGuidance } from "../../lib/posts";

type PublishAttempt = {
  id: number;
  post_id: number;
  post_title: string;
  post_platform: string;
  channel: string;
  action: string;
  status: string;
  request_payload: string;
  response_payload: string;
  error: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

type ParsedPayload = Record<string, unknown> | null;
type LogMode = "all" | "text" | "media" | "channel";
type TimelineStageState = "done" | "failed" | "active" | "pending";
type TimelineStage = {
  label: string;
  detail: string;
  state: TimelineStageState;
};

const modeFilters: Array<{ label: string; value: LogMode }> = [
  { label: "همه نوع‌ها", value: "all" },
  { label: "متنی", value: "text" },
  { label: "رسانه‌ای", value: "media" },
  { label: "اتصال کانال", value: "channel" }
];
const logsHeaderGrid = "grid-cols-[minmax(0,1.2fr)_160px_190px_130px]";
const logsRowGrid = "lg:grid-cols-[minmax(0,1.2fr)_160px_190px_130px]";

type PreparedAttempt = {
  attempt: PublishAttempt;
  requestPayload: ParsedPayload;
  responsePayload: ParsedPayload;
  mode: Exclude<LogMode, "all">;
  timeline: TimelineStage[];
};

function attemptTone(status: string) {
  if (status === "success") return "published";
  if (status === "reminder") return "manual_ready";
  if (status === "failed") return "failed";
  if (status === "started") return "publishing";
  return "draft";
}

function parsePayload(value: string): ParsedPayload {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function prettyPayload(value: string) {
  const parsed = parsePayload(value);
  if (parsed) return JSON.stringify(parsed, null, 2);
  if (!value) return "—";
  return value;
}

function payloadText(payload: ParsedPayload, key: string) {
  const value = payload?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function payloadNumber(payload: ParsedPayload, key: string) {
  const value = payload?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function attemptMode(requestPayload: ParsedPayload): Exclude<LogMode, "all"> {
  if (requestPayload?.mode === "placeholder") return "channel";
  if (requestPayload?.mode === "media" || requestPayload?.media_asset_id) return "media";
  return "text";
}

function formatBytes(value: number) {
  if (!value) return "—";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function finalStageState(status: string): TimelineStageState {
  if (status === "success") return "done";
  if (status === "failed") return "failed";
  if (status === "started") return "active";
  return "pending";
}

function buildTimeline(attempt: PublishAttempt, requestPayload: ParsedPayload, responsePayload: ParsedPayload): TimelineStage[] {
  const mode = attemptMode(requestPayload);
  const responseHas = (key: string) => Boolean(responsePayload?.[key]);
  const statusState = finalStageState(attempt.status);

  const stages: TimelineStage[] = [
    {
      label: "شروع تلاش",
      detail: `Worker این تلاش را در ${formatDateTime(attempt.started_at || attempt.created_at)} ثبت کرد.`,
      state: attempt.status === "started" ? "active" : "done"
    }
  ];

  if (mode === "media") {
    const filename = payloadText(requestPayload, "filename") || "رسانه پیوست‌شده";
    const contentType = payloadText(requestPayload, "content_type") || "نوع نامشخص";
    const sizeBytes = payloadNumber(requestPayload, "size_bytes");

    stages.push(
      {
        label: "انتخاب رسانه",
        detail: `${filename} · ${contentType} · ${formatBytes(sizeBytes)}`,
        state: "done"
      },
      {
        label: "درخواست آدرس آپلود",
        detail: responseHas("upload_request") ? "Rubika آدرس آپلود را برگرداند." : "در انتظار پاسخ requestSendFile یا ثبت خطا.",
        state: responseHas("upload_request") ? "done" : attempt.status === "failed" ? "pending" : "active"
      },
      {
        label: "آپلود فایل",
        detail: responseHas("upload") ? `فایل آپلود شد${payloadText(responsePayload, "file_id") ? ` · file_id: ${payloadText(responsePayload, "file_id")}` : ""}` : "آپلود هنوز در payload موفق ثبت نشده است.",
        state: responseHas("upload") ? "done" : attempt.status === "failed" ? "pending" : "active"
      },
      {
        label: "ارسال فایل",
        detail: responseHas("send") ? "sendFile با پاسخ موفق ثبت شد." : "ارسال نهایی فایل هنوز کامل نشده است.",
        state: responseHas("send") ? "done" : attempt.status === "failed" ? "pending" : "active"
      }
    );
  } else {
    const textLength = payloadText(requestPayload, "text").length;
    stages.push({
      label: "ارسال پیام متنی",
      detail: textLength ? `${textLength} کاراکتر برای Rubika آماده شد.` : "متن از کپشن، هشتگ یا عنوان پست ساخته شد.",
      state: attempt.status === "success" ? "done" : attempt.status === "failed" ? "failed" : "active"
    });
  }

  stages.push({
    label: "نتیجه نهایی",
    detail: attempt.status === "success"
      ? "پست منتشر شد و نتیجه در پایگاه داده ذخیره شد."
      : attempt.status === "failed"
        ? attempt.error || "انتشار ناموفق شد."
        : "تلاش هنوز پایان ثبت‌شده ندارد.",
    state: statusState
  });

  return stages;
}

function timelineTone(state: TimelineStageState): "neutral" | "primary" | "success" | "warning" | "alert" {
  if (state === "done") return "success";
  if (state === "failed") return "alert";
  if (state === "active") return "primary";
  return "neutral";
}

function actionLabel(action: string) {
  if (action === "scheduled") return "زمان‌بندی‌شده";
  if (action === "manual") return "دستی";
  if (action === "retry") return "تلاش مجدد";
  return action || "نامشخص";
}

function attemptSearchText(item: PreparedAttempt) {
  const request = prettyPayload(item.attempt.request_payload);
  const response = prettyPayload(item.attempt.response_payload);
  return [
    item.attempt.post_title,
    item.attempt.post_platform,
    item.attempt.channel,
    item.attempt.post_id,
    item.attempt.action,
    item.attempt.status,
    item.attempt.error,
    item.mode,
    payloadText(item.requestPayload, "filename"),
    payloadText(item.requestPayload, "text"),
    payloadText(item.responsePayload, "file_id"),
    request,
    response
  ].join(" ").toLowerCase();
}

function modeLabel(mode: Exclude<LogMode, "all">) {
  if (mode === "channel") return "اتصال کانال";
  return mode === "media" ? "رسانه‌ای" : "متنی";
}

export default function LogsPage() {
  const { showToast } = useToast();
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [status, setStatus] = useState("all");
  const [modeFilter, setModeFilter] = useState<LogMode>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingPostId, setRetryingPostId] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAttempts = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/publish-attempts`, { headers: authHeaders() });
      if (!response.ok) throw new Error("دریافت لاگ انتشار ناموفق بود");
      const data = (await response.json()) as PublishAttempt[];
      setAttempts(data);
      setSelectedAttemptId((current) => current ?? data[0]?.id ?? null);
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttempts().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت لاگ انتشار");
      setLoading(false);
    });
  }, [loadAttempts]);

  function applyStatus(nextStatus: string) {
    setStatus(nextStatus);
  }

  async function retryPost(postId: number, title: string) {
    setMessage("");
    setError("");
    setRetryingPostId(postId);
    const response = await fetch(`${apiUrl}/posts/${postId}/retry`, {
      method: "POST",
      headers: authHeaders()
    });
    if (!response.ok) {
      const detail = await readApiError(response, "تلاش مجدد انتشار ناموفق بود");
      setError(detail);
      setRetryingPostId(null);
      showToast({ title: "تلاش مجدد ناموفق بود", description: detail, tone: "alert" });
      return;
    }
    setMessage("پست دوباره وارد صف انتشار شد. تلاش جدید پس از اجرای worker در این فهرست نمایش داده می‌شود.");
    setRetryingPostId(null);
    showToast({ title: "پست دوباره وارد صف شد", description: title, tone: "success" });
    notifyNotificationsUpdated();
    await loadAttempts(true);
  }

  const preparedAttempts = useMemo<PreparedAttempt[]>(() => {
    return attempts.map((attempt) => {
      const requestPayload = parsePayload(attempt.request_payload);
      const responsePayload = parsePayload(attempt.response_payload);
      const mode = attemptMode(requestPayload);
      return {
        attempt,
        requestPayload,
        responsePayload,
        mode,
        timeline: buildTimeline(attempt, requestPayload, responsePayload)
      };
    });
  }, [attempts]);

  const visibleAttempts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return preparedAttempts
      .filter((item) => status === "all" || item.attempt.status === status)
      .filter((item) => modeFilter === "all" || item.mode === modeFilter)
      .filter((item) => !query || attemptSearchText(item).includes(query));
  }, [modeFilter, preparedAttempts, searchTerm, status]);

  const summary = useMemo(() => {
    return {
      total: preparedAttempts.length,
      started: preparedAttempts.filter((item) => item.attempt.status === "started").length,
      success: preparedAttempts.filter((item) => item.attempt.status === "success").length,
      failed: preparedAttempts.filter((item) => item.attempt.status === "failed").length,
      media: preparedAttempts.filter((item) => item.mode === "media").length
    };
  }, [preparedAttempts]);
  const selectedAttempt = useMemo(() => {
    if (selectedAttemptId) {
      return preparedAttempts.find((item) => item.attempt.id === selectedAttemptId) ?? visibleAttempts[0] ?? null;
    }
    return visibleAttempts[0] ?? preparedAttempts[0] ?? null;
  }, [preparedAttempts, selectedAttemptId, visibleAttempts]);
  const successRate = summary.total ? Math.round((summary.success / summary.total) * 100) : 0;
  const healthSummary = [
    { label: "همه تلاش‌ها", detail: "آخرین رکوردهای worker", value: "all", count: summary.total, icon: ListChecks, tone: "text-app-primary" },
    { label: "در حال اجرا", detail: "تلاش‌های پایان‌نیافته", value: "started", count: summary.started, icon: Clock3, tone: "text-sky-700" },
    { label: "موفق", detail: "انتشار کامل‌شده", value: "success", count: summary.success, icon: CheckCircle2, tone: "text-emerald-700" },
    { label: "ناموفق", detail: "نیازمند بررسی", value: "failed", count: summary.failed, icon: AlertTriangle, tone: summary.failed ? "text-rose-700" : "text-slate-500" }
  ];

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage>
          <nav className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface/70 px-1.5 py-1.5 shadow-hairline backdrop-blur-sm" aria-label="زیرمنوی گزارش‌ها">
            <Link href="/analytics" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold text-app-muted hover:bg-white hover:text-app-text hover:shadow-hairline transition">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              تحلیل عملکرد
            </Link>
            <Link href="/logs" className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-black bg-white text-app-primary shadow-hairline border border-app-border/80 transition">
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              سابقه انتشار
            </Link>
          </nav>

          <section className="app-studio-panel rounded-lg px-4 py-3">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">سلامت انتشار</p>
                <h1 className="mt-1 text-xl font-black text-app-text">پایش تلاش‌های انتشار</h1>
                <p className="mt-1 text-xs leading-5 text-app-muted">خطاها، مراحل ارسال و payloadهای فنی را در یک مسیر متمرکز بررسی کنید.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusToken tone={summary.failed ? "alert" : "success"}>{summary.failed ? `${summary.failed} خطای فعال` : "انتشار پایدار"}</StatusToken>
                <StatusToken tone="success">{successRate}% موفقیت</StatusToken>
                <StatusToken tone="neutral">{summary.media} رسانه‌ای</StatusToken>
                {lastUpdatedAt ? <StatusToken tone="neutral">به‌روزرسانی {lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</StatusToken> : null}
                <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => loadAttempts(true)}>
                  <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  به‌روزرسانی
                </Button>
              </div>
            </div>
          </section>

          <section className="grid overflow-hidden rounded-md border border-app-border bg-white sm:grid-cols-2 xl:grid-cols-4">
            {healthSummary.map((item) => {
              const Icon = item.icon;
              const active = status === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => applyStatus(item.value)}
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

          {error ? <NoticeBanner tone="alert" title="نیاز به بررسی">{error}</NoticeBanner> : null}
          {message ? <NoticeBanner tone="success">{message}</NoticeBanner> : null}

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <WorkspacePanel title="تلاش‌های انتشار" description="آخرین تلاش‌ها را اسکن کنید و جزئیات فنی را در بازرس کناری ببینید." bodyClassName="p-3 sm:p-4">
                <DataToolbar
                  meta={(
                    <>
                      <StatusToken tone="neutral">{visibleAttempts.length} نتیجه</StatusToken>
                      <StatusToken tone="neutral">{summary.total} کل تلاش</StatusToken>
                    </>
                  )}
                >
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <DataSearchField
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="جست‌وجوی عنوان، خطا، payload، file_id یا نوع تلاش"
                    />
                    <div className="flex flex-wrap gap-2">
                      {modeFilters.map((filter) => (
                        <FilterChip
                          key={filter.value}
                          active={modeFilter === filter.value}
                          count={filter.value === "all" ? preparedAttempts.length : preparedAttempts.filter((item) => item.mode === filter.value).length}
                          onClick={() => setModeFilter(filter.value)}
                        >
                          {filter.label}
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                </DataToolbar>
                <DataTable
                  columns={["تلاش", "وضعیت", "زمان", "عملیات"]}
                  gridClassName={logsHeaderGrid}
                  loading={loading}
                  empty={visibleAttempts.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={<Search className="h-5 w-5" aria-hidden="true" />}
                        title="برای این فیلتر لاگی ثبت نشده است"
                        description="فیلتر وضعیت، نوع تلاش یا عبارت جست‌وجو را تغییر دهید."
                      />
                    </div>
                  ) : null}
                >
                  {visibleAttempts.map(({ attempt, mode }) => {
                    const selected = selectedAttempt?.attempt.id === attempt.id;
                    return (
                      <DataRow key={attempt.id} gridClassName={logsRowGrid} selected={selected}>
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-black text-app-text sm:text-base">{attempt.post_title}</h2>
                          <p className="mt-1 text-xs text-app-muted">Post #{attempt.post_id} · Attempt #{attempt.id}</p>
                          {attempt.error ? <p className="mt-2 line-clamp-2 rounded bg-rose-50 p-2 text-xs leading-5 text-rose-700">{attempt.error}</p> : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:block lg:space-y-2">
                          <StatusBadge status={attemptTone(attempt.status)} />
                          <ChannelBadges platform={attempt.channel} compact />
                          <StatusToken tone={mode === "media" ? "primary" : "neutral"} className="gap-1">
                            {mode === "media" ? (
                              <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {modeLabel(mode)}
                          </StatusToken>
                          <StatusToken tone="neutral">{actionLabel(attempt.action)}</StatusToken>
                        </div>

                        <div className="text-xs leading-6 text-app-muted">
                          <p>شروع: {formatDateTime(attempt.started_at || attempt.created_at)}</p>
                          <p>پایان: {formatDateTime(attempt.finished_at)}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button type="button" variant={selected ? "primary" : "secondary"} size="sm" onClick={() => setSelectedAttemptId(attempt.id)}>بازبینی</Button>
                        </div>
                      </DataRow>
                    );
                  })}
                </DataTable>
              </WorkspacePanel>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
              <WorkspacePanel
                title="بازرس تلاش"
                description="Timeline، payload و مسیر بازیابی تلاش انتخاب‌شده."
                action={selectedAttempt ? <StatusBadge status={attemptTone(selectedAttempt.attempt.status)} /> : null}
                bodyClassName="max-h-[70vh] overflow-y-auto p-3 sm:p-4 lg:max-h-none"
              >
                {selectedAttempt ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={attemptTone(selectedAttempt.attempt.status)} />
                        <ChannelBadges platform={selectedAttempt.attempt.channel} compact />
                        <StatusToken tone={selectedAttempt.mode === "media" ? "primary" : "neutral"}>{modeLabel(selectedAttempt.mode)}</StatusToken>
                        <StatusToken tone="neutral">{actionLabel(selectedAttempt.attempt.action)}</StatusToken>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-app-text">{selectedAttempt.attempt.post_title}</h3>
                      <p className="mt-2 text-xs leading-6 text-app-muted">Post #{selectedAttempt.attempt.post_id} · Attempt #{selectedAttempt.attempt.id}</p>
                    </div>

                    <DetailGrid
                      items={[
                        { label: "شروع", value: formatDateTime(selectedAttempt.attempt.started_at || selectedAttempt.attempt.created_at), hint: "زمان ثبت تلاش" },
                        { label: "پایان", value: formatDateTime(selectedAttempt.attempt.finished_at), hint: "زمان پایان تلاش" },
                        { label: "نوع", value: modeLabel(selectedAttempt.mode), hint: "متنی یا رسانه‌ای" },
                        { label: "عملیات", value: actionLabel(selectedAttempt.attempt.action), hint: "منبع اجرای تلاش" }
                      ]}
                    />

                    <div>
                      <p className="mb-3 text-xs font-black text-app-text">مسیر اجرای worker</p>
                      <Timeline items={selectedAttempt.timeline.map((stage) => ({
                        title: stage.label,
                        description: stage.detail,
                        tone: timelineTone(stage.state)
                      }))} />
                    </div>

                    {selectedAttempt.mode === "media" ? (
                      <DetailGrid
                        items={[
                          { label: "رسانه", value: payloadText(selectedAttempt.requestPayload, "filename") || "—", hint: "نام فایل" },
                          { label: "نوع فایل", value: payloadText(selectedAttempt.requestPayload, "file_type") || payloadText(selectedAttempt.requestPayload, "content_type") || "—", hint: "فرمت ارسال" },
                          { label: "حجم", value: formatBytes(payloadNumber(selectedAttempt.requestPayload, "size_bytes")), hint: "اندازه فایل" },
                          { label: "file_id", value: payloadText(selectedAttempt.responsePayload, "file_id") || "—", hint: "شناسه کانال" }
                        ]}
                      />
                    ) : null}

                    {selectedAttempt.attempt.error ? (
                      <div className="space-y-3">
                        <NoticeBanner tone="alert" title="خطای ثبت‌شده">
                          {selectedAttempt.attempt.error}
                        </NoticeBanner>
                        <NoticeBanner tone="info" title="پیشنهاد بازیابی">
                          {recoveryGuidance(selectedAttempt.attempt.error)}
                        </NoticeBanner>
                      </div>
                    ) : null}

                    <details className="rounded-md border border-app-border bg-slate-50 p-3 text-xs text-app-muted">
                      <summary className="cursor-pointer font-black text-app-text">
                        <UploadCloud className="ml-1.5 inline h-4 w-4 align-middle" aria-hidden="true" />
                        Payload کامل
                      </summary>
                      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words leading-6">Request: {prettyPayload(selectedAttempt.attempt.request_payload)}{"\n\n"}Response: {prettyPayload(selectedAttempt.attempt.response_payload)}</pre>
                    </details>

                    <div className="grid gap-2">
                      {selectedAttempt.attempt.status === "failed" ? (
                        <Button
                          type="button"
                          disabled={retryingPostId === selectedAttempt.attempt.post_id}
                          onClick={() => retryPost(selectedAttempt.attempt.post_id, selectedAttempt.attempt.post_title)}
                        >
                          <RotateCcw className={`ml-2 h-4 w-4 ${retryingPostId === selectedAttempt.attempt.post_id ? "animate-spin" : ""}`} aria-hidden="true" />
                          {retryingPostId === selectedAttempt.attempt.post_id ? "در حال ورود به صف" : "تلاش مجدد انتشار"}
                        </Button>
                      ) : null}
                      <Button href={`/compose?postId=${selectedAttempt.attempt.post_id}`} variant="secondary">باز کردن پست</Button>
                      <Button href="/queue" variant="secondary">صف انتشار</Button>
                      <Button href="/channels" variant="secondary">بررسی مرکز کانال‌ها</Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
                    title="تلاشی انتخاب نشده"
                    description="برای مشاهده timeline و payload، یک تلاش را از لیست انتخاب کنید."
                  />
                )}
              </WorkspacePanel>

            </aside>
          </section>
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

