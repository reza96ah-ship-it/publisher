"use client";

import { useState } from "react";
import {
  ArrowUpLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileText,
  Filter,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Wand2
} from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import {
  NButton,
  NEmptyState,
  NField,
  NIconButton,
  NInput,
  NNotice,
  NPage,
  NPageHeader,
  NRow,
  NSection,
  NSelect,
  NSurface,
  NStatusPill,
  NTag,
  NTabs,
  NTextarea
} from "../../components/nahrino-ui";

const tabs = [
  { label: "همه", value: "all", count: 24 },
  { label: "آماده انتشار", value: "ready", count: 8 },
  { label: "نیازمند رسیدگی", value: "attention", count: 3 },
  { label: "منتشر شده", value: "published", count: 13 }
];

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <AuthGate>
      <AppShell>
        <NPage>
          <NPageHeader
            eyebrow="V-2 Core Components"
            title="سیستم طراحی نشرینو"
            description="مرجع اجرایی برای بازسازی صفحات؛ هر صفحه جدید باید از همین دکمه‌ها، فرم‌ها، ردیف‌ها، تب‌ها و سطح‌ها ساخته شود."
            meta={<NStatusPill tone="success">توکن‌محور</NStatusPill>}
            action={<NButton href="/compose" icon={Plus}>ساخت پست</NButton>}
          />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <NSection title="اقدام‌ها" description="دکمه‌ها باید اندازه ثابت، فوکوس واضح، حالت غیرفعال و حالت بارگذاری داشته باشند.">
                <div className="flex flex-wrap items-center gap-2">
                  <NButton icon={Plus}>اقدام اصلی</NButton>
                  <NButton variant="secondary" icon={Filter}>فیلتر</NButton>
                  <NButton variant="quiet" trailingIcon={ArrowUpLeft}>مشاهده جزئیات</NButton>
                  <NButton variant="danger">حذف</NButton>
                  <NButton loading>در حال ذخیره</NButton>
                  <NIconButton label="جست‌وجو" icon={Search} />
                  <NIconButton label="اعلان‌ها" icon={BellRing} badge="2" />
                </div>
              </NSection>

              <NSection title="فرم‌ها" description="فرم‌ها باید کم‌ارتفاع، خوانا و مناسب لمس موبایل باشند.">
                <div className="grid gap-3 lg:grid-cols-3">
                  <NField label="عنوان محتوا" hint="حداکثر ۸۰ کاراکتر برای کارت‌های فهرست." required>
                    <NInput icon={FileText} placeholder="مثلا معرفی محصول جدید" />
                  </NField>
                  <NField label="وضعیت انتشار">
                    <NSelect defaultValue="ready">
                      <option value="draft">پیش‌نویس</option>
                      <option value="ready">آماده انتشار</option>
                      <option value="scheduled">زمان‌بندی شده</option>
                    </NSelect>
                  </NField>
                  <NField label="کلید جست‌وجو" error="این مقدار در نمای عمومی تکراری است.">
                    <NInput state="error" icon={Search} placeholder="نام کمپین یا محصول" />
                  </NField>
                </div>
                <div className="mt-3">
                  <NField label="کپشن">
                    <NTextarea placeholder="متن پست را کوتاه، روشن و قابل اسکن بنویسید." />
                  </NField>
                </div>
              </NSection>

              <NSection title="تب‌ها و برچسب‌ها" description="فیلترهای تکراری باید به تب، برچسب و Saved View استاندارد تبدیل شوند.">
                <div className="space-y-3">
                  <NTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                  <div className="flex flex-wrap gap-2">
                    <NTag>خنثی</NTag>
                    <NTag tone="primary">کمپین</NTag>
                    <NTag tone="success">آماده</NTag>
                    <NTag tone="warning">بازبینی</NTag>
                    <NTag tone="alert">خطا</NTag>
                    <NTag tone="info" onRemove={() => undefined}>کانال</NTag>
                  </div>
                </div>
              </NSection>

              <NSection title="ردیف‌های داده" description="محتوا، صف، لاگ و کمپین باید از یک زبان ردیف و اکشن استفاده کنند.">
                <div className="space-y-2">
                  <NRow
                    title="پست معرفی محصول"
                    detail="روبیکا و اینستاگرام · امروز ۱۸:۳۰"
                    icon={CalendarClock}
                    meta={<NStatusPill tone="success">آماده</NStatusPill>}
                    action={<NButton variant="secondary" size="sm">بازبینی</NButton>}
                    selected
                  />
                  <NRow
                    title="کمپین فروش تابستان"
                    detail="۳ محتوا در برنامه · یک هشدار زمان‌بندی"
                    icon={Sparkles}
                    tone="warning"
                    meta={<NStatusPill tone="warning">نیازمند بررسی</NStatusPill>}
                    action={<NIconButton label="تنظیمات" icon={Settings2} size="sm" />}
                  />
                  <NEmptyState title="ردیفی برای این نما نیست" detail="با تغییر فیلتر یا ساخت محتوا، این بخش پر می‌شود." icon={CheckCircle2} />
                </div>
              </NSection>
            </div>

            <aside className="space-y-3 xl:self-start">
              <NSurface variant="raised" padding="lg">
                <div className="flex items-start gap-3">
                  <span className="nahrino-token-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
                    <Wand2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-app-text">قانون V-2</h2>
                    <p className="mt-2 text-sm leading-7 text-app-muted">قبل از بازسازی هر صفحه، اول باید قطعه مشترک آن در این سیستم وجود داشته باشد.</p>
                  </div>
                </div>
              </NSurface>

              <NSurface variant="tonal">
                <div className="space-y-2">
                  <p className="text-sm font-black text-app-text">حالت‌های پایه</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NStatusPill tone="neutral">پیش‌فرض</NStatusPill>
                    <NStatusPill tone="primary">فعال</NStatusPill>
                    <NStatusPill tone="success">موفق</NStatusPill>
                    <NStatusPill tone="warning">هشدار</NStatusPill>
                    <NStatusPill tone="alert">خطا</NStatusPill>
                    <NStatusPill tone="info">اطلاع</NStatusPill>
                  </div>
                </div>
              </NSurface>

              <NNotice tone="info" title="پایه حرفه‌ای">
                این صفحه از V-2 به بعد مرجع کنترل کیفیت بصری است؛ اگر صفحه‌ای ظاهر متفاوتی بسازد، باید به این primitives برگردد.
              </NNotice>
            </aside>
          </div>
        </NPage>
      </AppShell>
    </AuthGate>
  );
}
