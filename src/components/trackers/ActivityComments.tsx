"use client";

import { api, ApiError } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface CommentData {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { id: string; name: string } | null;
}

interface MemberOption {
  id: string;
  name: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Renders "@Name" tokens in posted comments distinctly from plain text. */
function renderBody(body: string, members: MemberOption[]) {
  if (members.length === 0) return body;
  const names = members.map((m) => m.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  const parts = body.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: "var(--accent)" }}>
        @{part}
      </strong>
    ) : (
      part
    )
  );
}

export function ActivityComments({
  activityId,
  comments,
  members = [],
}: {
  activityId: string;
  comments: CommentData[];
  members?: MemberOption[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the mention token currently being typed, right at the end of the
  // text — matches how chat apps show suggestions as you type, without
  // needing full cursor-position tracking in a plain textarea.
  const mentionQuery = useMemo(() => {
    const match = /@([^\s@]*)$/.exec(body);
    return match ? match[1] : null;
  }, [body]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, members]);

  function pickMention(member: MemberOption) {
    setBody((prev) => prev.replace(/@([^\s@]*)$/, `@${member.name} `));
    setMentionedUserIds((prev) => new Set(prev).add(member.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/activities/${activityId}/comments`, {
        body: body.trim(),
        mentionedUserIds: Array.from(mentionedUserIds),
      });
      setBody("");
      setMentionedUserIds(new Set());
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't post that — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.9em", marginBottom: 16 }}>
          No remarks yet. Add one below to explain progress, flag a blocker, or
          leave a note for whoever picks this up next.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {comments.map((comment) => (
            <div key={comment.id} style={{ display: "flex", gap: 10 }}>
              <span
                className="avatar"
                style={{
                  width: 30,
                  height: 30,
                  fontSize: "0.68rem",
                  flexShrink: 0,
                }}
              >
                {initials(comment.user?.name ?? "?") || "?"}
              </span>
              <div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                >
                  <strong style={{ fontSize: "0.9em" }}>
                    {comment.user?.name ?? "Someone"}
                  </strong>
                  <span className="muted" style={{ fontSize: "0.78em" }}>
                    {new Date(comment.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.9em",
                    marginTop: 2,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {renderBody(comment.body, members)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div style={{ position: "relative" }}>
          <textarea
            className="input"
            rows={3}
            placeholder="Add a remark about this activity's progress… use @ to mention someone"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
          />
          {suggestions.length > 0 && (
            <div
              className="card"
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 10,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {suggestions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(member);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="avatar" style={{ width: 24, height: 24, fontSize: "0.62rem", flexShrink: 0 }}>
                    {initials(member.name) || "?"}
                  </span>
                  <span style={{ fontSize: "0.88em" }}>{member.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting || !body.trim()}
          style={{ alignSelf: "flex-start" }}
        >
          {submitting ? "Posting…" : "Post remark"}
        </button>
      </form>
    </div>
  );
}
