"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

function describe(notification: NotificationRow): { text: string; href?: string } {
  const p = notification.payload;
  const trackerName = typeof p.trackerName === "string" ? p.trackerName : "a tracker";
  const trackerId = typeof p.trackerId === "string" ? p.trackerId : undefined;
  const trackerHref = trackerId ? `/trackers/${trackerId}` : undefined;

  switch (notification.type) {
    case "JOIN_REQUESTED":
      return { text: `Someone asked to join ${trackerName}.`, href: trackerHref };
    case "JOIN_DECIDED":
      return {
        text: p.decision === "approve" ? `You were approved to join ${trackerName}.` : `Your request to join ${trackerName} was declined.`,
        href: trackerHref,
      };
    case "INVITE_ACCEPTED":
      return { text: `Your invite to ${trackerName} was accepted.`, href: trackerHref };
    case "ACTIVITY_ASSIGNED":
      return { text: `You were assigned an activity in ${trackerName}.`, href: trackerHref };
    case "STATUS_CHANGED":
      return { text: `An activity's status changed in ${trackerName}.`, href: trackerHref };
    case "DEADLINE_DUE_SOON":
      return { text: `An activity in ${trackerName} is due soon.`, href: trackerHref };
    case "DEADLINE_OVERDUE":
      return { text: `An activity in ${trackerName} is overdue.`, href: trackerHref };
    case "COMMENT_MENTION":
      return { text: `You were mentioned in ${trackerName}.`, href: trackerHref };
    case "CALENDAR_SYNC_FAILED": {
      const activityTitle = typeof p.activityTitle === "string" ? p.activityTitle : "an activity";
      return { text: `Couldn't sync "${activityTitle}" to Google Calendar.`, href: trackerHref };
    }
    case "TRACKER_LIMIT_REQUESTED": {
      const requesterName = typeof p.requesterName === "string" ? p.requesterName : "Someone";
      const requestedMax = typeof p.requestedMax === "number" ? p.requestedMax : "more";
      return { text: `${requesterName} asked for a limit of ${requestedMax} trackers.`, href: "/admin/users" };
    }
    case "TRACKER_LIMIT_DECIDED": {
      const requestedMax = typeof p.requestedMax === "number" ? p.requestedMax : "more";
      return {
        text:
          p.decision === "approve"
            ? `You were approved for up to ${requestedMax} trackers.`
            : `Your request for ${requestedMax} trackers was declined.`,
        href: "/trackers",
      };
    }
    default:
      return { text: `Update in ${trackerName}.`, href: trackerHref };
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const result = await api.get<{ notifications: NotificationRow[] }>("/api/notifications");
      setNotifications(result.notifications);
    } catch {
      // Transient failures just leave the previous list showing.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleSelect(notification: NotificationRow) {
    if (!notification.readAt) {
      await api.patch(`/api/notifications/${notification.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)));
    }
    const { href } = describe(notification);
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button className="icon-btn" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--danger)",
            }}
          />
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: 46,
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 30,
            padding: 8,
          }}
        >
          <div style={{ padding: "8px 10px", fontWeight: 600, fontSize: "0.9em" }}>Notifications</div>
          {notifications.length === 0 && (
            <div className="muted" style={{ padding: "16px 10px", fontSize: "0.88em" }}>
              You&apos;re all caught up.
            </div>
          )}
          {notifications.map((notification) => {
            const { text } = describe(notification);
            return (
              <button
                key={notification.id}
                onClick={() => handleSelect(notification)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px",
                  borderRadius: "var(--radius-sm)",
                  background: notification.readAt ? "transparent" : "var(--primary-soft)",
                  border: "none",
                  fontSize: "0.86em",
                  marginBottom: 2,
                }}
              >
                {text}
                <div className="muted" style={{ fontSize: "0.82em", marginTop: 3 }}>
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
