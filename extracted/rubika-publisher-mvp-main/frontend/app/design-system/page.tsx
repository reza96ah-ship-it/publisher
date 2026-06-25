import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { FilterBar } from "../../components/filter-bar";
import { MediaCard } from "../../components/media-card";
import { PageHeader } from "../../components/page-header";
import { PostCard } from "../../components/post-card";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { SectionCard, SurfaceCard } from "../../components/ui/card";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Tag } from "../../components/ui/tag";

const statuses = ["draft", "ready", "scheduled", "publishing", "published", "failed", "cancelled"];

export default function DesignSystemPage() {
  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 2 — Professional Design System"
          title="پیش‌نمایش سیستم طراحی"
          description="مرجع داخلی برای بررسی کامپوننت‌های پایه، کارت‌ها، فرم‌ها، وضعیت‌ها و اجزای تکرارشونده فضای کاری."
        />

        <div className="grid gap-5">
          <SectionCard title="دکمه‌ها" description="حالت‌های اصلی دکمه برای عملیات‌های رایج.">
            <div className="flex flex-wrap gap-3">
              <Button>عملیات اصلی</Button>
              <Button variant="secondary">عملیات ثانویه</Button>
              <Button variant="ghost">دکمه ساده</Button>
              <Button variant="danger">حذف</Button>
              <Button href="/posts">لینک به ایجاد پست</Button>
            </div>
          </SectionCard>

          <SectionCard title="فرم‌ها" description="کنترل‌های فرم با چینش راست‌به‌چپ و وضعیت فوکوس یکسان.">
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="عنوان پست" required>
                <Input placeholder="مثلاً معرفی محصول جدید" />
              </Field>
              <Field label="وضعیت">
                <Select defaultValue="draft">
                  <option value="draft">پیش‌نویس</option>
                  <option value="scheduled">زمان‌بندی‌شده</option>
                </Select>
              </Field>
              <Field label="کپشن" hint="متن عمومی پست روبیکا">
                <Textarea placeholder="متن پست را وارد کنید..." />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="برچسب‌ها و وضعیت‌ها">
            <div className="flex flex-wrap gap-3">
              <Tag>خنثی</Tag>
              <Tag tone="primary">اصلی</Tag>
              <Tag tone="success">موفق</Tag>
              <Tag tone="warning">هشدار</Tag>
              <Tag tone="alert">خطا</Tag>
              <Tag tone="info">اطلاع</Tag>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {statuses.map((status) => <StatusBadge key={status} status={status} />)}
            </div>
          </SectionCard>

          <SectionCard title="فیلترها">
            <FilterBar
              searchPlaceholder="جست‌وجوی عنوان یا کپشن"
              statusOptions={[
                { label: "پیش‌نویس", value: "draft" },
                { label: "منتشرشده", value: "published" }
              ]}
              platformOptions={[{ label: "روبیکا", value: "rubika" }]}
            />
          </SectionCard>

          <SectionCard title="کارت‌ها">
            <div className="grid gap-4 lg:grid-cols-3">
              <SurfaceCard>
                <p className="text-sm font-medium text-app-muted">پست‌های امروز</p>
                <p className="mt-3 text-3xl font-bold text-app-text">۱۲</p>
                <p className="mt-3 text-xs leading-6 text-app-muted">نمونه کارت آماری برای داشبورد.</p>
              </SurfaceCard>
              <PostCard
                title="پست نمونه محصول"
                caption="این یک کارت نمونه برای بررسی فاصله‌ها، وضعیت و خوانایی متن فارسی است."
                status="scheduled"
                publishTime="امروز، ۱۸:۳۰"
                attempts="۰"
              />
              <MediaCard
                filename="sample-product-banner.webp"
                contentType="image/webp"
                sizeLabel="340 KB"
                linkedLabel="متصل"
              />
            </div>
          </SectionCard>
        </div>
      </AppShell>
    </AuthGate>
  );
}
