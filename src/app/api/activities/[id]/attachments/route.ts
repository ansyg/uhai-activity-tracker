import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { activityAttachmentPrefix, isAllowedContentType, publicUrlFor } from "@/lib/storage/r2";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — mirrors the presign route's cap

const CreateAttachmentSchema = z.object({
  key: z.string().min(1).max(600),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

/** Records a file the browser already uploaded directly to R2 via its presigned URL — see /presign. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    const { key, fileName, contentType, fileSize } = CreateAttachmentSchema.parse(await request.json());

    // Without this, a client could point `key` at any object in the bucket —
    // including one from a different activity/tracker entirely — and later
    // deleting this "attachment" would delete that other object for real.
    // attachmentKey() always scopes under this exact prefix, so anything
    // else is either forged or stale.
    if (!key.startsWith(activityAttachmentPrefix(activityId))) {
      throw new BadRequestError("That upload doesn't belong to this activity.");
    }
    if (!isAllowedContentType(contentType)) {
      throw new BadRequestError(`"${contentType}" isn't an allowed file type.`);
    }

    const attachment = await prisma.attachment.create({
      data: {
        activityId,
        fileName,
        fileUrl: publicUrlFor(key),
        contentType,
        fileSize,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
