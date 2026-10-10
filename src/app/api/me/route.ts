import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { toPublicUser } from "@/lib/auth/serialize";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
