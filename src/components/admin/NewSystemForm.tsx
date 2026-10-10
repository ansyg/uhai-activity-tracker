"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

export function NewSystemForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/systems", { name, description: description || undefined });
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
      <input
        className="input"
        placeholder="System name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1 }}
      />
      <input
        className="input"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ flex: 2 }}
      />
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
