import { Logo } from "@/components/Logo";
import { ProgressRing } from "@/components/trackers/ProgressRing";
import { BRAND } from "@/lib/branding";

const FEATURES = [
  "See phase and activity progress at a glance with live completion rings.",
  "Link the systems involved in each integration and track who owns what.",
  "Invite your team, sync deadlines to Google Calendar, and keep everyone aligned.",
  "Download and print progress Reports per each tracker... ",
];

/**
 * The clip-path uses objectBoundingBox coordinates (0-1 relative to the promo
 * pane's own box), so the wave scales with the pane at any viewport size
 * instead of needing fixed pixel math.
 */
function WaveClipDef() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <clipPath id="login-wave" clipPathUnits="objectBoundingBox">
          <path d="M0.06,0 C0.06,0.2 0.15,0.3 0.15,0.48 C0.15,0.66 0.06,0.76 0.06,1 L1,1 L1,0 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * Shared shell for every auth screen (sign in, sign up, forgot password): the
 * wave-divided promo pane is identical everywhere, so it lives here once.
 * `heading`/`subheading` are optional — omit them when the form itself owns
 * its heading (e.g. ForgotPasswordForm, whose heading text changes with its
 * own "sent" state and can't be decided by this server component).
 */
export function AuthSplitScreen({
  heading,
  subheading,
  children,
}: {
  heading?: string;
  subheading?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="login-page textured-bg">
      <WaveClipDef />
      <div className="card login-shell">
        <div className="login-pane-form">
          <div className="login-form-body">
            <Logo withWordmark={false} href="/" />
            {heading && (
              <div style={{ marginTop: 22, marginBottom: 28 }}>
                <h1 style={{ fontSize: "1.7rem" }}>{heading}</h1>
                {subheading && (
                  <p className="muted" style={{ marginTop: 6, fontSize: "0.92em" }}>
                    {subheading}
                  </p>
                )}
              </div>
            )}

            {children}
          </div>

          <footer className="muted" style={{ fontSize: "0.78em", textAlign: "center", marginTop: 28 }}>
            <div>
              {BRAND.company} · {BRAND.address}
            </div>
            <div>
              <a href={`mailto:${BRAND.email}`} style={{ textDecoration: "underline" }}>
                {BRAND.email}
              </a>
            </div>
          </footer>
        </div>

        <div className="login-pane-promo">
          <div>
            <h2 className="login-promo-heading">About {BRAND.name}</h2>
            <p className="login-promo-copy">
              {BRAND.name} keeps every system-integration project visible — phases, activities, and the people doing
              the work, all on one shared board.
            </p>
          </div>

          <div>
            <p className="login-promo-subheading">What you can do</p>
            <ul className="login-feature-list">
              {FEATURES.map((feature) => (
                <li key={feature} className="login-feature-item">
                  <span className="login-feature-dot" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card login-preview-card">
            <div className="login-preview-head">
              <span className="login-preview-dot" aria-hidden />
              <span>Track System × Trello Integration</span>
            </div>
            <div className="login-preview-body">
              <ProgressRing completed={6} inProgress={9} notStarted={54} size={56} strokeWidth={7} />
              <div className="login-preview-stats">
                <div>
                  <strong>69</strong> activities
                </div>
                <div>6 completed · 9 in progress</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
