import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { sendEmail } from "@/lib/notifications/email";
import { getAppOrigin } from "@/lib/http/origin";
import { BRAND } from "@/lib/branding";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const INVITE_TTL_DAYS = 7;

const CreateInviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
});

/** Owner/Admin invites someone by email, who may not have an account yet (ARCHITECTURE.md §3.4). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    const { id: trackerId } = await params;
    await requireTrackerGrant(callerId, trackerId, "tracker.members", "MANAGE");

    const body = CreateInviteSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const [role, tracker, inviter] = await Promise.all([
      prisma.role.findUnique({ where: { id: body.roleId } }),
      prisma.tracker.findUnique({ where: { id: trackerId }, select: { name: true } }),
      prisma.user.findUniqueOrThrow({ where: { id: callerId }, select: { name: true } }),
    ]);
    if (!role) throw new BadRequestError("Unknown role.");
    if (!tracker) throw new NotFoundError("Tracker not found.");

    // App-level invariant: at most one PENDING invite per address at a time.
    // updateMany (not update-by-id) so this stays safe even if more than one
    // PENDING row somehow exists for this trackerId+email.
    await prisma.trackerInvite.updateMany({
      where: { trackerId, email, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    const token = randomBytes(32).toString("base64url");
    const invite = await prisma.trackerInvite.create({
      data: {
        trackerId,
        email,
        roleId: role.id,
        invitedById: callerId,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const acceptPath = `/accept-invite?token=${invite.token}`;
    const acceptUrl = `${getAppOrigin(request)}${acceptPath}`;

    // This is one of the two load-bearing emails (ARCHITECTURE.md §7) — the
    // recipient has no account yet, so this link is the only way they can
    // get in. Sent inline rather than through the Notification/preference
    // system, same reasoning as the comment on TrackerInvite in the schema.
    await sendEmail({
      to: email,
      subject: `You're invited to ${tracker.name}`,
      heading: `Join ${tracker.name}`,
      body: `You've been invited to join <strong>${tracker.name}</strong> on ${BRAND.name}. Sign in or create an account with this exact email address to accept.`,
      ctaUrl: acceptUrl,
      ctaLabel: "Accept invite",
    }).catch((err) => console.error("Failed to send invite email:", err));

    return NextResponse.json(
      { invite, acceptUrl: acceptPath, roleName: role.name, invitedByName: inviter.name },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
