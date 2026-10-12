import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issuePasswordReset } from "@/lib/auth/password-reset";
import { getAppOrigin } from "@/lib/http/origin";
import { handleApiError } from "@/lib/api/errors";

const ForgotPasswordSchema = z.object({ email: z.string().email() });

/**
 * Always responds the same way whether or not an account exists for the
 * email (and whether it's password- or Google-based) — otherwise the
 * response itself would leak which emails are registered.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = ForgotPasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (user && user.passwordHash) {
      await issuePasswordReset(user.id, user.email, getAppOrigin(request));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
