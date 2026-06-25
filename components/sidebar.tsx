"use client";

import {
  BarChart3,
  BellRing,
  CalendarDays,
  ChevronLeft,
  FileText,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LucideIcon,
  Network,
  PenLine,
  Rocket,
  Settings2,
  Store,
  Target
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProductMark, WorkspaceAvatar } from "./brand-mark";
import { productName, productShortTagline } from "../lib/product";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

type SidebarProps = {
  storeName?: string;
  ready?: boolean;
  brandColor?: string;
  avatarUrl?: string;
};

const todayNavItem: NavItem = { label: "داشبورد", href: "/", icon: LayoutDashboard };
const composeNavItem: NavItem = { label: "ساخت", href: "/compose", icon: PenLine };
const onboardingNavItem: NavItem = { label: "راه‌اندازی", href: "/onboarding", icon: Rocket };
const plannerNavItem: NavItem = { label: "برنامه‌ریز", href: "/calendar", icon: CalendarDays };
const campaignsNavItem: NavItem = { label: "کمپین‌ها", href: "/campaigns", icon: Target };
const contentNavItem: NavItem = { label: "محتوا", href: "/content", icon: FileText };
const mediaNavItem: NavItem = { label: "رسانه", href: "/media", icon: GalleryHorizontalEnd };
const inboxNavItem: NavItem = { label: "پیام‌ها", href: "/inbox", icon: BellRing };
const reportsNavItem: NavItem = { label: "گزارش‌ها", href: "/analytics", icon: BarChart3 };
const channelsNavItem: NavItem = { label: "کانال‌ها", href: "/channels", icon: Network };
const settingsNavItem: NavItem = { label: "تنظیمات", href: "/store", icon: Store };

const primaryNavItems: NavItem[] = [
  todayNavItem,
  composeNavItem,
  plannerNavItem,
  campaignsNavItem,
  contentNavItem,
  mediaNavItem,
  inboxNavItem,
  reportsNavItem,
  channelsNavItem
];

const settingsNavItems: NavItem[] = [settingsNavItem];
const navGroups = [
  { title: "محصول", items: primaryNavItems },
  { title: "تنظیمات", items: settingsNavItems }
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.href === "/calendar") return isActiveRoute(pathname, "/calendar");
  if (item.href === "/campaigns") return isActiveRoute(pathname, "/campaigns");
  if (item.href === "/content") return isActiveRoute(pathname, "/content");
  if (item.href === "/queue") return isActiveRoute(pathname, "/queue");
  if (item.href === "/analytics") return isActiveRoute(pathname, "/analytics");
  if (item.href === "/logs") return isActiveRoute(pathname, "/logs");
  if (item.href === "/channels") return isActiveRoute(pathname, "/channels") || isActiveRoute(pathname, "/rubika") || isActiveRoute(pathname, "/instagram");
  if (item.href === "/store") return isActiveRoute(pathname, "/store");
  return isActiveRoute(pathname, item.href);
}

export function getActiveNav(pathname: string) {
  if (isActiveRoute(pathname, onboardingNavItem.href)) {
    return { group: { title: "شروع", items: [onboardingNavItem] }, item: onboardingNavItem };
  }

  if (isActiveRoute(pathname, composeNavItem.href)) {
    return { group: { title: "ساخت", items: [composeNavItem] }, item: composeNavItem };
  }

  if (isActiveRoute(pathname, "/calendar")) {
    return { group: { title: "برنامه‌ریز", items: [plannerNavItem] }, item: plannerNavItem };
  }

  if (isActiveRoute(pathname, "/campaigns")) {
    return { group: { title: "کمپین‌ها", items: [campaignsNavItem] }, item: campaignsNavItem };
  }

  if (isActiveRoute(pathname, "/content")) {
    return { group: { title: "محتوا", items: [contentNavItem] }, item: contentNavItem };
  }

  if (isActiveRoute(pathname, "/queue")) {
    return { group: { title: "برنامه‌ریز", items: [plannerNavItem] }, item: plannerNavItem };
  }

  if (isActiveRoute(pathname, "/analytics")) {
    return { group: { title: "گزارش‌ها", items: [reportsNavItem] }, item: reportsNavItem };
  }

  if (isActiveRoute(pathname, "/logs")) {
    return { group: { title: "گزارش‌ها", items: [reportsNavItem] }, item: reportsNavItem };
  }

  if (isActiveRoute(pathname, "/channels") || isActiveRoute(pathname, "/rubika") || isActiveRoute(pathname, "/instagram")) {
    return { group: { title: "کانال‌ها", items: [channelsNavItem] }, item: channelsNavItem };
  }

  if (isActiveRoute(pathname, "/store")) {
    return { group: { title: "تنظیمات", items: settingsNavItems }, item: settingsNavItem };
  }

  for (const group of navGroups) {
    const item = group.items.find((entry) => isActiveRoute(pathname, entry.href));
    if (item) return { group, item };
  }
  return { group: navGroups[0], item: todayNavItem };
}

