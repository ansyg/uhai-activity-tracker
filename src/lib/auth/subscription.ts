import { prisma } from "@/lib/db";
import { NotFoundError, SubscriptionPendingError } from "@/lib/api/errors";

/** Blocks tracker creation, join requests, and invite acceptance until a Platform Admin approves the account. */
export async function requireApprovedSubscription(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } });
  if (!user) throw new NotFoundError("User not found.");
  if (user.subscriptionStatus !== "APPROVED") {
    throw new SubscriptionPendingError();
  }
}
