import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { createNotification } from "@/lib/notifications/create";
import { sendEmail } from "@/lib/notifications/email";
import { BRAND } from "@/lib/branding";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  roleId: z.string().min(1).optional(),
  note: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId, userId: targetUserId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.approvals", "APPROVE");

    const body = DecisionSchema.parse(await request.json());

    const membership = await prisma.trackerMembership.findUnique({
      where: { trackerId_userId: { trackerId, userId: targetUserId } },
      include: { tracker: true, user: { select: { email: true } } },
    });
    if (!membership) throw new NotFoundError("Membership request not found.");

    const updated = await prisma.trackerMembership.update({
      where: { trackerId_userId: { trackerId, userId: targetUserId } },
      data: {
        status: body.decision === "approve" ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        decidedById: callerId,
        decisionNote: body.note,
        roleId: body.decision === "approve" && body.roleId ? body.roleId : membership.roleId,
      },
    });

    await createNotification(targetUserId, "JOIN_DECIDED", {
      trackerId,
      trackerName: membership.tracker.name,
      decision: body.decision,
    });

    // The other load-bearing email (ARCHITECTURE.md §7): it's deliberately
    // explicit about which address to use, since that's the identity the
    // membership row is keyed to.
    const approved = body.decision === "approve";
    await sendEmail({
      to: membership.user.email,
      subject: approved ? `You're in: ${membership.tracker.name}` : `Update on ${membership.tracker.name}`,
      heading: approved ? "Request approved" : "Request declined",
      body: approved
        ? `You now have access to <strong>${membership.tracker.name}</strong> on ${BRAND.name}. Sign in with <strong>${membership.user.email}</strong> to get started.`
        : `Your request to join <strong>${membership.tracker.name}</strong> was declined.`,
      ctaUrl: approved ? `${request.nextUrl.origin}/trackers/${trackerId}` : undefined,
      ctaLabel: "Open tracker",
    }).catch((err) => console.error("Failed to send decision email:", err));

    return NextResponse.json({ membership: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
