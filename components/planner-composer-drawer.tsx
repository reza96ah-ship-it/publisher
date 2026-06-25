"use client";

import { CalendarCheck, FileText, Save, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatJalaliDate, formatJalaliTime } from "../lib/jalali";
import { getJalaliPickerParts, jalaliPickerPartsToIso } from "../lib/jalali-picker";
import { apiUrl, authHeaders } from "../lib/posts";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/form";
import { useToast } from "./toast-provider";
import { NoticeBanner, StatusToken } from "./workspace-ui";

type PlannerComposerDrawerProps = {
  scheduledAt: string | null;
  defaultCampaign?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

type QuickSaveAction = "draft" | "schedule";

const timezone = "Asia/Tehran";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function PlannerComposerDrawer({ scheduledAt, defaultCampaign = "", onClose, onCreated }: PlannerComposerDrawerProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [campaign, setCampaign] = useState("");
  const [schedule, setSchedule] = useState(scheduledAt ?? "");
  const [draftPostId, setDraftPostId] = useState<number | null>(null);
  const [savingAction, setSavingAction] = useState<QuickSaveAction | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle("");
    setCaption("");
    setHashtags("");
    setCampaign(defaultCampaign);
    setSchedule(scheduledAt ?? "");
    setDraftPostId(null);
    setSavingAction(null);
    setError("");
  }, [defaultCampaign, scheduledAt]);

  const scheduleParts = useMemo(() => getJalaliPickerParts(schedule || scheduledAt, timezone), [schedule, scheduledAt]);
  const hasTitle = Boolean(title.trim());
  const fullComposerHref = schedule ? `/compose?scheduledAt=${encodeURIComponent(schedule)}` : "/compose";

  function changeTime(field: "hour" | "minute", value: string) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const iso = jalaliPickerPartsToIso({ ...scheduleParts, [field]: parsed }, timezone);
    if (iso) setSchedule(iso);
  }

  async function save(action: QuickSaveAction) {
    if (!hasTitle) {
      setError("برای ذخیره سریع، عنوان داخلی پست را وارد کنید.");
      showToast({ title: "عنوان داخلی لازم است", description: "برای ذخیره سریع پست، یک عنوان وارد کنید.", tone: "warning" });
      return;
    }

    setSavingAction(action);
    setError("");

    try {
      const response = await fetch(draftPostId ? `${apiUrl}/posts/${draftPostId}` : `${apiUrl}/posts`, {
        method: draftPostId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          title: title.trim(),
          caption: caption.trim(),
          hashtags: hashtags.trim(),
          platform: "rubika",
          timezone,
          campaign: campaign.trim(),
          internal_note: "",
          scheduled_at: schedule || null
        })
      });

      if (!response.ok) throw new Error("ذخیره سریع پست ناموفق بود");
      const post = await response.json();
      setDraftPostId(post.id);

      if (action === "schedule") {
        const scheduleResponse = await fetch(`${apiUrl}/posts/${post.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ scheduled_at: schedule, timezone })
        });
        if (!scheduleResponse.ok) throw new Error("زمان‌بندی سریع پست ناموفق بود");
      }

      await onCreated();
      showToast({
        title: action === "schedule" ? "پست در پلنر زمان‌بندی شد" : "پیش‌نویس ذخیره شد",
        description: title.trim(),
        tone: "success"
      });
      onClose();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای ذخیره سریع پست";
      setError(nextError);
      showToast({ title: "ذخیره سریع ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setSavingAction(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("schedule");
  }

  if (!scheduledAt) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-600/25 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="ایجاد سریع پست">
      <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="بستن ایجاد سریع" />
      <aside className="flex h-full w-full max-w-[520px] flex-col border-r border-app-border bg-white shadow-2xl shadow-slate-500/20">
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-4">
          <div>
            <p className="text-[10px] font-black text-app-primary">ایجاد سریع از پلنر</p>
            <h2 className="mt-1 text-lg font-black text-app-text">پست جدید</h2>
            <p className="mt-1 text-xs leading-5 text-app-muted">{formatJalaliDate(schedule)} · {formatJalaliTime(schedule)} · Asia/Tehran</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-app-text" aria-label="بستن">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}

            <div className="flex flex-wrap gap-2">
              <StatusToken tone="primary">چندکاناله</StatusToken>
              <StatusToken tone="warning">ذخیره سریع</StatusToken>
              <StatusToken tone="neutral">پیش‌فرض ۰۹:۰۰</StatusToken>
              {defaultCampaign ? <StatusToken tone="info">کمپین: {defaultCampaign}</StatusToken> : null}
            </div>

            <Field label="عنوان داخلی پست" required hint="برای مدیریت صف و پیدا کردن سریع این پست.">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً معرفی محصول جدید" autoFocus required />
            </Field>

            <Field label="کپشن" hint="برای افزودن رسانه یا تنظیمات کامل‌تر، ویرایش پیشرفته را باز کنید.">
              <Textarea value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-40" placeholder="متن پست را بنویسید..." />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="هشتگ‌ها">
                <Textarea value={hashtags} onChange={(event) => setHashtags(event.target.value)} className="min-h-24" placeholder="#محصول #فروشگاه" />
              </Field>
              <Field label="کمپین">
                <Input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="مثلاً لانچ خرداد" />
              </Field>
            </div>

            <div className="rounded-md border border-app-border bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <p className="text-sm font-black text-app-text">زمان انتشار</p>
              </div>
              <p className="mt-1 text-xs text-app-muted">{formatJalaliDate(schedule)} · ساعت {formatJalaliTime(schedule)}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-app-muted">
                  ساعت
                  <select value={scheduleParts.hour} onChange={(event) => changeTime("hour", event.target.value)} className="mt-1.5 w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-text outline-none focus:border-app-primary">
                    {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{pad(hour)}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-app-muted">
                  دقیقه
                  <select value={scheduleParts.minute} onChange={(event) => changeTime("minute", event.target.value)} className="mt-1.5 w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-text outline-none focus:border-app-primary">
                    {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => <option key={minute} value={minute}>{pad(minute)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-app-border bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => void save("draft")} disabled={!hasTitle || Boolean(savingAction)}>
                <Save className="ml-2 h-4 w-4" aria-hidden="true" />
                {savingAction === "draft" ? "در حال ذخیره..." : "ذخیره پیش‌نویس"}
              </Button>
              <Button type="submit" disabled={!hasTitle || !schedule || Boolean(savingAction)}>
                <CalendarCheck className="ml-2 h-4 w-4" aria-hidden="true" />
                {savingAction === "schedule" ? "در حال زمان‌بندی..." : "زمان‌بندی سریع"}
              </Button>
            </div>
            <Button href={fullComposerHref} variant="ghost" className="mt-2 w-full">
              <FileText className="ml-2 h-4 w-4" aria-hidden="true" />
              باز کردن ویرایش پیشرفته
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

