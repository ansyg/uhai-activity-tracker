# Responsive conventions

Rules of thumb for this codebase, written down after the Trackers section
shipped with a table that silently clipped off-screen on phones instead
of scrolling. Apply these to every new page/component, not just ones that
"look like" they need it.

## Default to CSS, not JS

Most responsive behavior should need no device detection at all:

- **Flex rows that can overflow** (button groups, card metadata rows,
  anything with more than ~2 items): always set `flexWrap: "wrap"`.
  A row with 2 items today gets a 3rd item next month.
- **Any `<table>`**: never let its ancestor clip overflow. Wrap the
  `<table>` itself in its own `overflow-x: auto` container (use the
  `.table-scroll` utility class, or an inline
  `style={{ overflowX: "auto" }}` div) — keep `overflow: hidden` only on
  an *outer* card wrapper for rounded corners, never on the table's
  direct scrolling ancestor. Give the table a `minWidth` so columns stay
  legible instead of being crushed to illegibility.
- **Grids**: `repeat(auto-fill, minmax(Npx, 1fr))` collapses to one
  column on its own — prefer it over a fixed column count plus a media
  query.
- **Side gutters**: every page needs ≥16px of horizontal padding at any
  width; never let a fixed large padding (e.g. 40–48px) survive down to
  phone width — add a `@media (max-width: 600px)` override that reduces
  it, the same way `.report-sheet` does.

## Reach for `useResponsive` only when CSS can't decide

`src/hooks/useResponsive.ts` (`isMobile` / `isTablet` / `isDesktop` /
`isTouch`) is for genuinely different layouts or behavior per device —
e.g. rendering a card list instead of a table below a breakpoint, or
changing a drag-and-drop interaction to tap-to-select on touch. It is
**not** a substitute for the CSS rules above; reach for it only when the
two layouts are structurally different React, not just styled
differently.

## Before calling a page done

Resize the browser down to ~375px wide (or use the device toolbar) and
confirm:
1. Nothing clips — every table/wide element either reflows or scrolls
   on its own axis.
2. No horizontal scrollbar appears on the page body itself.
3. Every button row wraps instead of overflowing.
