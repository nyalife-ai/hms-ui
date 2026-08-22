/**
 * Durable notification center API client.
 */

import { api } from "./api";
import { unwrapPage, buildListQuery } from "./pagination";

export type AppNotification = {
  id: string;
  userId: string;
  notificationType: string;
  title: string;
  body?: string | null;
  priority: string;
  isRead: boolean;
  readAt?: string | null;
  expiresAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionPath?: string | null;
  deliveryStatus: string;
  wsDeliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferences = {
  notificationSoundEnabled: boolean;
};

export async function fetchMyNotifications(opts?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
}) {
  const qs = buildListQuery({
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 20,
    ...(opts?.isRead !== undefined ? { isRead: String(opts.isRead) } : {}),
  });
  return unwrapPage<AppNotification>(await api(`/notifications/me?${qs}`));
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api<{ count: number }>("/notifications/me/unread-count");
  return res.count;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return api<NotificationPreferences>("/notifications/me/preferences");
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return api<NotificationPreferences>("/notifications/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  return api<AppNotification>(`/notifications/me/${id}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<{ ok: true }> {
  return api<{ ok: true }>("/notifications/me/read-all", { method: "POST" });
}
