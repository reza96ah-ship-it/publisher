import { apiUrl, authHeaders } from "./posts";

export const notificationsUpdatedEvent = "rubika-publisher:notifications-updated";
export const notificationsLiveEvent = "rubika-publisher:notifications-live";

const readNotificationsKey = "rubika-publisher:read-notifications";
const knownNotificationsKey = "rubika-publisher:known-notifications";

export type OperationalNotification = {
  id: string;
  category: string;
  severity: "critical" | "warning" | "info" | string;
  title: string;
  description: string;
  recovery_hint: string;
  action_label: string;
  action_href: string;
  post_id: number | null;
  created_at: string;
  action_required: boolean;
};

export type OperationalNotificationSummary = {
  total: number;
  action_required: number;
  critical: number;
  warning: number;
  info: number;
};

export type OperationalNotifications = {
  notifications: OperationalNotification[];
  summary: OperationalNotificationSummary;
};

export const emptyOperationalNotifications: OperationalNotifications = {
  notifications: [],
  summary: { total: 0, action_required: 0, critical: 0, warning: 0, info: 0 }
};

export function loadReadNotificationIds() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(readNotificationsKey) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function saveReadNotificationIds(ids: Set<string>) {
  window.localStorage.setItem(readNotificationsKey, JSON.stringify([...ids]));
  notifyNotificationsUpdated();
}

export function notifyNotificationsUpdated() {
  window.dispatchEvent(new Event(notificationsUpdatedEvent));
}

export function loadKnownNotificationIds() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(knownNotificationsKey) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function saveKnownNotificationIds(ids: Set<string>) {
  window.sessionStorage.setItem(knownNotificationsKey, JSON.stringify([...ids]));
}

export function notifyLiveNotifications(data: OperationalNotifications) {
  window.dispatchEvent(new CustomEvent<OperationalNotifications>(notificationsLiveEvent, { detail: data }));
}

export function unreadOperationalCount(data: OperationalNotifications, readIds = loadReadNotificationIds()) {
  return data.notifications.filter((item) => item.action_required && !readIds.has(item.id)).length;
}

export async function loadOperationalNotifications(): Promise<OperationalNotifications> {
  const response = await fetch(`${apiUrl}/notifications`, { headers: authHeaders() });
  if (!response.ok) return emptyOperationalNotifications;
  return response.json();
}

