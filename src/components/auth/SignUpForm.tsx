"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";

function SignUpFields({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirect = searchParams.get("redirect");
  const googleHref = redirect ? `/api/auth/google?redirect=${encodeURIComponent(redirect)}` : "/api/auth/google";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/register", { name, email, password });
      router.push(redirect ?? "/trackers");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span className="muted" style={{ fontSize: "0.85em" }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <a className="btn" href={googleHref} style={{ width: "100%", justifyContent: "center" }}>
            Continue with Google
          </a>
        </>
      )}

      <p className="muted" style={{ textAlign: "center", marginTop: 20, fontSize: "0.9em" }}>
        Already have an account? <Link href="/sign-in" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <Suspense>
      <SignUpFields googleEnabled={googleEnabled} />
    </Suspense>
  );
}
