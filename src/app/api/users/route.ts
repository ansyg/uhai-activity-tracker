import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireGlobalGrant } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/errors";

/** Platform Admin only: every registered account, with which trackers they belong to. */
export async function GET() {
  try {
    const callerId = await requireUserId();
    await requireGlobalGrant(callerId, "users", "VIEW");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        passwordHash: true,
        globalRoles: { select: { role: { select: { name: true } } } },
        trackerMemberships: {
          where: { status: "APPROVED" },
          select: { tracker: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
      signInMethod: user.passwordHash ? "Email and password" : "Google",
      globalRoles: user.globalRoles.map((r) => r.role.name),
      trackers: user.trackerMemberships.map((m) => m.tracker),
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    return handleApiError(error);
  }
}
