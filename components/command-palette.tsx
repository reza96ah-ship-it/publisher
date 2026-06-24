"use client";

import { BarChart3, BellRing, CalendarDays, FileImage, FileText, Home, Megaphone, Network, PenLine, Rocket, Search, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiUrl, authHeaders, type Post } from "../lib/posts";
import { Skeleton } from "./loading-skeleton";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const primaryCommands = [
  { label: "داشبورد", detail: "اولویت امروز، ریسک‌ها، انتشار بعدی و پیام‌های مهم", href: "/", icon: Home },
  { label: "ساخت", detail: "نوشتن، طراحی رسانه، نسخه‌های کانالی و زمان‌بندی", href: "/compose", icon: PenLine },
  { label: "برنامه‌ریز", detail: "زمان‌بندی، نمای ماهانه و برنامه انتشار", href: "/calendar", icon: CalendarDays },
  { label: "کمپین‌ها", detail: "برنامه‌های بازاریابی، بازه‌ها و محتوای کمپین", href: "/campaigns", icon: Megaphone },
  { label: "محتوا", detail: "پست‌ها، پیش‌نویس‌ها، وضعیت‌ها و صف انتشار", href: "/content", icon: FileText },
  { label: "رسانه", detail: "کتابخانه تصاویر و ویرایشگر", href: "/media", icon: FileImage },
  { label: "پیام‌ها", detail: "هشدارها و پیام‌های عملیاتی", href: "/inbox", icon: BellRing },
  { label: "گزارش‌ها", detail: "روند عملکرد، سلامت انتشار و گزارش مدیریتی", href: "/analytics", icon: BarChart3 }
];

const secondaryCommands = [
  { label: "راه‌اندازی", detail: "مسیر موقت تکمیل برند، کانال، محتوا و زمان‌بندی", href: "/onboarding", icon: Rocket },
  { label: "کانال‌ها", detail: "اتصال‌ها و مدیریت شبکه‌های اجتماعی", href: "/channels", icon: Network },
  { label: "تنظیمات", detail: "پروفایل فضای کاری، برند و تنظیمات پایه", href: "/store", icon: Settings2 }
];

const commands = [...primaryCommands, ...secondaryCommands];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(true);
    fetch(`${apiUrl}/posts`, { headers: authHeaders() })
      .then((response) => response.ok ? response.json() : [])
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const normalizedQuery = query.trim().toLocaleLowerCase("fa");
  const filteredCommands = useMemo(() => {
    if (!normalizedQuery) return commands;
    return commands.filter((command) => `${command.label} ${command.detail}`.toLocaleLowerCase("fa").includes(normalizedQuery));
  }, [normalizedQuery]);
  const filteredPrimaryCommands = filteredCommands.filter((command) => primaryCommands.some((item) => item.href === command.href));
  const filteredSecondaryCommands = filteredCommands.filter((command) => secondaryCommands.some((item) => item.href === command.href));
  const filteredPosts = useMemo(() => {
    if (!normalizedQuery) return posts.slice(0, 5);
    return posts
      .filter((post) => `${post.title} ${post.caption} ${post.campaign}`.toLocaleLowerCase("fa").includes(normalizedQuery))
      .slice(0, 5);
  }, [normalizedQuery, posts]);

  if (!open) return null;

  function navigate(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/20 px-4 pt-[12vh] backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section className="app-popover app-studio-panel w-full max-w-2xl overflow-hidden rounded-lg shadow-2xl shadow-slate-900/15" role="dialog" aria-modal="true" aria-label="جست‌وجو و دسترسی سریع" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-app-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-app-primary" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="جست‌وجوی پست یا رفتن به یک بخش..."
          />
          <button type="button" onClick={onClose} className="app-interactive nahrino-control-radius flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="بستن جست‌وجو">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-2">
          {filteredPrimaryCommands.length ? (
            <div>
              <p className="px-2 py-1 text-[10px] font-black text-app-muted">مسیرهای محصول</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {filteredPrimaryCommands.map((command) => {
                  const Icon = command.icon;
                  return (
                    <button key={command.href} type="button" onClick={() => navigate(command.href)} className="app-interactive flex items-center gap-3 rounded-md px-2.5 py-2.5 text-right hover:bg-blue-50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app-soft text-app-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-app-text">{command.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-app-muted">{command.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {filteredSecondaryCommands.length ? (
            <div className="mt-2 border-t border-app-border pt-2">
              <p className="px-2 py-1 text-[10px] font-black text-app-muted">ابزارهای زمینه‌ای</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {filteredSecondaryCommands.map((command) => {
                  const Icon = command.icon;
                  return (
                    <button key={command.href} type="button" onClick={() => navigate(command.href)} className="app-interactive flex items-center gap-3 rounded-md px-2.5 py-2.5 text-right hover:bg-slate-50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app-surfaceMuted text-app-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-app-text">{command.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-app-muted">{command.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-2 border-t border-app-border pt-2">
            <p className="px-2 py-1 text-[10px] font-black text-app-muted">پست‌ها</p>
            {loading ? (
              <div className="grid gap-2 px-2 py-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : null}
            {!loading && filteredPosts.map((post) => (
              <button key={post.id} type="button" onClick={() => navigate(`/compose?postId=${post.id}`)} className="app-interactive flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-right hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black text-app-text">{post.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-app-muted">{post.caption || "بدون کپشن"}</span>
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{post.status}</span>
              </button>
            ))}
            {!loading && filteredPosts.length === 0 ? <p className="px-2 py-3 text-xs text-app-muted">پستی با این عبارت پیدا نشد.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
