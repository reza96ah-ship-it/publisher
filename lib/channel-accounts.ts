import { apiUrl, authHeaders } from "./posts";
import type { PublishingChannel } from "./channels";

export type ChannelAccount = {
  id: number;
  store_id: number;
  channel: PublishingChannel;
  display_name: string;
  external_account_id: string;
  mode: string;
  status: string;
  capabilities: string[];
  limitations: string[];
  last_error: string;
  last_test_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChannelAccountList = {
  accounts: ChannelAccount[];
  summary: {
    total: number;
    ready: number;
    action_required: number;
    channels: string[];
  };
};

export async function loadChannelAccounts(): Promise<ChannelAccountList> {
  const response = await fetch(`${apiUrl}/channels/accounts`, { headers: authHeaders() });
  if (!response.ok) throw new Error("دریافت وضعیت کانال‌ها ناموفق بود");
  return response.json();
}

export function findChannelAccount(accounts: ChannelAccount[], channel: PublishingChannel) {
  return accounts.find((account) => account.channel === channel);
}

export function channelIsReady(account?: ChannelAccount | null) {
  return account?.status === "ready";
}

export function channelCanAutoPublish(account?: ChannelAccount | null) {
  return Boolean(account?.capabilities.includes("auto_publish"));
}

export function channelCanManualPublish(account?: ChannelAccount | null) {
  return Boolean(account?.capabilities.includes("manual_publish"));
}

export function channelStatusLabel(account?: ChannelAccount | null) {
  if (!account) return "تنظیم نشده";
  if (account.status === "ready") return "آماده";
  if (account.status === "test_expired") return "تست منقضی شده";
  if (account.status === "oauth_required") return "نیازمند Meta OAuth";
  if (account.status === "not_configured") return "تنظیم نشده";
  if (account.status === "failed") return "خطا دارد";
  return account.status;
}
