"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api/client";

export function JoinRequestButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/trackers/${trackerId}/membership-requests`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleClick} disabled={submitting}>
        {submitting ? "Requesting…" : "Request to join"}
      </button>
      {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
