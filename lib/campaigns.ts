import { apiUrl, authHeaders } from "./posts";
import type { Post } from "./posts";

export type CampaignStatus = "active" | "paused" | "completed" | "archived";

export type Campaign = {
  id: number;
  store_id: number;
  name: string;
  goal: string;
  status: CampaignStatus | string;
  color: string;
  owner: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string;
  post_count: number;
  created_at: string;
  updated_at: string;
};

export type CampaignInput = {
  name: string;
  goal?: string;
  status?: CampaignStatus;
  color?: string;
  owner?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  notes?: string;
};

export type CampaignFilterOption = {
  value: string;
  label: string;
  color: string;
  count: number;
};

export type BulkCampaignResult = {
  updated_count: number;
  post_ids: number[];
  skipped_post_ids: number[];
};

export function campaignKeyForPost(post: Pick<Post, "campaign_id" | "campaign">) {
  if (post.campaign_id) return `id:${post.campaign_id}`;
  const label = post.campaign?.trim();
  return label ? `legacy:${label}` : "none";
}

export function campaignLabelForPost(post: Pick<Post, "campaign_id" | "campaign">, campaigns: Campaign[]) {
  if (post.campaign_id) {
    return campaigns.find((campaign) => campaign.id === post.campaign_id)?.name ?? post.campaign?.trim() ?? "کمپین حذف‌شده";
  }
  return post.campaign?.trim() || "بدون کمپین";
}

export function campaignColorForPost(post: Pick<Post, "campaign_id" | "campaign">, campaigns: Campaign[]) {
  if (post.campaign_id) return campaigns.find((campaign) => campaign.id === post.campaign_id)?.color ?? "#64748B";
  return "#94A3B8";
}

export function buildCampaignFilterOptions(posts: Array<Pick<Post, "campaign_id" | "campaign">>, campaigns: Campaign[]): CampaignFilterOption[] {
  const options = new Map<string, CampaignFilterOption>();
  campaigns.forEach((campaign) => {
    options.set(`id:${campaign.id}`, {
      value: `id:${campaign.id}`,
      label: campaign.name,
      color: campaign.color,
      count: 0
    });
  });

  posts.forEach((post) => {
    const value = campaignKeyForPost(post);
    if (value === "none") return;
    const existing = options.get(value);
    if (existing) {
      existing.count += 1;
      return;
    }
    options.set(value, {
      value,
      label: campaignLabelForPost(post, campaigns),
      color: campaignColorForPost(post, campaigns),
      count: 1
    });
  });

  return Array.from(options.values())
    .filter((option) => option.count > 0)
    .sort((first, second) => first.label.localeCompare(second.label, "fa"));
}

export async function loadCampaigns(status = "all"): Promise<Campaign[]> {
  const response = await fetch(`${apiUrl}/campaigns?status=${encodeURIComponent(status)}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("دریافت کمپین‌ها ناموفق بود");
  return response.json();
}

export async function createCampaign(payload: CampaignInput): Promise<Campaign> {
  const response = await fetch(`${apiUrl}/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({
      goal: "",
      status: "active",
      color: "#0F766E",
      owner: "",
      starts_at: null,
      ends_at: null,
      notes: "",
      ...payload
    })
  });
  if (!response.ok) throw new Error("ساخت کمپین ناموفق بود");
  return response.json();
}

export async function updateCampaign(campaignId: number, payload: CampaignInput): Promise<Campaign> {
  const response = await fetch(`${apiUrl}/campaigns/${campaignId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({
      goal: "",
      status: "active",
      color: "#0F766E",
      owner: "",
      starts_at: null,
      ends_at: null,
      notes: "",
      ...payload
    })
  });
  if (!response.ok) throw new Error("به‌روزرسانی کمپین ناموفق بود");
  return response.json();
}

export async function assignPostsToCampaign(postIds: number[], campaignId: number | null): Promise<BulkCampaignResult> {
  const response = await fetch(`${apiUrl}/posts/bulk-campaign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify({
      post_ids: postIds,
      campaign_id: campaignId
    })
  });
  if (!response.ok) throw new Error("اتصال گروهی پست‌ها به کمپین ناموفق بود");
  return response.json();
}

