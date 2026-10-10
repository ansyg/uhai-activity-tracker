import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/serialize";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = RegisterSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestError("An account with this email already exists.");

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: body.name },
    });

    await createSession(user.id, user.email);

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
