"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface RoleOption {
  id: string;
  name: string;
}

export function ApprovalActions({
  trackerId,
  userId,
  roles,
  defaultRoleId,
}: {
  trackerId: string;
  userId: string;
  roles: RoleOption[];
  defaultRoleId: string;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(defaultRoleId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/trackers/${trackerId}/memberships/${userId}/decision`, { decision, roleId });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select className="input" style={{ width: 140 }} value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={submitting}>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <button className="btn btn-primary" onClick={() => decide("approve")} disabled={submitting}>
        Approve
      </button>
      <button className="btn btn-danger" onClick={() => decide("reject")} disabled={submitting}>
        Reject
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
