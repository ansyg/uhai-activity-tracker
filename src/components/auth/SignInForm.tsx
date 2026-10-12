"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";

function SignInFields({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/login", { email, password });
      router.push(searchParams.get("redirect") ?? "/trackers");
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <Link href="/forgot-password" style={{ fontSize: "0.85em", color: "var(--accent)" }}>
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {(error || oauthError) && <p className="error-text">{error ?? oauthError}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
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

          <a className="btn" href="/api/auth/google" style={{ width: "100%", justifyContent: "center" }}>
            Continue with Google
          </a>
        </>
      )}

      <p className="muted" style={{ textAlign: "center", marginTop: 20, fontSize: "0.9em" }}>
        Don&apos;t have an account? <Link href="/sign-up" style={{ color: "var(--accent)" }}>Sign up</Link>
      </p>
    </>
  );
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <Suspense>
      <SignInFields googleEnabled={googleEnabled} />
    </Suspense>
  );
}
