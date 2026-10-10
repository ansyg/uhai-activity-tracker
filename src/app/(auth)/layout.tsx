import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/branding";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="textured-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        gap: 28,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Logo withWordmark={false} href="/" />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "1.3rem" }}>{BRAND.name}</h1>
            <p className="muted" style={{ marginTop: 6, fontSize: "0.92em" }}>
              {BRAND.tagline}
            </p>
          </div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          {children}
        </div>
      </div>

      <footer className="muted" style={{ fontSize: "0.8em", textAlign: "center" }}>
        <div>
          {BRAND.company} · {BRAND.address}
        </div>
        <div>
          <a href={`mailto:${BRAND.email}`} style={{ textDecoration: "underline" }}>
            {BRAND.email}
          </a>{" "}
          ·{" "}
          <a href={BRAND.website} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            {BRAND.website.replace("https://", "")}
          </a>
        </div>
      </footer>
    </div>
  );
}
