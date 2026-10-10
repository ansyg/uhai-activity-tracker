"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // The root layout's inline script already applied data-theme before paint
    // (so it's consistent across every page, not just ones with this button) —
    // read that back rather than recomputing it, so the two can't disagree.
    const applied = document.documentElement.getAttribute("data-theme") as Theme | null;
    setTheme(applied ?? (systemPrefersDark() ? "dark" : "light"));
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("uat-theme", next);
  }

  if (!mounted) return <span className="icon-btn" aria-hidden style={{ visibility: "hidden" }} />;

  return (
    <button className="icon-btn" aria-label="Toggle color theme" onClick={toggle}>
      {theme === "dark" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5a8.5 8.5 0 1 0 11.2 11.2Z" />
        </svg>
      )}
    </button>
  );
}
