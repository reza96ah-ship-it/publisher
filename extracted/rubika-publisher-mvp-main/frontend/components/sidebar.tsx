"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  badge?: string;
};

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "فضای کاری",
    items: [
      { label: "داشبورد", href: "/" },
      { label: "فضای محتوا", href: "/content" },
      { label: "تقویم انتشار", href: "/calendar" }
    ]
  },
  {
    title: "تولید محتوا",
    items: [
      { label: "ایجاد پست", href: "/compose" },
      { label: "مدیریت پست‌ها", href: "/posts" },
      { label: "کتابخانه رسانه", href: "/media" }
    ]
  },
  {
    title: "انتشار",
    items: [
      { label: "صف انتشار", href: "/queue" },
      { label: "اتصال روبیکا", href: "/rubika" },
      { label: "لاگ انتشار", href: "/logs" }
    ]
  },
  {
    title: "تعاملات",
    items: [{ label: "صندوق پیام‌ها", href: "/inbox", badge: "به‌زودی" }]
  },
  {
    title: "گزارش‌ها",
    items: [{ label: "تحلیل عملکرد", href: "/analytics", badge: "به‌زودی" }]
  },
  {
    title: "تنظیمات",
    items: [
      { label: "پروفایل فروشگاه", href: "/store" },
      { label: "تنظیمات سیستم", href: "/settings" },
      { label: "سیستم طراحی", href: "/design-system" }
    ]
  }
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-l border-app-border bg-app-surface lg:block">
      <div className="border-b border-app-border p-5">
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-4 ring-1 ring-violet-100">
          <p className="text-xs font-semibold text-app-primary">Rubika Workspace</p>
          <h2 className="mt-1 text-lg font-bold text-app-text">انتشار روبیکا</h2>
          <p className="mt-2 text-xs leading-6 text-app-muted">تولید، برنامه‌ریزی، انتشار و تحلیل محتوا</p>
        </div>
      </div>

      <nav className="space-y-6 p-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-semibold text-app-muted">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-violet-50 font-semibold text-app-primary ring-1 ring-violet-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-app-text"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
