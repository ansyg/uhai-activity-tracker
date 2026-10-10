import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { BadRequestError, handleApiError } from "@/lib/api/errors";

/** Mine (owned or a member of, any status) plus every PUBLIC tracker I could request to join. */
export async function GET() {
  try {
    const userId = await requireUserId();

    const trackers = await prisma.tracker.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { memberships: { some: { userId } } },
          { visibility: "PUBLIC" },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        systems: { include: { system: true } },
        memberships: { where: { userId }, select: { status: true, role: { select: { name: true } } } },
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      description: tracker.description,
      visibility: tracker.visibility,
      owner: tracker.owner,
      systems: tracker.systems.map((link) => ({ system: link.system, role: link.role })),
      activityCount: tracker._count.activities,
      myMembership: tracker.memberships[0] ?? null,
      isOwner: tracker.ownerId === userId,
    }));

    return NextResponse.json({ trackers: result });
  } catch (error) {
    return handleApiError(error);
  }
}

const CreateTrackerSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  systems: z
    .array(
      z.object({
        systemId: z.string().min(1),
        role: z.enum(["SOURCE", "TARGET", "PARTICIPANT"]).default("PARTICIPANT"),
      })
    )
    .default([]),
});

/** Any signed-in user can create a tracker; the creator becomes its OWNER (ARCHITECTURE.md §3). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = CreateTrackerSchema.parse(await request.json());

    const ownerRole = await prisma.role.findUnique({ where: { name: "Owner" } });
    if (!ownerRole) throw new BadRequestError("RBAC is not seeded — run `npm run seed` first.");

    const tracker = await prisma.tracker.create({
      data: {
        name: body.name,
        description: body.description,
        visibility: body.visibility,
        ownerId: userId,
        memberships: {
          create: { userId, roleId: ownerRole.id, status: "APPROVED", decidedAt: new Date() },
        },
        systems: {
          create: body.systems.map((s) => ({ systemId: s.systemId, role: s.role })),
        },
      },
      include: { systems: { include: { system: true } } },
    });

    return NextResponse.json({ tracker }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
