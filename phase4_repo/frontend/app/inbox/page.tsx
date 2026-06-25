"use client";

import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { DataSearchField } from "../../components/data-view";
import { useToast } from "../../components/toast-provider";
import { Button, DataRow, DataTable, MetricTile, Panel } from "../../components/ui";
import { Tag } from "../../components/ui/tag";
import { DetailGrid, EmptyState, Timeline, WorkspacePage } from "../../components/workspace-ui";
import {
  emptyOperationalNotifications,
  loadOperationalNotifications,
  loadReadNotificationIds,
  notificationsLiveEvent,
  OperationalNotification,
  OperationalNotifications,
  saveReadNotificationIds
} from "../../lib/notifications";
import { formatDateTime, apiUrl } from "../../lib/posts";
import {
  loadAutomationEvents,
  updateConversationStatus,
  assignConversation,
  updateConversationNote,
  loadSavedReplies,
  createSavedReply,
  deleteSavedReply,
  InstagramAutomationEvent,
  SavedReply
} from "../../lib/automation";
import { toPersianDigits } from "../../lib/utils";

type InboxChannelFilter = "all" | "rubika" | "instagram";
type InboxTypeFilter = "all" | "operation" | "customer";
type InboxAssignmentFilter = "all" | "unassigned" | "assigned_to_me" | "assigned_to_others";
type InboxStatusFilter = "all" | "unread" | "action_required" | "operator_takeover" | "resolved";

interface UnifiedInboxItem {
  id: string; // "op-{id}" or "cust-{id}"
  rawId: string | number;
  type: "operation" | "customer";
  title: string;
  description: string;
  category: string;
  severity: "critical" | "warning" | "info" | "neutral";
  actionRequired: boolean;
  createdAt: string;
  channel: "rubika" | "instagram";
  assignedTo: string | null;
  status: string; // "unread", "read", "automated", "operator_takeover", "resolved"
  rawItem: OperationalNotification | InstagramAutomationEvent;
}

const categoryLabels: Record<string, string> = {
  connection: "اتصال روبیکا",
  publishing: "انتشار",
  worker: "سلامت worker",
  "Instagram Comment": "کامنت اینستاگرام"
};

function severityTone(severity: string) {
  if (severity === "critical") return "alert" as const;
  if (severity === "warning") return "warning" as const;
  if (severity === "success") return "success" as const;
  return "info" as const;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <CircleAlert className="h-4 w-4" aria-hidden="true" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
}

