"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function NewModuleForm({ systemId }: { systemId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/api/systems/${systemId}/modules`, { name });
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
      <input
        className="input"
        placeholder="Add module (e.g. LAB)"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ maxWidth: 220 }}
      />
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add module"}
      </button>
      {error && <span className="error-text">{error}</span>}
    </form>
  );
}
