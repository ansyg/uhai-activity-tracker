import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/passwords";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: NextRequest) {
  try {
    const body = ResetPasswordSchema.parse(await request.json());

    const reset = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestError("This reset link is invalid or has expired. Request a new one.");
    }

    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // A password change invalidates every other signed-in session — the
      // same reasoning as deactivating an account (src/app/api/users/[id]/route.ts).
      prisma.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
