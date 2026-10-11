import { z } from "zod";

const SAFE_HREF_PATTERN = /^\/(?!\/)[A-Za-z0-9._~\-/]*$/;

/**
 * A Menu.href is attacker-reachable by anyone holding roles_permissions:MANAGE
 * and gets rendered in a <Link> for every user who holds that menu's :VIEW
 * grant — so it must be a same-origin absolute path, never a javascript:/data:
 * URI or an off-site "//host" redirect.
 */
export const safeHref = z
  .string()
  .max(300)
  .regex(SAFE_HREF_PATTERN, "Must be an absolute same-origin path starting with a single \"/\" (e.g. \"/admin/reports\").");

/** Same rule as a plain predicate, for defensively re-checking a value that's already in the database before rendering it in a <Link>. */
export function isSafeHref(href: string): boolean {
  return href.length <= 300 && SAFE_HREF_PATTERN.test(href);
}
