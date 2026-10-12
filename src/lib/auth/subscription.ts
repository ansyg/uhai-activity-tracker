import { prisma } from "@/lib/db";
import { NotFoundError, SubscriptionPendingError } from "@/lib/api/errors";

/**
 * Blocks tracker creation and join requests until a Platform Admin approves the
 * account. Invite acceptance checks `subscriptionStatus` itself instead of using
 * this — a pending account's invite stays open and auto-completes on approval
 * (see users/[id]/route.ts) rather than being a hard failure here.
 */
export async function requireApprovedSubscription(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } });
  if (!user) throw new NotFoundError("User not found.");
  if (user.subscriptionStatus !== "APPROVED") {
    throw new SubscriptionPendingError();
  }
}
