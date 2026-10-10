import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { BRAND } from "@/lib/branding";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.shortName}` },
  description: BRAND.tagline,
};

// Applies the saved theme before first paint, on every page (not just ones that
// render ThemeToggle) — otherwise a choice made in the dashboard wouldn't carry
// over to /sign-in, and every page would flash the system-default theme first.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("uat-theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
