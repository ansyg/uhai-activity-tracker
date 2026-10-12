"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import { Logo } from "@/components/Logo";

type Outcome =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "error"; message: string }
  | { state: "wrong-account"; expectedEmail: string; currentEmail: string | null; trackerName: string }
  | { state: "pending-approval"; trackerName: string }
  | { state: "accepted"; trackerId: string; trackerName: string };

function AcceptInviteContent() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [outcome, setOutcome] = useState<Outcome>({ state: "loading" });
  const [signingOut, setSigningOut] = useState(false);

  async function signOutAndSwitch() {
    setSigningOut(true);
    await api.post("/api/auth/logout").catch(() => {});
    router.push(`/sign-in?redirect=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`);
    router.refresh();
  }

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
        const result = await api.get<{
          status: "accepted" | "pending-approval" | "wrong-account" | "superseded";
          tracker: { id: string; name: string };
          expectedEmail?: string;
          currentEmail?: string | null;
          newToken?: string;
        }>(`/api/accept-invite?token=${encodeURIComponent(token)}`);
        if (result.status === "superseded" && result.newToken) {
          // This exact link was revoked (e.g. the owner hit "Resend invite")
          // but a fresh one for the same address exists — jump straight to
          // it instead of dead-ending on a stale link. Replace, not push, so
          // the dead token doesn't sit in back-button history.
          router.replace(`/accept-invite?token=${encodeURIComponent(result.newToken)}`);
          return;
        }
        if (result.status === "pending-approval") {
          setOutcome({ state: "pending-approval", trackerName: result.tracker.name });
        } else if (result.status === "wrong-account") {
          setOutcome({
            state: "wrong-account",
            expectedEmail: result.expectedEmail ?? "",
            currentEmail: result.currentEmail ?? null,
            trackerName: result.tracker.name,
          });
        } else {
          setOutcome({ state: "accepted", trackerId: result.tracker.id, trackerName: result.tracker.name });
        }
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

        {outcome.state === "wrong-account" && (
          <>
            <h2 style={{ marginBottom: 8 }}>Wrong account signed in</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              {outcome.currentEmail ? (
                <>
                  You&apos;re signed in as <strong>{outcome.currentEmail}</strong>, but the invite to{" "}
                  <strong>{outcome.trackerName}</strong> was sent to <strong>{outcome.expectedEmail}</strong>.
                </>
              ) : (
                <>
                  This invite to <strong>{outcome.trackerName}</strong> was sent to{" "}
                  <strong>{outcome.expectedEmail}</strong>.
                </>
              )}{" "}
              Sign out and sign back in with that exact address to accept it.
            </p>
            <button className="btn btn-primary" onClick={signOutAndSwitch} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out and switch account"}
            </button>
          </>
        )}

        {outcome.state === "pending-approval" && (
          <>
            <h2 style={{ marginBottom: 8 }}>Almost there</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Your account is awaiting approval from the platform admin. Once approved, you&apos;ll automatically get
              access to <strong>{outcome.trackerName}</strong> — no need to revisit this link.
            </p>
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
