"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { PendingInvite } from "@/components/trackers/PendingInvites";

interface RoleOption {
  id: string;
  name: string;
}

interface UserMatch {
  id: string;
  name: string;
  email: string;
  alreadyInvited: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function InviteForm({
  trackerId,
  roles,
  onInvited,
}: {
  trackerId: string;
  roles: RoleOption[];
  onInvited: (invite: PendingInvite) => void;
}) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const [resending, setResending] = useState(false);

  // "@" starts a lookup against already-registered users (so an owner can
  // pick someone instead of retyping an address) — anything else is typed
  // as a plain email, same as before, for inviting someone with no account yet.
  useEffect(() => {
    if (!email.startsWith("@") || email.length < 3) {
      setMatches([]);
      return;
    }
    const q = email.slice(1);
    const timer = setTimeout(() => {
      api
        .get<{ users: UserMatch[] }>(`/api/trackers/${trackerId}/members/search?q=${encodeURIComponent(q)}`)
        .then((data) => setMatches(data.users))
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [email, trackerId]);

  function pickMatch(user: UserMatch) {
    setEmail(user.email);
    setResending(user.alreadyInvited);
    setMatches([]);
    setShowMatches(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAcceptUrl(null);
    if (email.startsWith("@")) {
      setError("Pick a person from the list, or type their full email address.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<{
        invite: { id: string; createdAt: string; expiresAt: string };
        acceptUrl: string;
        roleName: string;
        invitedByName: string;
      }>(`/api/trackers/${trackerId}/invites`, { email, roleId });
      setAcceptUrl(result.acceptUrl);
      onInvited({
        id: result.invite.id,
        email,
        roleName: result.roleName,
        invitedByName: result.invitedByName,
        createdAt: result.invite.createdAt,
        expiresAt: result.invite.expiresAt,
      });
      setEmail("");
      setResending(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <input
          className="input"
          type="text"
          placeholder="person@example.com or @name to find a registered user"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResending(false);
          }}
          onFocus={() => setShowMatches(true)}
          onBlur={() => setTimeout(() => setShowMatches(false), 120)}
        />
        {showMatches && matches.length > 0 && (
          <div
            className="card"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 10,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {matches.map((user) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMatch(user);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="avatar" style={{ width: 28, height: 28, fontSize: "0.68rem", flexShrink: 0 }}>
                  {initials(user.name) || "?"}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "0.9em", fontWeight: 560 }}>{user.name}</span>
                  <span className="muted" style={{ fontSize: "0.8em" }}>
                    {user.email}
                  </span>
                </span>
                {user.alreadyInvited && (
                  <span className="badge badge-neutral" style={{ flexShrink: 0 }}>
                    Pending invite
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <select className="input" style={{ width: 150 }} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : resending ? "Resend invite" : "Invite"}
      </button>
      {error && <p className="error-text">{error}</p>}
      {acceptUrl && (
        <p className="muted" style={{ fontSize: "0.85em" }}>
          Invite sent. You can also share the link directly: <code>{acceptUrl}</code>
        </p>
      )}
    </form>
  );
}
