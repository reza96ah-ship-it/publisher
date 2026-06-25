"use client";
import {
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
  const activeNav = getActiveNav(pathname || "");
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
    <main className="app-workspace-bg h-screen overflow-hidden text-app-text">
      <div ref={scrollRootRef} data-app-scroll-root className="flex h-full min-h-0 overflow-y-auto overscroll-contain scroll-smooth">
        <Sidebar storeName={workspaceName} ready={shellReady} brandColor={brandColor} avatarUrl={brandImageUrl} />      
        <section className="nahrino-shell flex min-h-full min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 shrink-0 bg-white/70 backdrop-blur-2xl border-b border-slate-200/60 supports-[backdrop-filter]:bg-white/40">
            <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="lg:hidden" aria-label={productName}>
                  <ProductMark />
                </Link>
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-app-primary/10 to-app-primary/5 text-app-primary shadow-sm ring-1 ring-app-primary/20 lg:flex" style={brandColor ? { color: brandColor } : undefined}>       
                  <ActiveNavIcon className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-slate-400">
                    <span>{activeNav.group.title}</span>
                    <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                    <span className="truncate text-app-primary">{activeNav.item.label}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[15px] font-black tracking-tight text-slate-900">{activeNav.item.label}</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  className="hidden h-[38px] min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/50 px-3.5 text-[13px] text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900 md:flex md:w-64 xl:w-80"
                  aria-label="باز کردن جست‌وجو و دسترسی سریع"
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate font-medium">جست‌وجوی پست، مسیر یا کمپین...</span>
                  <span className="mr-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 xl:inline shadow-sm">Ctrl K</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCommandPaletteOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50/50 text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900 md:hidden"
                  aria-label="باز کردن جست‌وجو و دسترسی سریع"
                >
                  <Search className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>

                {showAttentionAction ? (
                  <Link
                    href={attentionHref}
                    className="hidden h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[13px] font-bold text-amber-700 shadow-sm transition-all hover:bg-amber-100 lg:flex"
                  >
                    {!rubikaReady && storeReady ? <Network className="h-4 w-4" aria-hidden="true" /> : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
                    {attentionLabel}
                  </Link>
                ) : null}

                <Link
                  href="/inbox"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50/50 text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-app-primary"
                  aria-label={notificationCount ? `${notificationCount} اعلان عملیاتی خوانده‌نشده` : "صندوق عملیات انتشار"}
                >
                  <BellRing className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className={`absolute bottom-2 right-2 h-2 w-2 rounded-full ring-2 ring-white ${liveNotificationsReady ? "bg-emerald-500" : "bg-slate-300"}`} aria-label={liveNotificationsReady ? "اعلان زنده فعال" : "اعلان زنده در حال اتصال"} />
                  {notificationCount ? (
                    <span className="absolute -left-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  ) : null}
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((current) => !current)}
                    className="flex h-10 items-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50/50 px-2 text-[13px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
                    aria-label="منوی حساب کاربری"
                    aria-expanded={accountMenuOpen}
                  >
                    <WorkspaceAvatar name={workspaceName} size="sm" color={brandColor} imageUrl={brandImageUrl} className="h-7 w-7 rounded-lg ring-2 ring-white shadow-sm" />
                    <span className="hidden xl:inline pr-1">{workspaceName}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </button>

                  {accountMenuOpen ? (
                    <div className="absolute left-0 top-[48px] w-[280px] overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                      <div className="border-b border-slate-100 px-4 py-4 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <WorkspaceAvatar name={workspaceName} color={brandColor} imageUrl={brandImageUrl} className="h-10 w-10 ring-2 ring-white shadow-sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-[13px] font-black text-slate-900"><Sparkles className="h-3.5 w-3.5 text-app-primary" aria-hidden="true" />مدیر فضای کاری</p>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{workspaceName}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <Link href="/store" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                          <Settings2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          تنظیمات فضای کاری
                        </Link>
                        <Link href="/channels" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                          <Network className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          مدیریت کانال‌ها
                        </Link>
                        <div className="my-1 h-px bg-slate-100 mx-2" />
                        <button
                          type="button"
                          onClick={logout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-right text-[13px] font-bold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        >
                          <LogOut className="h-4 w-4 text-rose-500" aria-hidden="true" />
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
