"use client";

import { api, ApiError } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CommentData {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { id: string; name: string } | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ActivityComments({
  activityId,
  comments,
}: {
  activityId: string;
  comments: CommentData[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/activities/${activityId}/comments`, {
        body: body.trim(),
      });
      setBody("");
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
                  {comment.body}
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
        <textarea
          className="input"
          rows={3}
          placeholder="Add a remark about this activity's progress…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
        />
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
