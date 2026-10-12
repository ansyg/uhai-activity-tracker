import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { issuePasswordReset } from "@/lib/auth/password-reset";
import { getAppOrigin } from "@/lib/http/origin";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

/** Platform Admin only: email a password-reset link to a password-based account. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "MANAGE");

    const { id: targetUserId } = await params;
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundError("User not found.");
    if (!target.passwordHash) {
      throw new BadRequestError("This account signs in with Google — there's no password to reset.");
    }

    await issuePasswordReset(target.id, target.email, getAppOrigin(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
