import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { BRAND } from "@/lib/branding";

const RESET_TTL_HOURS = 1;

/** Issues a one-time reset token and emails the link — shared by self-service "forgot password" and an admin's "send reset link". */
export async function issuePasswordReset(userId: string, email: string, origin: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000) },
  });

  const resetUrl = `${origin}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: `Reset your ${BRAND.name} password`,
    heading: "Reset your password",
    body: `We got a request to reset your password. This link expires in ${RESET_TTL_HOURS} hour. If you didn't ask for this, you can safely ignore this email.`,
    ctaUrl: resetUrl,
    ctaLabel: "Reset password",
  }).catch((err) => console.error("Failed to send password reset email:", err));
}
