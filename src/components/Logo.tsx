import Link from "next/link";
import { BRAND } from "@/lib/branding";

export function Logo({ withWordmark = true, href = "/trackers" }: { withWordmark?: boolean; href?: string }) {
  return (
    <Link href={href} className="logo-lockup">
      <span className="logo-mark" aria-hidden>
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
          <path
            d="M8 6v10.5a8 8 0 0 0 16 0V6"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="27" r="1.8" fill="currentColor" />
        </svg>
      </span>
      {withWordmark && (
        <span className="logo-text">
          <strong>{BRAND.shortName}</strong>
          <span>{BRAND.name}</span>
        </span>
      )}
    </Link>
  );
}
