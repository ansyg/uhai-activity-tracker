import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/api/guard";
import { decrypt } from "@/lib/calendar/crypto";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

/**
 * Revokes the Google token (best-effort) and forgets the connection. Per
 * ARCHITECTURE.md §6 step 5, this leaves any already-synced Google Calendar
 * events as-is rather than deleting them — simplest, safest default for a
 * v1 one-way sync with no "delete the events too?" prompt yet.
 */
export async function DELETE() {
  try {
    const userId = await requireUserId();
    const connection = await prisma.calendarConnection.findUnique({ where: { userId } });
    if (!connection) throw new NotFoundError("No Google Calendar connection to disconnect.");

    try {
      const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      client.setCredentials({ access_token: decrypt(connection.accessToken) });
      await client.revokeCredentials();
    } catch (err) {
      console.error("Failed to revoke Google Calendar token (continuing to disconnect locally):", err);
    }

    await prisma.$transaction([
      prisma.calendarEventMap.deleteMany({ where: { calendarConnectionId: connection.id } }),
      prisma.calendarConnection.delete({ where: { id: connection.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