export default function InboxPage() {
  const { showToast } = useToast();

  // Core Data States
  const [data, setData] = useState<OperationalNotifications>(emptyOperationalNotifications);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [automationEvents, setAutomationEvents] = useState<InstagramAutomationEvent[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [currentUser, setCurrentUser] = useState<{ email: string; full_name: string } | null>(null);

  // Layout & UI States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<InboxChannelFilter>("all");
  const [typeFilter, setTypeFilter] = useState<InboxTypeFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<InboxAssignmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>("all");

  // Operator Panel States
  const [searchReplyQuery, setSearchReplyQuery] = useState("");
  const [showAddReplyForm, setShowAddReplyForm] = useState(false);
  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyText, setNewReplyText] = useState("");
  const [copiedReplyId, setCopiedReplyId] = useState<number | null>(null);
  const [localNote, setLocalNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Fetch Session User Info
  useEffect(() => {
    async function fetchUser() {
      const token = window.localStorage.getItem("rubika_publisher_access");
      if (!token) return;
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const u = await response.json();
          setCurrentUser(u);
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
      }
    }
    fetchUser();
  }, []);

  // Fetch Saved Replies Catalog
  const loadRepliesData = useCallback(async () => {
    try {
      const replies = await loadSavedReplies();
      setSavedReplies(replies);
    } catch {
      console.error("Failed to load saved replies");
    }
  }, []);

  // Load Main Inbox Data (alerts, customer threads)
  const loadInbox = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const [result, events] = await Promise.all([
          loadOperationalNotifications(),
          loadAutomationEvents().catch(() => [])
        ]);
        setData(result);
        setReadIds(loadReadNotificationIds());
        setAutomationEvents(events);
        setLastUpdatedAt(new Date());
      } catch {
        setError("دریافت اطلاعات صندوق پیام‌ها ناموفق بود.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Initialize
  useEffect(() => {
    loadInbox();
    loadRepliesData();
  }, [loadInbox, loadRepliesData]);

  // Live Alerts WebSocket/SSE emulation listener
  useEffect(() => {
    function applyLiveNotifications(event: Event) {
      const result = (event as CustomEvent<OperationalNotifications>).detail;
      if (!result) return;
      setData(result);
      setReadIds(loadReadNotificationIds());
      setLastUpdatedAt(new Date());
    }
    window.addEventListener(notificationsLiveEvent, applyLiveNotifications);
    return () => window.removeEventListener(notificationsLiveEvent, applyLiveNotifications);
  }, []);

  // Map distinct feeds to a Unified Stream model
  const unifiedItems = useMemo<UnifiedInboxItem[]>(() => {
    const operations = data.notifications.map((n) => ({
      id: `op-${n.id}`,
      rawId: n.id,
      type: "operation" as const,
      title: n.title,
      description: n.description,
      category: n.category,
      severity: n.severity as "critical" | "warning" | "info" | "neutral",
      actionRequired: n.action_required,
      createdAt: n.created_at,
      channel: (n.category === "connection" ? "rubika" : "instagram") as "rubika" | "instagram",
      assignedTo: null,
      status: readIds.has(n.id) ? "read" : "unread",
      rawItem: n
    }));

    const customers = automationEvents.map((e) => ({
      id: `cust-${e.id}`,
      rawId: e.id,
      type: "customer" as const,
      title: `@${e.commenter_username}`,
      description: e.comment_text,
      category: "Instagram Comment",
      severity: (e.event_status === "failed" ? "critical" : "info") as "critical" | "info",
      actionRequired: e.conversation_status === "operator_takeover",
      createdAt: e.created_at,
      channel: "instagram" as const,
      assignedTo: e.assigned_to,
      status: e.conversation_status,
      rawItem: e
    }));

    return [...operations, ...customers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data.notifications, automationEvents, readIds]);

  // Apply Advanced Filtering and Searching
  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return unifiedItems.filter((item) => {
      // 1. Search Query
      if (query) {
        const textToMatch = `${item.title} ${item.description} ${item.category}`.toLowerCase();
        if (!textToMatch.includes(query)) return false;
      }

      // 2. Channel Filter
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;

      // 3. Type Filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // 4. Assignment Filter
      if (assignmentFilter !== "all") {
        if (assignmentFilter === "unassigned" && item.assignedTo !== null) return false;
        if (assignmentFilter === "assigned_to_me") {
          if (!item.assignedTo || item.assignedTo !== currentUser?.email) return false;
        }
        if (assignmentFilter === "assigned_to_others") {
          if (!item.assignedTo || item.assignedTo === currentUser?.email) return false;
        }
      }

      // 5. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "unread" && item.status !== "unread") return false;
        if (statusFilter === "action_required" && !item.actionRequired) return false;
        if (statusFilter === "operator_takeover" && item.status !== "operator_takeover") return false;
        if (statusFilter === "resolved" && item.status !== "resolved") return false;
      }

      return true;
    });
  }, [unifiedItems, searchTerm, channelFilter, typeFilter, assignmentFilter, statusFilter, currentUser]);

  // Derived Selected Item
  const selectedItem = useMemo(() => {
    if (selectedItemId) {
      const found = unifiedItems.find((item) => item.id === selectedItemId);
      if (found) return found;
    }
    return visibleItems[0] || null;
  }, [selectedItemId, visibleItems, unifiedItems]);

  // Initialize internal note when selection changes
  useEffect(() => {
    if (selectedItem?.type === "customer") {
      const event = selectedItem.rawItem as InstagramAutomationEvent;
      setLocalNote(event.internal_note || "");
      setNoteSaved(false);
    }
  }, [selectedItem]);

  // Operations Mark Read Helpers
  function markRead(id: string) {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadNotificationIds(next);
  }

  function markAllRead() {
    const next = new Set(readIds);
    data.notifications.forEach((item) => next.add(item.id));
    setReadIds(next);
    saveReadNotificationIds(next);
    showToast({ title: "همه اعلان‌های سیستمی خوانده شدند", tone: "success" });
  }

  // Operator Actions - Status Switcher Takeover
  async function handleOperatorTakeover(eventId: number, status: "operator_takeover" | "resolved") {
    try {
      const updated = await updateConversationStatus(eventId, status, status === "operator_takeover" ? 24 : 0);
      setAutomationEvents((current) => current.map((e) => (e.id === eventId ? updated : e)));
      showToast({
        title: status === "operator_takeover" ? "ربات پاسخ‌گو متوقف و ارجاع به اپراتور ثبت شد" : "گفتگو به ربات اتوماسیون بازگردانده شد",
        tone: "success"
      });
    } catch {
      showToast({ title: "خطا در به‌روزرسانی وضعیت گفتگو", tone: "alert" });
    }
  }

  // Operator Actions - Assignment Selection
  async function handleAssignOperator(eventId: number, operatorEmail: string | null) {
    try {
      const updated = await assignConversation(eventId, operatorEmail);
      setAutomationEvents((current) => current.map((e) => (e.id === eventId ? updated : e)));
      showToast({ title: "متصدی گفتگو با موفقیت تغییر کرد", tone: "success" });
    } catch {
      showToast({ title: "خطا در انتساب گفتگو", tone: "alert" });
    }
  }

  // Operator Actions - Save Context Note
  async function handleSaveNote() {
    if (selectedItem?.type !== "customer") return;
    const event = selectedItem.rawItem as InstagramAutomationEvent;
    setIsSavingNote(true);
    setNoteSaved(false);
    try {
      const updated = await updateConversationNote(event.id, localNote.trim() || null);
      setAutomationEvents((current) => current.map((e) => (e.id === event.id ? updated : e)));
      setNoteSaved(true);
      showToast({ title: "یادداشت با موفقیت ذخیره شد", tone: "success" });
      setTimeout(() => setNoteSaved(false), 2000);
    } catch {
      showToast({ title: "خطا در ذخیره یادداشت", tone: "alert" });
    } finally {
      setIsSavingNote(false);
    }
  }

  // Operator Actions - Saved Replies Catalog CRUD
  async function handleCreateReply() {
    const title = newReplyTitle.trim();
    const text = newReplyText.trim();
    if (!title || !text) {
      showToast({ title: "عنوان و متن پاسخ الزامی است", tone: "warning" });
      return;
    }
    try {
      const newReply = await createSavedReply(title, text);
      setSavedReplies((current) => [newReply, ...current].sort((a, b) => a.title.localeCompare(b.title)));
      setNewReplyTitle("");
      setNewReplyText("");
      setShowAddReplyForm(false);
      showToast({ title: "پاسخ آماده ذخیره شد", tone: "success" });
    } catch {
      showToast({ title: "خطا در ثبت پاسخ آماده", tone: "alert" });
    }
  }

  async function handleDeleteReply(replyId: number) {
    if (!confirm("آیا از حذف این پاسخ آماده مطمئن هستید؟")) return;
    try {
      await deleteSavedReply(replyId);
      setSavedReplies((current) => current.filter((r) => r.id !== replyId));
      showToast({ title: "پاسخ آماده با موفقیت حذف شد", tone: "success" });
    } catch {
      showToast({ title: "خطا در حذف پاسخ آماده", tone: "alert" });
    }
  }

  const handleCopyReply = (text: string, replyId: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedReplyId(replyId);
    showToast({ title: "متن پاسخ در حافظه کپی شد", tone: "success" });
    setTimeout(() => setCopiedReplyId(null), 2000);
  };

  // Filter replies catalog in detail widget
  const filteredReplies = useMemo(() => {
    const query = searchReplyQuery.trim().toLowerCase();
    return savedReplies.filter(
      (reply) => !query || reply.title.toLowerCase().includes(query) || reply.content.toLowerCase().includes(query)
    );
  }, [savedReplies, searchReplyQuery]);

  // Metric calculation values
  const totalItemsCount = unifiedItems.length;
  const actionRequiredCount = unifiedItems.filter((item) => item.actionRequired).length;
  const activeTakeoversCount = unifiedItems.filter((item) => item.status === "operator_takeover").length;
  const savedRepliesCount = savedReplies.length;

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage>
          {/* Dashboard Header Panel */}
          <Panel variant="glass" className="mb-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">صندوق پیام متمرکز و پایش عملیات</p>
                <h1 className="mt-1 text-xl font-black text-app-text">صندوق هوشمند پرو</h1>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-app-muted">
                  جریان اعلان‌های سیستمی و پیام‌های شبکه‌های اجتماعی را در قالب یک میزکار مجهز پیگیری کنید.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="success" className="gap-1.5 px-3 py-1 font-bold">
                  <span className="app-status-pulse h-2 w-2 rounded-full bg-emerald-500" />
                  اتصال برخط
                </Tag>
                {lastUpdatedAt ? (
                  <Tag tone="neutral" className="font-outfit">
                    {toPersianDigits(
                      lastUpdatedAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
                    )}
                  </Tag>
                ) : null}
                <Button variant="secondary" size="sm" disabled={refreshing} onClick={() => loadInbox(true)}>
                  <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  به‌روزرسانی
                </Button>
                {data.notifications.filter((n) => !readIds.has(n.id)).length > 0 && (
                  <Button variant="secondary" size="sm" onClick={markAllRead}>
                    خواندن همه اعلان‌ها
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          {/* Metric Tiles Summary Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricTile
              label="کل موارد دریافتی"
              value={toPersianDigits(totalItemsCount)}
              icon={Inbox}
              variant="glass"
            />
            <MetricTile
              label="نیازمند اقدام فوری"
              value={toPersianDigits(actionRequiredCount)}
              icon={CircleAlert}
              variant="glass"
              className={actionRequiredCount > 0 ? "border-rose-500/40 shadow-rose-950/5" : ""}
            />
            <MetricTile
              label="در انتظار اپراتور"
              value={toPersianDigits(activeTakeoversCount)}
              icon={AlertTriangle}
              variant="glass"
              className={activeTakeoversCount > 0 ? "border-amber-500/40 shadow-amber-950/5" : ""}
            />
            <MetricTile
              label="پاسخ‌های آماده ثبت شده"
              value={toPersianDigits(savedRepliesCount)}
              icon={MessageSquare}
              variant="glass"
            />
          </section>

          {error ? (
            <Panel variant="solid" className="bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 p-4 mb-4 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </Panel>
          ) : null}

          {/* Main Three-Column Cockpit Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr_420px] gap-4 items-start">
            {/* COLUMN 1: Advanced Filters */}
            <Panel variant="muted" className="space-y-4 lg:sticky lg:top-20">
              <div className="flex items-center justify-between border-b border-app-border/40 pb-2">
                <h3 className="text-xs font-black text-app-text">فیلترهای پیشرفته</h3>
                <button
                  onClick={() => {
                    setChannelFilter("all");
                    setTypeFilter("all");
                    setAssignmentFilter("all");
                    setStatusFilter("all");
                    setSearchTerm("");
                  }}
                  className="text-[10px] text-app-primary hover:underline font-bold"
                >
                  حذف فیلترها
                </button>
              </div>

              {/* Channel Filter */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-app-muted">کانال ارتباطی</p>
                <div className="flex flex-col gap-1">
                  {(["all", "rubika", "instagram"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChannelFilter(ch)}
                      className={`text-right text-xs px-2.5 py-1.5 rounded transition font-bold ${
                        channelFilter === ch
                          ? "bg-app-primary text-white"
                          : "text-app-text hover:bg-app-surface/50"
                      }`}
                    >
                      {ch === "all" ? "همه کانال‌ها" : ch === "rubika" ? "روبیکا" : "اینستاگرام"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-app-muted">نوع پیام</p>
                <div className="flex flex-col gap-1">
                  {(["all", "operation", "customer"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`text-right text-xs px-2.5 py-1.5 rounded transition font-bold ${
                        typeFilter === t
                          ? "bg-app-primary text-white"
                          : "text-app-text hover:bg-app-surface/50"
                      }`}
                    >
                      {t === "all" ? "همه موارد" : t === "operation" ? "اعلان سیستمی" : "پیام مشتری"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment Filter */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-app-muted">وضعیت ارجاع</p>
                <div className="flex flex-col gap-1">
                  {(["all", "unassigned", "assigned_to_me", "assigned_to_others"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAssignmentFilter(a)}
                      className={`text-right text-xs px-2.5 py-1.5 rounded transition font-bold ${
                        assignmentFilter === a
                          ? "bg-app-primary text-white"
                          : "text-app-text hover:bg-app-surface/50"
                      }`}
                    >
                      {a === "all"
                        ? "همه انتساب‌ها"
                        : a === "unassigned"
                        ? "بدون متصدی"
                        : a === "assigned_to_me"
                        ? "منسوب به من"
                        : "منسوب به سایرین"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-app-muted">وضعیت گفتگو / اقدام</p>
                <div className="flex flex-col gap-1">
                  {(["all", "unread", "action_required", "operator_takeover", "resolved"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`text-right text-xs px-2.5 py-1.5 rounded transition font-bold ${
                        statusFilter === st
                          ? "bg-app-primary text-white"
                          : "text-app-text hover:bg-app-surface/50"
                      }`}
                    >
                      {st === "all"
                        ? "همه وضعیت‌ها"
                        : st === "unread"
                        ? "خوانده‌نشده"
                        : st === "action_required"
                        ? "نیازمند اقدام"
                        : st === "operator_takeover"
                        ? "درحال پیگیری اپراتور"
                        : "پاسخ‌داده‌شده (حل شده)"}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            {/* COLUMN 2: Master Message Stream */}
            <Panel variant="glass" className="space-y-3">
              <div className="border-b border-app-border/40 pb-2 flex items-center justify-between">
                <h2 className="text-sm font-black text-app-text flex items-center gap-1.5">
                  <Inbox className="h-4 w-4 text-app-primary" />
                  جریان متمرکز پیام‌ها و رویدادها
                </h2>
                <span className="text-[10px] bg-app-soft text-app-primary px-2 py-0.5 rounded font-bold font-outfit">
                  {toPersianDigits(visibleItems.length)} مورد فیلتر شده
                </span>
              </div>

              {/* Quick Search Field */}
              <DataSearchField
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="جست‌وجو در پیام‌ها، خطاها، شناسه پست یا نام کاربری..."
              />

              <div className="min-h-[500px]">
                {loading ? (
                  <div className="p-8 text-center text-xs text-app-muted flex flex-col items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-app-primary" />
                    در حال دریافت جریان پیام‌ها...
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={<Search className="h-6 w-6" aria-hidden="true" />}
                      title="پیامی یافت نشد"
                      description="جستجو یا گزینه‌های فیلتر پیشرفته را در پنل سمت راست تغییر دهید."
                    />
                  </div>
                ) : (
                  <DataTable className="space-y-1.5">
                    {visibleItems.map((item) => {
                      const active = selectedItem?.id === item.id;
                      const isUnread = item.type === "operation" && !readIds.has(item.rawId as string);

                      return (
                        <DataRow
                          key={item.id}
                          selectable
                          selected={active}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            if (item.type === "operation") {
                              markRead(item.rawId as string);
                            }
                          }}
                          className={`hover:bg-app-surface/60 border border-app-border/40 transition-all ${
                            active
                              ? "bg-app-soft/40 border-app-primary ring-1 ring-inset ring-app-primary/10"
                              : "bg-app-surface/30"
                          }`}
                        >
                          <div className="flex w-full items-start gap-3 text-right">
                            {/* Icon indicator */}
                            <span
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                                item.type === "operation"
                                  ? item.severity === "critical"
                                    ? "border-rose-200/50 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : item.severity === "warning"
                                    ? "border-amber-200/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "border-emerald-200/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-blue-200/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {item.type === "operation" ? (
                                <SeverityIcon severity={item.severity} />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                            </span>

                            {/* Content info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-xs text-app-text leading-tight">{item.title}</span>
                                {isUnread && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-app-primary animate-pulse" />
                                )}
                                <span className="mr-auto text-[10px] text-app-muted font-outfit">
                                  {toPersianDigits(formatDateTime(item.createdAt))}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-app-muted line-clamp-2 leading-relaxed font-medium">
                                {item.description}
                              </p>

                              {/* Badges footer */}
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                <Tag tone={item.channel === "rubika" ? "primary" : "info"} className="text-[10px] px-1.5 py-0.5">
                                  {item.channel === "rubika" ? "روبیکا" : "اینستاگرام"}
                                </Tag>

                                <Tag tone="neutral" className="text-[10px] px-1.5 py-0.5">
                                  {categoryLabels[item.category] || item.category}
                                </Tag>

                                {item.type === "customer" && item.status === "operator_takeover" && (
                                  <Tag tone="warning" className="text-[10px] px-1.5 py-0.5">
                                    ارجاع به اپراتور
                                  </Tag>
                                )}

                                {item.type === "customer" && item.status === "resolved" && (
                                  <Tag tone="success" className="text-[10px] px-1.5 py-0.5">
                                    پاسخ‌داده‌شده
                                  </Tag>
                                )}

                                {item.type === "customer" && item.status === "automated" && (
                                  <Tag tone="neutral" className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    پاسخ خودکار ربات
                                  </Tag>
                                )}

                                {item.assignedTo && (
                                  <span className="text-[9px] text-app-primary font-bold mr-1 flex items-center gap-1 bg-app-primary/10 px-1.5 py-0.5 rounded border border-app-primary/20">
                                    <User className="h-2.5 w-2.5" />
                                    {item.assignedTo === currentUser?.email ? "من" : item.assignedTo}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </DataRow>
                      );
                    })}
                  </DataTable>
                )}
              </div>
            </Panel>

            {/* COLUMN 3: Detail View & Operator Workspace Console */}
            <aside className="lg:sticky lg:top-20">
              <Panel variant="glass" className="space-y-4">
                <div className="border-b border-app-border/40 pb-2">
                  <h3 className="text-xs font-black text-app-text">بازبین جزئیات و عملیات</h3>
                  <p className="text-[10px] text-app-muted mt-0.5">بررسی محتوا و ثبت اقدام متناسب</p>
                </div>

                {selectedItem ? (
                  selectedItem.type === "operation" ? (
                    // Operational Alert Details
                    (() => {
                      const notification = selectedItem.rawItem as OperationalNotification;
                      return (
                        <div className="space-y-4">
                          <div>
                            <div className="flex flex-wrap gap-1.5">
                              <Tag tone={severityTone(notification.severity)}>
                                {notification.action_required ? "نیازمند اقدام" : "اطلاع‌رسانی"}
                              </Tag>
                              <Tag tone="neutral">
                                {categoryLabels[notification.category] ?? notification.category}
                              </Tag>
                              <Tag tone={readIds.has(notification.id) ? "neutral" : "primary"}>
                                {readIds.has(notification.id) ? "خوانده‌شده" : "خوانده‌نشده"}
                              </Tag>
                            </div>
                            <h2 className="mt-3 text-sm font-black text-app-text leading-snug">
                              {notification.title}
                            </h2>
                            <p className="mt-2 text-xs leading-relaxed text-app-muted">
                              {notification.description}
                            </p>
                          </div>

                          <DetailGrid
                            items={[
                              { label: "زمان ثبت", value: toPersianDigits(formatDateTime(notification.created_at)) },
                              { label: "دسته", value: categoryLabels[notification.category] ?? notification.category },
                              {
                                label: "شناسه پست مرتبط",
                                value: notification.post_id ? `#${toPersianDigits(notification.post_id)}` : "—"
                              },
                              {
                                label: "اولویت",
                                value:
                                  notification.severity === "critical"
                                    ? "بحرانی / فوری"
                                    : notification.severity === "warning"
                                    ? "هشدار"
                                    : "اطلاعات"
                              }
                            ]}
                          />

                          <div className="space-y-2">
                            <p className="text-xs font-black text-app-text flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5 text-app-primary" />
                              تاریخچه رویداد سیستمی
                            </p>
                            <Timeline
                              items={[
                                {
                                  title: "تشخیص سیگنال خطا",
                                  description: notification.description,
                                  meta: toPersianDigits(formatDateTime(notification.created_at)),
                                  tone: severityTone(notification.severity)
                                },
                                {
                                  title: readIds.has(notification.id) ? "مشاهده شد" : "در انتظار بررسی",
                                  description: readIds.has(notification.id)
                                    ? "توسط اپراتور در این صفحه مشاهده شد."
                                    : "اعلان هنوز خوانده نشده است.",
                                  tone: readIds.has(notification.id) ? "success" : "warning"
                                },
                                {
                                  title: "مسیر رفع پیشنهادی",
                                  description: notification.recovery_hint,
                                  tone: notification.action_required ? "primary" : "neutral"
                                }
                              ]}
                            />
                          </div>

                          <div className="p-3 bg-blue-500/5 dark:bg-blue-950/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-app-text">
                            <strong className="block text-app-primary mb-1">توصیه رفع خطا:</strong>
                            {notification.recovery_hint}
                          </div>

                          <div className="flex flex-col gap-2 pt-2">
                            {!readIds.has(notification.id) && (
                              <Button variant="secondary" className="w-full text-xs font-bold" onClick={() => markRead(notification.id)}>
                                علامت‌گذاری به‌عنوان خوانده‌شده
                              </Button>
                            )}
                            <Button href={notification.action_href} className="w-full text-xs font-bold">
                              {notification.action_label}
                            </Button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    // Customer Social Message Details
                    (() => {
                      const event = selectedItem.rawItem as InstagramAutomationEvent;
                      return (
                        <div className="space-y-4">
                          {/* Thread status badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Tag tone={event.conversation_status === "operator_takeover" ? "warning" : "success"}>
                              {event.conversation_status === "operator_takeover"
                                ? "درحال پیگیری اپراتور"
                                : event.conversation_status === "resolved"
                                ? "پاسخ‌داده‌شده"
                                : "پاسخ خودکار فعال"}
                            </Tag>
                            <Tag tone="info">اینستاگرام</Tag>
                          </div>

                          {/* Profile detail */}
                          <div>
                            <h2 className="text-sm font-black text-app-text flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-app-soft text-[10px] text-app-primary font-bold">
                                IG
                              </span>
                              @{event.commenter_username}
                            </h2>
                          </div>

                          {/* Message speech bubble */}
                          <div className="bg-app-surface/50 border border-app-border/40 rounded-lg p-3 relative">
                            <p className="text-xs leading-relaxed text-app-text">{event.comment_text}</p>
                            <span className="block text-[9px] text-app-muted text-left mt-2 font-outfit">
                              {toPersianDigits(formatDateTime(event.created_at))}
                            </span>
                          </div>

                          {/* Automated status checks */}
                          {event.event_status === "failed" && (
                            <Panel variant="solid" className="bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40 p-3 text-xs leading-normal">
                              <strong className="block text-rose-700 dark:text-rose-400 mb-1">خطا در ارسال پاسخ اتوماتیک:</strong>
                              <p className="text-[11px] text-rose-600 dark:text-rose-300">{event.failure_reason || "درخواست API با شکست مواجه شد."}</p>
                            </Panel>
                          )}

                          {event.event_status === "sent" && (
                            <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              ارسال موفقیت‌آمیز پاسخ دایرکت اتوماتیک
                            </div>
                          )}

                          {/* Detail fields */}
                          <DetailGrid
                            items={[
                              { label: "زمان کامنت", value: toPersianDigits(formatDateTime(event.created_at)) },
                              {
                                label: "شناسه کامنت",
                                value: <span className="font-outfit text-[10px]">{event.ig_comment_id}</span>
                              },
                              {
                                label: "شناسه پست مرتبط",
                                value: event.post_id ? `#${toPersianDigits(event.post_id)}` : "—"
                              },
                              {
                                label: "وضعیت سیستم",
                                value:
                                  event.conversation_status === "automated"
                                    ? "اتوماسیون ربات"
                                    : event.conversation_status === "operator_takeover"
                                    ? "پشتیبانی دستی"
                                    : "بسته‌شده"
                              }
                            ]}
                          />

                          {/* OPERATOR ACTION PANEL WORKSPACE */}
                          <div className="space-y-4 border-t border-app-border/40 pt-4">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-app-primary" />
                              کنسول اقدامات اپراتور
                            </h4>

                            {/* 1. Bot Toggle Switcher */}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold text-app-muted">وضعیت اتوماسیون گفتگو</p>
                              {event.conversation_status === "automated" || event.conversation_status === "resolved" ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="w-full text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20 py-2 font-bold"
                                  onClick={() => handleOperatorTakeover(event.id, "operator_takeover")}
                                >
                                  توقف ربات و انتقال گفتگو به متصدی (۲۴ ساعت)
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  className="w-full text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 py-2 font-bold"
                                  onClick={() => handleOperatorTakeover(event.id, "resolved")}
                                >
                                  ثبت پاسخ و بازگشت به ربات خودکار
                                </Button>
                              )}
                            </div>

                            {/* 2. Operator Assignment Dropdown */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-app-muted block">انتساب متصدی</label>
                              <select
                                value={event.assigned_to || ""}
                                onChange={(e) => handleAssignOperator(event.id, e.target.value || null)}
                                className="w-full bg-app-surface border border-app-border text-xs px-2 py-1.5 rounded focus:outline-none focus:border-app-primary text-right font-bold text-app-text"
                                dir="rtl"
                              >
                                <option value="">بدون متصدی (ارجاع نشده)</option>
                                {currentUser && (
                                  <option value={currentUser.email}>
                                    {`من (${currentUser.full_name || currentUser.email})`}
                                  </option>
                                )}
                                <option value="sara@nashrino.com">سارا محمدی (پشتیبانی اینستاگرام)</option>
                                <option value="alireza@nashrino.com">علیرضا علوی (واحد فروش)</option>
                              </select>
                            </div>

                            {/* 3. Internal Notes Area */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-app-muted">یادداشت داخلی اپراتور</label>
                                {isSavingNote && <span className="text-[9px] text-app-primary animate-pulse font-bold">در حال ذخیره...</span>}
                                {noteSaved && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5"><Check className="h-2.5 w-2.5" />ذخیره شد</span>}
                              </div>
                              <div className="flex gap-1.5 items-end">
                                <textarea
                                  placeholder="نکات مربوط به این گفتگو را برای بقیه همکاران یادداشت کنید..."
                                  value={localNote}
                                  onChange={(e) => setLocalNote(e.target.value)}
                                  rows={2}
                                  className="flex-1 bg-app-surface border border-app-border text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-app-primary text-right font-medium text-app-text placeholder:text-app-muted/80"
                                  dir="rtl"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveNote}
                                  disabled={isSavingNote}
                                  className="bg-app-primary hover:bg-app-primary/90 text-white rounded p-2 disabled:opacity-50 transition shrink-0"
                                  title="ثبت یادداشت"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* 4. Template Saved Replies Manager Widget */}
                            <div className="pt-4 border-t border-app-border/40">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black text-app-text flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5 text-app-primary" />
                                  پاسخ‌های آماده پیش‌نویس
                                </h4>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setShowAddReplyForm(!showAddReplyForm)}
                                >
                                  {showAddReplyForm ? (
                                    "انصراف"
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Plus className="h-3 w-3" />
                                      جدید
                                    </span>
                                  )}
                                </Button>
                              </div>

                              {/* Form to Create New Saved Reply */}
                              {showAddReplyForm ? (
                                <div className="mb-3 p-3 bg-app-surfaceMuted/50 border border-app-border/30 rounded-lg space-y-2">
                                  <input
                                    type="text"
                                    placeholder="عنوان پاسخ آماده (مثال: آدرس شعبه)..."
                                    value={newReplyTitle}
                                    onChange={(e) => setNewReplyTitle(e.target.value)}
                                    className="w-full bg-app-surface border border-app-border text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-app-primary text-right font-bold text-app-text"
                                    dir="rtl"
                                  />
                                  <textarea
                                    placeholder="متن کامل پاسخ آماده..."
                                    value={newReplyText}
                                    onChange={(e) => setNewReplyText(e.target.value)}
                                    rows={2}
                                    className="w-full bg-app-surface border border-app-border text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-app-primary text-right text-app-text"
                                    dir="rtl"
                                  />
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-7 px-3 text-[10px] font-bold"
                                      onClick={handleCreateReply}
                                    >
                                      ثبت پاسخ
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              {/* Replies catalog listing and filter */}
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                <div className="relative mb-2">
                                  <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-app-muted" />
                                  <input
                                    type="text"
                                    placeholder="جست‌وجوی پاسخ آماده..."
                                    value={searchReplyQuery}
                                    onChange={(e) => setSearchReplyQuery(e.target.value)}
                                    className="w-full bg-app-surfaceMuted border border-app-border text-[11px] pr-8.5 pl-2.5 py-1.5 rounded focus:outline-none text-right font-medium text-app-text placeholder:text-app-muted/70"
                                    dir="rtl"
                                  />
                                </div>

                                {filteredReplies.length === 0 ? (
                                  <p className="text-[11px] text-app-muted text-center py-2 font-bold">
                                    پاسخ آماده‌ای یافت نشد.
                                  </p>
                                ) : (
                                  filteredReplies.map((reply) => {
                                    const isCopied = copiedReplyId === reply.id;
                                    return (
                                      <div
                                        key={reply.id}
                                        className="flex items-start justify-between gap-2 p-2 bg-app-surface/60 border border-app-border/30 rounded hover:bg-app-surface/90 transition-colors"
                                      >
                                        <div className="min-w-0 flex-1 text-right">
                                          <p className="text-[11px] font-black text-app-text truncate">
                                            {reply.title}
                                          </p>
                                          <p
                                            className="text-[10px] text-app-muted line-clamp-2 mt-0.5 font-medium leading-relaxed"
                                            title={reply.content}
                                          >
                                            {reply.content}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={() => handleCopyReply(reply.content, reply.id)}
                                            className={`p-1 rounded transition-colors ${
                                              isCopied
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                                : "hover:bg-app-soft text-app-muted hover:text-app-primary border border-transparent"
                                            }`}
                                            title="کپی کردن متن پاسخ"
                                          >
                                            {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                          </button>
                                          <button
                                            onClick={() => handleDeleteReply(reply.id)}
                                            className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-app-muted transition-colors border border-transparent"
                                            title="حذف پاسخ"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )
                ) : (
                  <EmptyState
                    icon={<BellRing className="h-6 w-6" aria-hidden="true" />}
                    title="موردی انتخاب نشده است"
                    description="یک اعلان سیستمی یا پیام مشتری را از لیست میانی انتخاب کنید تا جزئیات و ابزارهای مرتبط در اینجا نمایش داده شوند."
                  />
                )}
              </Panel>
            </aside>
          </div>
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