function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`app-interactive group relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm ${
          active
            ? "nashrino-nav-active font-black"
            : "nashrino-nav-idle"
      }`}
    >
      {active ? <span className="absolute inset-y-2 right-0 w-0.5 rounded-l-full bg-app-primary" /> : null}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-app-primary" : "text-app-muted group-hover:text-app-primary"}`} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ storeName = "فضای کاری", ready = false, brandColor, avatarUrl }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="nashrino-sidebar hidden w-[238px] shrink-0 border-l border-app-border/80 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start lg:flex-col lg:overflow-hidden">
      <div className="shrink-0 border-b border-app-border/80 px-3 py-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <ProductMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-app-text">{productName}</p>
            <p className="mt-0.5 text-[10px] font-bold text-app-primary">{productShortTagline}</p>
          </div>
        </Link>

        <Link
          href="/store"
          className="app-interactive nashrino-card-muted mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2.5 hover:bg-white"
        >
          <WorkspaceAvatar name={storeName} size="sm" color={brandColor} imageUrl={avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold text-app-muted">فضای کاری فعال</span>
            <span className="mt-0.5 block truncate text-xs font-black text-app-text">{storeName}</span>
          </span>
          <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        </Link>

      </div>

      <nav className="flex-1 px-3 py-3" aria-label="ناوبری اصلی">
        <p className="mb-2 px-2.5 text-[10px] font-black text-app-muted">محصول</p>
        <div className="space-y-1">
          {primaryNavItems.map((item) => {
            const active = isNavItemActive(pathname, item);
            return <NavEntry key={item.href} item={item} active={active} />;
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-app-border/80 bg-white/45 p-3">
        <div className="mb-2 flex items-center justify-between px-2.5">
          <p className="text-[10px] font-black text-app-muted">فضای کاری</p>
          <Settings2 className="h-3.5 w-3.5 text-app-muted" aria-hidden="true" />
        </div>
        <div className="space-y-0.5">
          {settingsNavItems.map((item) => <NavEntry key={item.href} item={item} active={isNavItemActive(pathname, item)} />)}
        </div>
        {!ready ? (
          <Link href="/onboarding" className="app-interactive mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-700 shadow-hairline">
            <span className="app-status-pulse h-2 w-2 rounded-full bg-amber-500" />
            تکمیل راه‌اندازی
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

const mobileNavItems = [
  todayNavItem,
  plannerNavItem,
  composeNavItem,
  campaignsNavItem,
  contentNavItem
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-xl border border-app-border bg-app-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-lift backdrop-blur-xl lg:hidden" aria-label="ناوبری اصلی">
      {mobileNavItems.map((item) => {
        const active = isNavItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`app-interactive flex min-w-0 flex-col items-center gap-1 text-[10px] font-bold ${
              active ? "-mt-5 text-app-primary" : "text-app-muted"
            }`}
          >
            <span className={`flex items-center justify-center rounded-md ${
              active
                ? "h-11 w-11 bg-app-primary text-white shadow-accent"
                : "h-7 w-9 text-app-muted"
            }`}>
              <Icon className={active ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

