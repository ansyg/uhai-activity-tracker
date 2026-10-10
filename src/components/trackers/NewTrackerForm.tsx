"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface SystemOption {
  id: string;
  name: string;
}

interface TrackerSystemLink {
  systemId: string;
  role: "SOURCE" | "TARGET" | "PARTICIPANT";
}

export function NewTrackerForm({ systems }: { systems: SystemOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [links, setLinks] = useState<TrackerSystemLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSystem(systemId: string) {
    setLinks((prev) =>
      prev.some((l) => l.systemId === systemId)
        ? prev.filter((l) => l.systemId !== systemId)
        : [...prev, { systemId, role: "PARTICIPANT" }]
    );
  }

  function updateRole(systemId: string, role: TrackerSystemLink["role"]) {
    setLinks((prev) => prev.map((l) => (l.systemId === systemId ? { ...l, role } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { tracker } = await api.post<{ tracker: { id: string } }>("/api/trackers", {
        name,
        description: description || undefined,
        visibility,
        systems: links,
      });
      router.push(`/trackers/${tracker.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label className="field-label" htmlFor="name">
          Name
        </label>
        <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="field-label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label">Visibility</label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["PRIVATE", "PUBLIC"] as const).map((v) => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={visibility === v} onChange={() => setVisibility(v)} />
              {v === "PRIVATE" ? "Private — invite only" : "Public — anyone can request to join"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">Systems involved</label>
        {systems.length === 0 && <p className="muted">No systems registered yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {systems.map((system) => {
            const link = links.find((l) => l.systemId === system.id);
            return (
              <div key={system.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input type="checkbox" checked={!!link} onChange={() => toggleSystem(system.id)} />
                  {system.name}
                </label>
                {link && (
                  <select
                    className="input"
                    style={{ width: 140 }}
                    value={link.role}
                    onChange={(e) => updateRole(system.id, e.target.value as TrackerSystemLink["role"])}
                  >
                    <option value="SOURCE">Source</option>
                    <option value="TARGET">Target</option>
                    <option value="PARTICIPANT">Participant</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create tracker"}
      </button>
    </form>
  );
}
