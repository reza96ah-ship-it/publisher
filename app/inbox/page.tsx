"use client";

import { AlertTriangle, BellRing, CheckCircle2, CircleAlert, Clock3, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { DataSearchField, FilterChip } from "../../components/data-view";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { DetailGrid, EmptyState, NoticeBanner, StatusToken, Timeline, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import {
  emptyOperationalNotifications,
  loadOperationalNotifications,
  loadReadNotificationIds,
  notificationsLiveEvent,
  OperationalNotification,
  OperationalNotifications,
  saveReadNotificationIds
} from "../../lib/notifications";
import { formatDateTime } from "../../lib/posts";

type InboxFilter = "all" | "action" | "unread" | "info";

const filters: Array<{ label: string; value: InboxFilter }> = [
  { label: "همه اعلان‌ها", value: "all" },
  { label: "نیازمند اقدام", value: "action" },
  { label: "خوانده‌نشده", value: "unread" },
  { label: "اطلاع‌رسانی", value: "info" }
];

const categoryLabels: Record<string, string> = {
  connection: "اتصال روبیکا",
  publishing: "انتشار",
  worker: "سلامت worker"
};

function severityTone(severity: string) {
  if (severity === "critical") return "alert" as const;
  if (severity === "warning") return "warning" as const;
  return "info" as const;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <CircleAlert className="h-4 w-4" aria-hidden="true" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
}

function searchText(notification: OperationalNotification) {
  return [notification.title, notification.description, notification.recovery_hint, notification.category, notification.post_id].join(" ").toLowerCase();
}

export default function InboxPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<OperationalNotifications>(emptyOperationalNotifications);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadInbox = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await loadOperationalNotifications();
      setData(result);
      setReadIds(loadReadNotificationIds());
      setSelectedId((current) => current ?? result.notifications[0]?.id ?? null);
      setLastUpdatedAt(new Date());
    } catch {
      setError("دریافت اعلان‌های عملیاتی ناموفق بود.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    function applyLiveNotifications(event: Event) {
      const result = (event as CustomEvent<OperationalNotifications>).detail;
      if (!result) return;
      setData(result);
      setReadIds(loadReadNotificationIds());
      setSelectedId((current) => current ?? result.notifications[0]?.id ?? null);
      setLastUpdatedAt(new Date());
    }
    window.addEventListener(notificationsLiveEvent, applyLiveNotifications);
    return () => window.removeEventListener(notificationsLiveEvent, applyLiveNotifications);
  }, []);

  const visibleNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.notifications
      .filter((item) => filter === "all"
        || (filter === "action" && item.action_required)
        || (filter === "unread" && !readIds.has(item.id))
        || (filter === "info" && !item.action_required))
      .filter((item) => !query || searchText(item).includes(query));
  }, [data.notifications, filter, readIds, searchTerm]);

  const selected = data.notifications.find((item) => item.id === selectedId) ?? visibleNotifications[0] ?? null;
  const unreadCount = data.notifications.filter((item) => !readIds.has(item.id)).length;
  const filterCount = (value: InboxFilter) => {
    if (value === "action") return data.summary.action_required;
    if (value === "unread") return unreadCount;
    if (value === "info") return data.summary.info;
    return data.summary.total;
  };

  function markRead(id: string) {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadNotificationIds(next);
  }

  function selectNotification(id: string) {
    setSelectedId(id);
    markRead(id);
  }

  function markAllRead() {
    const next = new Set(readIds);
    data.notifications.forEach((item) => next.add(item.id));
    setReadIds(next);
    saveReadNotificationIds(next);
    showToast({ title: "همه اعلان‌ها خوانده شدند", tone: "success" });
  }

  const summary = [
    { label: "نیازمند اقدام", detail: "برای ادامه کار بررسی شوند", count: data.summary.action_required, icon: CircleAlert, tone: data.summary.action_required ? "text-rose-700" : "text-slate-500" },
    { label: "خوانده‌نشده", detail: "هنوز بازبینی نشده‌اند", count: unreadCount, icon: BellRing, tone: unreadCount ? "text-app-primary" : "text-slate-500" },
    { label: "هشدار worker", detail: "انتشارهای طولانی", count: data.summary.warning, icon: Clock3, tone: data.summary.warning ? "text-amber-700" : "text-slate-500" },
    { label: "اطلاع‌رسانی", detail: "نتیجه‌های موفق اخیر", count: data.summary.info, icon: CheckCircle2, tone: "text-emerald-700" }
  ];

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage>
          <section className="app-studio-panel rounded-lg px-4 py-3">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">مرکز اعلان‌های عملیات</p>
                <h1 className="mt-1 text-xl font-black text-app-text">صندوق عملیات انتشار</h1>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-app-muted">خطاهای انتشار، سلامت worker، آمادگی اتصال و نتیجه‌های موفق اخیر را در یک مسیر قابل اقدام دنبال کنید.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusToken tone="success" className="gap-1.5">
                  <span className="app-status-pulse h-2 w-2 rounded-full bg-emerald-500" />
                  اعلان زنده
                </StatusToken>
                {lastUpdatedAt ? <StatusToken tone="neutral">به‌روزرسانی {lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</StatusToken> : null}
                <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => loadInbox(true)}>
                  <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  به‌روزرسانی
                </Button>
                {unreadCount ? <Button type="button" size="sm" onClick={markAllRead}>خواندن همه</Button> : null}
              </div>
            </div>
          </section>

          {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}

          <section className="grid overflow-hidden rounded-md border border-app-border bg-white sm:grid-cols-2 xl:grid-cols-4">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-w-0 items-start gap-3 border-b border-app-border p-3 sm:border-l sm:last:border-l-0 xl:border-b-0">
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
                </div>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <WorkspacePanel title="جریان اعلان‌ها" description="اعلان‌ها را باز کنید تا خوانده شوند و مسیر اقدام پیشنهادی را بررسی کنید." bodyClassName="p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <DataSearchField value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="جست‌وجوی عنوان، خطا، دسته یا شناسه پست" />
                <div className="flex flex-wrap gap-2">
                  {filters.map((item) => (
                    <FilterChip key={item.value} active={filter === item.value} count={filterCount(item.value)} onClick={() => setFilter(item.value)}>
                      {item.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-md border border-app-border bg-white">
                {loading ? <div className="p-5 text-sm text-app-muted">در حال دریافت اعلان‌ها...</div> : null}
                {!loading && visibleNotifications.length === 0 ? (
                  <div className="p-4">
                    <EmptyState icon={<Search className="h-5 w-5" aria-hidden="true" />} title="اعلانی برای این فیلتر وجود ندارد." description="فیلتر یا عبارت جست‌وجو را تغییر دهید." />
                  </div>
                ) : null}
                <div className="divide-y divide-app-border">
                  {visibleNotifications.map((notification) => {
                    const unread = !readIds.has(notification.id);
                    const active = selected?.id === notification.id;
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => selectNotification(notification.id)}
                        className={`app-row flex w-full items-start gap-3 px-4 py-4 text-right hover:bg-slate-50 ${active ? "bg-blue-50/60 ring-1 ring-inset ring-blue-100" : ""}`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${notification.severity === "critical" ? "border-rose-100 bg-rose-50 text-rose-700" : notification.severity === "warning" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
                          <SeverityIcon severity={notification.severity} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-app-text">{notification.title}</span>
                            {unread ? <span className="h-2 w-2 rounded-full bg-app-primary" aria-label="خوانده‌نشده" /> : null}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-6 text-app-muted">{notification.description}</span>
                          <span className="mt-2 block text-[11px] text-slate-400">{formatDateTime(notification.created_at)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </WorkspacePanel>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <WorkspacePanel title="بازبین اعلان" description="جزئیات، وضعیت خواندن و اقدام پیشنهادی اعلان انتخاب‌شده." bodyClassName="p-4">
                {selected ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusToken tone={severityTone(selected.severity)}>{selected.action_required ? "نیازمند اقدام" : "اطلاع‌رسانی"}</StatusToken>
                        <StatusToken tone="neutral">{categoryLabels[selected.category] ?? selected.category}</StatusToken>
                        <StatusToken tone={readIds.has(selected.id) ? "neutral" : "primary"}>{readIds.has(selected.id) ? "خوانده‌شده" : "خوانده‌نشده"}</StatusToken>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-app-text">{selected.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-app-muted">{selected.description}</p>
                    </div>
                    <DetailGrid items={[
                      { label: "زمان ثبت", value: formatDateTime(selected.created_at) },
                      { label: "دسته", value: categoryLabels[selected.category] ?? selected.category },
                      { label: "شناسه پست", value: selected.post_id ? `#${selected.post_id}` : "—" },
                      { label: "اولویت", value: selected.severity === "critical" ? "فوری" : selected.severity === "warning" ? "هشدار" : "اطلاع" }
                    ]} />
                    <div>
                      <p className="mb-3 text-xs font-black text-app-text">مسیر اعلان</p>
                      <Timeline items={[
                        {
                          title: "تشخیص سیگنال عملیاتی",
                          description: selected.description,
                          meta: formatDateTime(selected.created_at),
                          tone: severityTone(selected.severity)
                        },
                        {
                          title: readIds.has(selected.id) ? "بازبینی شده" : "در انتظار بازبینی",
                          description: readIds.has(selected.id) ? "این اعلان در فضای کاری باز شده است." : "اعلان هنوز توسط مدیر فضای کاری باز نشده است.",
                          tone: readIds.has(selected.id) ? "success" : "warning"
                        },
                        {
                          title: "اقدام پیشنهادی",
                          description: selected.recovery_hint,
                          tone: selected.action_required ? "primary" : "neutral"
                        }
                      ]} />
                    </div>
                    <NoticeBanner tone={selected.action_required ? "warning" : "info"} title="پیشنهاد بعدی">
                      {selected.recovery_hint}
                    </NoticeBanner>
                    <div className="grid gap-2">
                      {!readIds.has(selected.id) ? <Button type="button" variant="secondary" onClick={() => markRead(selected.id)}>علامت‌گذاری به‌عنوان خوانده‌شده</Button> : null}
                      <Button href={selected.action_href}>{selected.action_label}</Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={<BellRing className="h-5 w-5" aria-hidden="true" />} title="اعلانی انتخاب نشده است." description="یک اعلان را از فهرست باز کنید تا جزئیات و اقدام پیشنهادی نمایش داده شود." />
                )}
              </WorkspacePanel>
            </aside>
          </section>
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}
