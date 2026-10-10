import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/serialize";
import { ForbiddenError } from "@/lib/rbac/permissions";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = LoginSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new BadRequestError(
        !user
          ? "No account found for this email."
          : "This account signs in with Google — use Continue with Google."
      );
    }

    const valid = await verifyPassword(user.passwordHash, body.password);
    if (!valid) throw new BadRequestError("Incorrect email or password.");

    if (!user.isActive) {
      throw new ForbiddenError("This account has been deactivated. Contact your tracker owner for access.");
    }

    await createSession(user.id, user.email);

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
