import { apiUrl, authHeaders, Post } from "./posts";

export const workspaceUpdatedEvent = "socialops-studio:workspace-updated";

export type StoreProfile = {
  id: number;
  name: string;
  category: string;
  phone: string;
  description: string;
  logo_asset_id: number | null;
  avatar_asset_id: number | null;
  brand_primary_color: string;
  brand_accent_color: string;
  brand_voice: string;
  default_cta: string;
  content_guidelines: string;
  default_hashtags: string;
  caption_footer: string;
  timezone: string;
  is_active: boolean;
};

export type RubikaSettings = {
  id: number;
  chat_id: string;
  bot_token_masked: string;
  bot_name: string;
  status: string;
  last_error: string;
  last_test_at: string | null;
  is_active: boolean;
};

export type WorkspaceOverview = {
  store: StoreProfile | null;
  rubika: RubikaSettings | null;
};

export type ReadinessStep = {
  key: "store" | "rubika" | "content" | "schedule";
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function isStoreConfigured(store?: StoreProfile | null) {
  return Boolean(store?.name?.trim());
}

export function notifyWorkspaceUpdated() {
  window.dispatchEvent(new Event(workspaceUpdatedEvent));
}

export function isRubikaConnected(rubika?: RubikaSettings | null) {
  return rubika?.status === "connected" && isRubikaTestFresh(rubika.last_test_at);
}

export function isRubikaTestFresh(value?: string | null) {
  if (!value) return false;
  const testedAt = new Date(value);
  if (Number.isNaN(testedAt.getTime())) return false;
  return testedAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

export function rubikaStatusLabel(rubika?: RubikaSettings | null) {
  if (!rubika) return "اتصال روبیکا تنظیم نشده";
  if (rubika.status === "connected" && isRubikaTestFresh(rubika.last_test_at)) return "روبیکا متصل است";
  if (rubika.status === "connected") return "تست اتصال روبیکا منقضی شده";
  if (rubika.status === "failed") return "اتصال روبیکا خطا دارد";
  if (rubika.bot_token_masked) return "تست اتصال روبیکا لازم است";
  return "اتصال روبیکا تنظیم نشده";
}

export function buildReadinessSteps(
  overview: WorkspaceOverview,
  posts: Post[] = []
): ReadinessStep[] {
  const hasContent = posts.length > 0;
  const hasScheduledOrPublished = posts.some((post) => ["scheduled", "publishing", "published"].includes(post.status));

  return [
    {
      key: "store",
      label: "پروفایل فروشگاه",
      description: "نام، دسته‌بندی و متن‌های پایه آماده است.",
      href: "/store",
      done: isStoreConfigured(overview.store)
    },
    {
      key: "rubika",
      label: "کانال‌های انتشار",
      description: "کانال اصلی انتشار تست شده و آماده است.",
      href: "/channels",
      done: isRubikaConnected(overview.rubika)
    },
    {
      key: "content",
      label: "ساخت محتوا",
      description: "حداقل یک پست یا پیش‌نویس در فضای کاری وجود دارد.",
      href: "/compose",
      done: hasContent
    },
    {
      key: "schedule",
      label: "زمان‌بندی انتشار",
      description: "حداقل یک پست وارد صف زمان‌بندی یا انتشار شده است.",
      href: "/calendar",
      done: hasScheduledOrPublished
    }
  ];
}

export function nextReadinessStep(steps: ReadinessStep[]) {
  return steps.find((step) => !step.done) ?? steps[steps.length - 1];
}

export async function loadWorkspaceOverview(): Promise<WorkspaceOverview> {
  const headers = authHeaders();
  const [storeResponse, rubikaResponse] = await Promise.all([
    fetch(`${apiUrl}/stores/active`, { headers }),
    fetch(`${apiUrl}/rubika/settings`, { headers })
  ]);

  return {
    store: storeResponse.ok ? await storeResponse.json() : null,
    rubika: rubikaResponse.ok ? await rubikaResponse.json() : null
  };
}
