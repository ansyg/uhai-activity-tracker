import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { attachmentKey, createUploadUrl, isAllowedContentType, isStorageConfigured, publicUrlFor } from "@/lib/storage/r2";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const PresignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStorageConfigured()) {
      throw new BadRequestError("File storage isn't configured on this deployment yet.");
    }

    const userId = await requireUserId();
    const { id: activityId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    const { fileName, contentType, fileSize } = PresignSchema.parse(await request.json());

    if (!isAllowedContentType(contentType)) {
      throw new BadRequestError(`"${contentType}" isn't an allowed file type.`);
    }

    const key = attachmentKey(activityId, fileName);
    const uploadUrl = await createUploadUrl(key, contentType, fileName);

    return NextResponse.json({ uploadUrl, key, publicUrl: publicUrlFor(key), fileSize });
  } catch (error) {
    return handleApiError(error);
  }
}
