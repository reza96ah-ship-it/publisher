import { apiUrl, authHeaders } from "./posts";

export type InstagramAutomationEvent = {
  id: number;
  store_id: number;
  rule_id: number | null;
  instagram_account_id: number | null;
  post_id: number | null;
  ig_media_id: string;
  ig_comment_id: string;
  commenter_username: string;
  commenter_ig_scoped_id: string | null;
  comment_text: string;
  normalized_comment_text: string;
  event_status: string;
  conversation_status: "automated" | "operator_takeover" | "resolved";
  automation_paused_until: string | null;
  skip_reason: string;
  failure_reason: string;
  private_reply_message_id: string;
  public_reply_comment_id: string;
  attempt_count: number;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  internal_note: string | null;
};

export type SavedReply = {
  id: number;
  store_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function loadAutomationEvents(): Promise<InstagramAutomationEvent[]> {
  const response = await fetch(`${apiUrl}/instagram/automation/events`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("خطا در دریافت رویدادهای اتوماسیون اینستاگرام");
  }
  const data = await response.json();
  return data.events || [];
}

export async function updateConversationStatus(eventId: number, status: "automated" | "operator_takeover" | "resolved", pausedHours: number = 0): Promise<InstagramAutomationEvent> {
  const response = await fetch(`${apiUrl}/instagram/automation/events/${eventId}/conversation`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ conversation_status: status, paused_hours: pausedHours })
  });
  if (!response.ok) {
    throw new Error("خطا در به‌روزرسانی وضعیت گفتگو");
  }
  return await response.json();
}

export async function assignConversation(eventId: number, assignedTo: string | null): Promise<InstagramAutomationEvent> {
  const response = await fetch(`${apiUrl}/instagram/automation/events/${eventId}/assign`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ assigned_to: assignedTo })
  });
  if (!response.ok) {
    throw new Error("خطا در انتساب گفتگو");
  }
  return await response.json();
}

export async function updateConversationNote(eventId: number, note: string | null): Promise<InstagramAutomationEvent> {
  const response = await fetch(`${apiUrl}/instagram/automation/events/${eventId}/note`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ internal_note: note })
  });
  if (!response.ok) {
    throw new Error("خطا در ثبت یادداشت گفتگو");
  }
  return await response.json();
}

export async function loadSavedReplies(): Promise<SavedReply[]> {
  const response = await fetch(`${apiUrl}/instagram/automation/saved-replies`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("خطا در دریافت پاسخ‌های آماده");
  }
  const data = await response.json();
  return data.replies || [];
}

export async function createSavedReply(title: string, content: string): Promise<SavedReply> {
  const response = await fetch(`${apiUrl}/instagram/automation/saved-replies`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, content })
  });
  if (!response.ok) {
    throw new Error("خطا در ذخیره پاسخ آماده");
  }
  return await response.json();
}

export async function deleteSavedReply(replyId: number): Promise<{ ok: boolean }> {
  const response = await fetch(`${apiUrl}/instagram/automation/saved-replies/${replyId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("خطا در حذف پاسخ آماده");
  }
  return await response.json();
}

export type LinkClickStats = {
  short_link_id: number;
  short_code: string;
  original_url: string;
  total_clicks: number;
  unique_clicks: number;
};

export async function loadLinkMetrics(): Promise<LinkClickStats[]> {
  const response = await fetch(`${apiUrl}/analytics/links`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("خطا در دریافت آمار لینک‌ها");
  }
  return await response.json();
}

