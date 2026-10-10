import { prisma } from "@/lib/db";
import type { NotificationType, Prisma } from "@prisma/client";

/**
 * Writes the in-app Notification row (ARCHITECTURE.md §7). Email/push
 * fan-out via BullMQ is delivery-order item 3 — not wired up yet, so for
 * now this is the in-app channel only; every call site below is already
 * shaped to also enqueue a job once that queue exists.
 */
export function createNotification(userId: string, type: NotificationType, payload: Prisma.InputJsonValue) {
  return prisma.notification.create({ data: { userId, type, payload } });
}

export function createNotifications(
  userIds: string[],
  type: NotificationType,
  payload: Prisma.InputJsonValue
) {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, payload })),
  });
}
