"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Breakpoints match what's already in globals.css — 880px is the
 * sidebar's own desktop/mobile cutoff, 640px is a typical phone width.
 * Keep any new breakpoint here in sync with a matching @media rule
 * instead of inventing a third number for the same cutoff.
 */
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 880,
} as const;

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface Responsive {
  device: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Coarse pointer + no hover — a touchscreen, roughly, regardless of its size (a tablet in landscape is still "mobile-shaped" input-wise). */
  isTouch: boolean;
}

/**
 * Auto-detects device class from viewport width (not user-agent sniffing,
 * which lies under device emulation and in app webviews) and re-renders
 * on resize/orientation change. Use this to pick between two genuinely
 * different layouts (e.g. a card list vs. a table); for "just let this
 * wrap or scroll," prefer the plain CSS in RESPONSIVE.md — reserve this
 * hook for layout decisions CSS alone can't express.
 */
export function useResponsive(): Responsive {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);
  const isTabletOrBelow = useMediaQuery(`(max-width: ${BREAKPOINTS.tablet}px)`);
  const isTouch = useMediaQuery("(hover: none) and (pointer: coarse)");

  const device: DeviceType = isMobile ? "mobile" : isTabletOrBelow ? "tablet" : "desktop";

  return {
    device,
    isMobile,
    isTablet: isTabletOrBelow && !isMobile,
    isDesktop: !isTabletOrBelow,
    isTouch,
  };
}
