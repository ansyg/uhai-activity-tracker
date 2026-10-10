"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

interface RoleOption {
  id: string;
  name: string;
}

export function InviteForm({ trackerId, roles }: { trackerId: string; roles: RoleOption[] }) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAcceptUrl(null);
    setSubmitting(true);
    try {
      const result = await api.post<{ acceptUrl: string }>(`/api/trackers/${trackerId}/invites`, { email, roleId });
      setAcceptUrl(result.acceptUrl);
      setEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <input
        className="input"
        type="email"
        placeholder="person@example.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ flex: 1 }}
      />
      <select className="input" style={{ width: 150 }} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Invite"}
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
