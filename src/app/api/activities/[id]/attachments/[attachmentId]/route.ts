import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { requireTrackerGrant } from "@/lib/rbac/permissions";
import { loadTrackerForViewer } from "@/lib/trackers/access";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage/r2";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id: activityId, attachmentId } = await params;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundError("Activity not found.");

    await loadTrackerForViewer(activity.trackerId, userId);
    await requireTrackerGrant(userId, activity.trackerId, "tracker.activities", "EDIT");

    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, activityId } });
    if (!attachment) throw new NotFoundError("Attachment not found.");

    await prisma.attachment.delete({ where: { id: attachmentId } });

    const key = keyFromPublicUrl(attachment.fileUrl);
    if (key) {
      await deleteObject(key).catch((err) => console.error("Failed to delete R2 object:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
