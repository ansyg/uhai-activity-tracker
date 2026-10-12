"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Always succeeds client-side regardless of whether the email matches
      // an account — the API itself is the thing that avoids leaking that.
      await api.post("/api/auth/forgot-password", { email });
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 8 }}>Check your email</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          If an account with a password exists for <strong>{email}</strong>, we&apos;ve sent a link to reset it. The
          link expires in an hour.
        </p>
        <Link className="btn" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ marginBottom: 8 }}>Forgot your password?</h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        Enter the email address on your account and we&apos;ll send you a link to reset it.
      </p>
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
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="muted" style={{ textAlign: "center", marginTop: 20, fontSize: "0.9em" }}>
        <Link href="/sign-in" style={{ color: "var(--accent)" }}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
