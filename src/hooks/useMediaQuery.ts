"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether a CSS media query currently matches, re-evaluating on
 * resize/orientation change. Starts `false` (matches SSR, which has no
 * window) and syncs to the real value on mount — components reading it
 * should accept a brief "desktop-shaped" first render on the client
 * rather than trying to guess the viewport before paint.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
