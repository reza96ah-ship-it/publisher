"use client";import {
  AlertCircle,
  BellRing,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Network,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isRubikaConnected,
  isStoreConfigured,
  loadWorkspaceOverview,
  WorkspaceOverview,
  workspaceUpdatedEvent
} from "../lib/workspace";
import {
  loadKnownNotificationIds,
  loadOperationalNotifications,
  notificationsUpdatedEvent,
  notifyLiveNotifications,
  saveKnownNotificationIds,
  unreadOperationalCount
} from "../lib/notifications";
import { useMediaPreviewUrl } from "../lib/media-preview";
import { CommandPalette } from "./command-palette";
import { ProductMark, WorkspaceAvatar } from "./brand-mark";
import { getActiveNav, MobileNav, Sidebar } from "./sidebar";
import { useToast } from "./toast-provider";
import { productName } from "../lib/product";export function AppShell({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const activeNav = getActiveNav(pathname);
  const ActiveNavIcon = activeNav.item.icon;
  const [overview, setOverview] = useState<WorkspaceOverview>({ store: null, rubika: null });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [liveNotificationsReady, setLiveNotificationsReady] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const knownNotificationIds = useRef<Set<string> | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);  useEffect(() => {
    function refreshOverview() {
      setOverviewLoading(true);
      loadWorkspaceOverview()
        .then(setOverview)
        .catch(() => setOverview({ store: null, rubika: null }))
        .finally(() => setOverviewLoading(false));
    }
    refreshOverview();
    window.addEventListener(workspaceUpdatedEvent, refreshOverview);
    return () => window.removeEventListener(workspaceUpdatedEvent, refreshOverview);
  }, []);

  const refreshNotifications = useCallback(async (announceNew = true) => {
    try {
      const data = await loadOperationalNotifications();
      const currentIds = new Set(data.notifications.map((item) => item.id));
      const knownIds = knownNotificationIds.current ?? loadKnownNotificationIds();
      const isFirstRefresh = knownNotificationIds.current === null && knownIds.size === 0;
      knownNotificationIds.current = currentIds;
      saveKnownNotificationIds(currentIds);
      setNotificationCount(unreadOperationalCount(data));
      setLiveNotificationsReady(true);
      notifyLiveNotifications(data);

      if (!isFirstRefresh && announceNew) {
        data.notifications
          .filter((item) => !knownIds.has(item.id))
          .slice(0, 2)
          .forEach((item) => {
            showToast({
              title: item.title,
              description: item.description,
              tone: item.severity === "critical" ? "alert" : item.severity === "warning" ? "warning" : "success",       
              actionHref: item.action_href,
              actionLabel: item.action_label
            });
          });
      }
    } catch {
      setNotificationCount(0);
      setLiveNotificationsReady(false);
    }
  }, [showToast]);

  useEffect(() => {
    function refreshWithAnnouncement() {
      void refreshNotifications();
    }
    function refreshWithoutAnnouncement() {
      void refreshNotifications(false);
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshNotifications();
    }

    void refreshNotifications(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNotifications();
    }, 15000);
    window.addEventListener(notificationsUpdatedEvent, refreshWithAnnouncement);
    window.addEventListener(workspaceUpdatedEvent, refreshWithoutAnnouncement);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(notificationsUpdatedEvent, refreshWithAnnouncement);
      window.removeEventListener(workspaceUpdatedEvent, refreshWithoutAnnouncement);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    setAccountMenuOpen(false);
    setCommandPaletteOpen(false);
    scrollRootRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    function handleCommandPalette(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleCommandPalette);
    return () => window.removeEventListener("keydown", handleCommandPalette);
  }, []);

  useEffect(() => {
    function handleTouchHaptic(event: PointerEvent) {
      if (event.pointerType === "mouse") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("button, a, [role='button']")) return;
      window.navigator.vibrate?.(8);
    }

    window.addEventListener("pointerup", handleTouchHaptic, { passive: true });
    return () => window.removeEventListener("pointerup", handleTouchHaptic);
  }, []);

  const storeReady = !overviewLoading && isStoreConfigured(overview.store);
  const rubikaReady = !overviewLoading && isRubikaConnected(overview.rubika);
  const shellReady = storeReady && rubikaReady;
  const showAttentionAction = !overviewLoading && !shellReady;
  const attentionHref = !storeReady ? "/onboarding" : "/channels";
  const attentionLabel = !storeReady ? "تکمیل راه‌اندازی" : "اتصال کانال";
  const brandAssetId = overview.store?.avatar_asset_id ?? overview.store?.logo_asset_id ?? null;
  const brandImageUrl = useMediaPreviewUrl(brandAssetId);
  const brandColor = overview.store?.brand_primary_color;
  const workspaceName = overview.store?.name || "پروفایل فروشگاه";

  function logout() {
    window.localStorage.removeItem("rubika_publisher_access");
    router.replace("/login");
  }

  return (
    <main className="app-workspace-bg h-[100dvh] overflow-hidden text-app-text">
      <div ref={scrollRootRef} data-app-scroll-root className="flex h-full min-h-0 overflow-y-auto overscroll-contain scroll-smooth">
        <Sidebar storeName={workspaceName} ready={shellReady} brandColor={brandColor} avatarUrl={brandImageUrl} />      
        <section className="nashrino-shell flex min-h-full min-w-0 flex-1 flex-col">
          <header className="nashrino-topbar sticky top-0 z-20 shrink-0">
            <div className="flex min-h-[58px] items-center justify-between gap-3 px-3 py-2 lg:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="lg:hidden" aria-label={productName}>
                  <ProductMark />
                </Link>
                <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-primary shadow-hairline lg:flex" style={brandColor ? { color: brandColor } : undefined}>       
                  <ActiveNavIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-app-muted">
                    <span>{activeNav.group.title}</span>
                    <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                    <span className="truncate text-app-primary">{activeNav.item.label}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-black text-app-text">{activeNav.item.label}</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  className="app-interactive hidden h-9 min-w-0 items-center gap-2 rounded-lg border border-app-border bg-app-surface/90 px-3 text-xs text-app-muted shadow-hairline hover:bg-app-surface hover:text-app-primary md:flex md:w-56 xl:w-72"
                  aria-label="باز کردن جست‌وجو و دسترسی سریع"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">جست‌وجوی پست، مسیر یا کمپین</span>
                  <span className="mr-auto hidden rounded border border-app-border bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 xl:inline">Ctrl K</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  className="app-interactive flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface/90 text-app-muted shadow-hairline hover:bg-app-surface hover:text-app-primary md:hidden"
                  aria-label="باز کردن جست‌وجو و دسترسی سریع"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </button>

                {showAttentionAction ? (
                  <Link
                    href={attentionHref}
                    className="app-interactive hidden h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-bold text-amber-800 shadow-hairline hover:bg-amber-100 lg:flex"
                  >
                    {!rubikaReady && storeReady ? <Network className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                    {attentionLabel}
                  </Link>
                ) : null}

                <Link
                  href="/inbox"
                  className="app-interactive relative flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface/90 text-app-muted shadow-hairline hover:bg-app-surface hover:text-app-coral"
                  aria-label={notificationCount ? `${notificationCount} اعلان عملیاتی خوانده‌نشده` : "صندوق عملیات انتشار"}
                >
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  <span className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ring-2 ring-white ${liveNotificationsReady ? "bg-emerald-500" : "bg-slate-300"}`} aria-label={liveNotificationsReady ? "اعلان زنده فعال" : "اعلان زنده در حال اتصال"} />
                  {notificationCount ? (
                    <span className="absolute -left-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  ) : null}
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="app-interactive flex h-9 items-center gap-2 rounded-lg border border-app-border bg-app-surface/90 px-2 text-xs font-bold text-app-muted shadow-hairline hover:bg-app-surface hover:text-app-primary"
                    aria-label="منوی حساب کاربری"
                    aria-expanded={accountMenuOpen}
                  >
                    <WorkspaceAvatar name={workspaceName} size="sm" color={brandColor} imageUrl={brandImageUrl} className="h-6 w-6 rounded" />
                    <span className="hidden xl:inline">{workspaceName}</span>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {accountMenuOpen ? (
                    <div className="app-popover app-studio-panel absolute left-0 top-11 w-64 overflow-hidden rounded-lg">
                      <div className="border-b border-app-border px-3 py-3">
                        <div className="flex items-center gap-2">
                          <WorkspaceAvatar name={workspaceName} color={brandColor} imageUrl={brandImageUrl} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-black text-app-text"><Sparkles className="h-3.5 w-3.5 text-app-teal" aria-hidden="true" />مدیر فضای کاری</p>
                            <p className="mt-1 truncate text-[11px] text-app-muted">{workspaceName}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-1.5">
                        <Link href="/store" className="app-interactive flex items-center gap-2 rounded px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-app-text">
                          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                          تنظیمات فضای کاری
                        </Link>
                        <Link href="/channels" className="app-interactive flex items-center gap-2 rounded px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-app-text">
                          <Network className="h-3.5 w-3.5" aria-hidden="true" />
                          مدیریت کانال‌ها
                        </Link>
                        <button
                          type="button"
                          onClick={logout}
                          className="app-interactive flex w-full items-center gap-2 rounded px-2.5 py-2 text-right text-xs font-bold text-rose-700 hover:bg-rose-50"
                        >
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          خروج از حساب
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
          <div className="app-enter relative px-3 py-3 pb-24 sm:px-4 lg:px-5 lg:py-4">{children}</div>
          <MobileNav />
          <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        </section>
      </div>
    </main>
  );
}

