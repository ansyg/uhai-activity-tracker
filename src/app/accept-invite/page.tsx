"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { Logo } from "@/components/Logo";

type Outcome =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "error"; message: string }
  | { state: "accepted"; trackerId: string; trackerName: string };

function AcceptInviteContent() {
  const token = useSearchParams().get("token") ?? "";
  const [outcome, setOutcome] = useState<Outcome>({ state: "loading" });

  useEffect(() => {
    if (!token) {
      setOutcome({ state: "error", message: "This invite link is missing its token." });
      return;
    }

    (async () => {
      try {
        await api.get("/api/me");
      } catch {
        setOutcome({ state: "signed-out" });
        return;
      }

      try {
        const result = await api.get<{ tracker: { id: string; name: string } }>(
          `/api/accept-invite?token=${encodeURIComponent(token)}`
        );
        setOutcome({ state: "accepted", trackerId: result.tracker.id, trackerName: result.tracker.name });
      } catch (err) {
        setOutcome({ state: "error", message: err instanceof ApiError ? err.message : "Something went wrong." });
      }
    })();
  }, [token]);

  const returnTo = `/accept-invite?token=${encodeURIComponent(token)}`;

  return (
    <div
      className="textured-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 24,
      }}
    >
      <Logo withWordmark={false} href="/" />
      <div className="card" style={{ padding: 32, maxWidth: 440, width: "100%", textAlign: "center" }}>
        {outcome.state === "loading" && <p className="muted">Checking your invite…</p>}

        {outcome.state === "signed-out" && (
          <>
            <h2 style={{ marginBottom: 8 }}>Sign in to accept this invite</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Sign in or create an account using the exact email address the invite was sent to, then come back to
              this link.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link className="btn btn-primary" href={`/sign-in?redirect=${encodeURIComponent(returnTo)}`}>
                Sign in
              </Link>
              <Link className="btn" href={`/sign-up?redirect=${encodeURIComponent(returnTo)}`}>
                Create account
              </Link>
            </div>
          </>
        )}

        {outcome.state === "error" && (
          <>
            <h2 style={{ marginBottom: 8 }}>Couldn&apos;t accept this invite</h2>
            <p className="error-text">{outcome.message}</p>
          </>
        )}

        {outcome.state === "accepted" && (
          <>
            <h2 style={{ marginBottom: 8 }}>You&apos;re in</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              You now have access to <strong>{outcome.trackerName}</strong>.
            </p>
            <Link className="btn btn-primary" href={`/trackers/${outcome.trackerId}`}>
              Open tracker
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  );
}
