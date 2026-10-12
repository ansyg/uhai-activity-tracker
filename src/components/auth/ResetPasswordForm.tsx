"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";

function ResetPasswordFields() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>Invalid link</h2>
        <p className="muted" style={{ marginBottom: 20 }}>This reset link is missing its token.</p>
        <Link className="btn" href="/forgot-password">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>Password reset</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          You can sign in with your new password now. You&apos;ve been signed out everywhere else for safety.
        </p>
        <button className="btn btn-primary" onClick={() => router.push("/sign-in")}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ marginBottom: 8 }}>Set a new password</h2>
      <p className="muted" style={{ marginBottom: 20 }}>Choose a new password for your account.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="password">
            New password
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
        <div>
          <label className="field-label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            className="input"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Reset password"}
        </button>
      </form>
    </>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense>
      <ResetPasswordFields />
    </Suspense>
  );
}
