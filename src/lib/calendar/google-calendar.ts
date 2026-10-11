import { google, calendar_v3 } from "googleapis";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "./crypto";

/**
 * One-way (app → calendar) sync, per ARCHITECTURE.md §6 step 1 and the
 * delivery order in §12 item 5 ("one-way sync, then watch-channel two-way
 * sync"). The watch-channel direction (Calendar → App) needs a public HTTPS
 * webhook endpoint and a running BullMQ renewal job, neither of which exist
 * in this deployment yet — that's the deliberately-deferred next step.
 */
export const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  );
}

export interface CalendarTokens {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiry: Date;
}

/** Exchanges the consent-screen `code` for Calendar-scoped tokens (separate from the sign-in profile exchange in auth/google.ts). */
export async function exchangeCodeForCalendarTokens(code: string): Promise<CalendarTokens> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token — disconnect any existing connection and try again so Google re-prompts for consent."
    );
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? CALENDAR_SCOPES.join(" "),
    expiry: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
  };
}

/**
 * An authenticated Calendar client for this user, or null if they haven't
 * connected one. Persists any access token Google silently refreshes along
 * the way, so the next call doesn't have to redo the refresh round-trip.
 */
export async function getCalendarClientForUser(
  userId: string
): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const connection = await prisma.calendarConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: decrypt(connection.accessToken),
    refresh_token: decrypt(connection.refreshToken),
    expiry_date: connection.expiry.getTime(),
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    prisma.calendarConnection
      .update({
        where: { userId },
        data: {
          accessToken: encrypt(tokens.access_token),
          expiry: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
          ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
        },
      })
      .catch((err) => console.error("Failed to persist refreshed Calendar token:", err));
  });

  return { calendar: google.calendar({ version: "v3", auth: client }), calendarId: connection.calendarId };
}

function toAllDayDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Google's `end.date` for an all-day event is exclusive — the day *after* the last included day. */
function toExclusiveEndDate(date: Date): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return toAllDayDate(next);
}

export interface ActivityForSync {
  id: string;
  trackerId: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * Upserts a Google Calendar event for this activity, in the calendar of
 * whoever made the edit (`actingUserId`) — sync is per-actor and opt-in,
 * not forced onto every tracker member. No-ops quietly (not an error) when
 * the tracker doesn't have sync on, the actor hasn't connected Calendar, or
 * the activity has no dates to put on a calendar.
 */
export async function syncActivityToCalendar(activity: ActivityForSync, actingUserId: string, appOrigin: string): Promise<void> {
  if (!activity.startDate) return;

  const tracker = await prisma.tracker.findUnique({
    where: { id: activity.trackerId },
    select: { calendarSyncEnabled: true },
  });
  if (!tracker?.calendarSyncEnabled) return;

  const client = await getCalendarClientForUser(actingUserId);
  if (!client) return;

  const end = activity.endDate ?? activity.startDate;
  const requestBody: calendar_v3.Schema$Event = {
    summary: activity.title,
    description: `${activity.description ?? ""}\n\n${appOrigin}/trackers/${activity.trackerId}/activities/${activity.id}`.trim(),
    start: { date: toAllDayDate(activity.startDate) },
    end: { date: toExclusiveEndDate(end) },
  };

  const existingMap = await prisma.calendarEventMap.findFirst({
    where: { activityId: activity.id, calendarConnection: { userId: actingUserId } },
  });

  try {
    if (existingMap) {
      await client.calendar.events.update({
        calendarId: client.calendarId,
        eventId: existingMap.googleEventId,
        requestBody,
      });
      await prisma.calendarEventMap.update({ where: { id: existingMap.id }, data: { lastSyncedAt: new Date() } });
    } else {
      const { data } = await client.calendar.events.insert({ calendarId: client.calendarId, requestBody });
      if (!data.id) throw new Error("Google didn't return an event id");
      const connection = await prisma.calendarConnection.findUniqueOrThrow({ where: { userId: actingUserId } });
      await prisma.calendarEventMap.create({
        data: { activityId: activity.id, calendarConnectionId: connection.id, googleEventId: data.id },
      });
    }
  } catch (err) {
    console.error(`Calendar sync failed for activity ${activity.id}:`, err);
    const { createNotification } = await import("@/lib/notifications/create");
    await createNotification(actingUserId, "CALENDAR_SYNC_FAILED", {
      trackerId: activity.trackerId,
      activityId: activity.id,
      activityTitle: activity.title,
    }).catch(() => {});
  }
}
