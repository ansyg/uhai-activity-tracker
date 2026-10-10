"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";
import { IconChevronDown, IconChevronsLeft, IconChevronsRight, IconClose, IconLogout } from "./icons";
import { api } from "@/lib/api/client";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Not rendered yet anywhere in the product — the row-flattening below already
   * supports it so a real submenu can be added later without reworking the notch
   * layout (ARCHITECTURE: nav is data-driven, same spirit as the RBAC Menu table). */
  children?: SidebarNavItem[];
}

interface SidebarProps {
  items: SidebarNavItem[];
  name: string;
  email: string;
  collapsed: boolean;
  variant: "desktop" | "mobile";
  mobileOpen?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

type Row =
  | { kind: "link"; href: string; label: string; icon: React.ReactNode; indent: boolean }
  | { kind: "group"; label: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void }
  | { kind: "avatar"; href: string; label: string; initials: string }
  | { kind: "action"; label: string; icon: React.ReactNode; onClick: () => void };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function isActiveHref(href: string, pathname: string) {
  return href === "/trackers" ? pathname.startsWith("/trackers") : pathname.startsWith(href);
}

export function Sidebar({ items, name, email, collapsed, variant, mobileOpen, onToggleCollapse, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function signOut() {
    await api.post("/api/auth/logout").catch(() => {});
    router.push("/sign-in");
    router.refresh();
  }

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const item of items) {
      if (item.children && item.children.length > 0) {
        const hasActiveChild = item.children.some((child) => isActiveHref(child.href, pathname));
        const isOpen = hasActiveChild || expanded.has(item.label);
        out.push({
          kind: "group",
          label: item.label,
          icon: item.icon,
          expanded: isOpen,
          onToggle: () =>
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(item.label)) next.delete(item.label);
              else next.add(item.label);
              return next;
            }),
        });
        if (isOpen) {
          for (const child of item.children) {
            out.push({ kind: "link", href: child.href, label: child.label, icon: child.icon, indent: true });
          }
        }
      } else {
        out.push({ kind: "link", href: item.href, label: item.label, icon: item.icon, indent: false });
      }
    }

    out.push({ kind: "avatar", href: "/account", label: name, initials: initials(name) || "?" });
    out.push({ kind: "action", label: "Logout", icon: <IconLogout size={16} />, onClick: signOut });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, pathname, expanded, name]);

  const activeIndex = rows.findIndex(
    (row) => (row.kind === "link" || row.kind === "avatar") && isActiveHref(row.href, pathname)
  );
  const before = activeIndex >= 0 ? rows.slice(0, activeIndex) : rows;
  const active = activeIndex >= 0 ? rows[activeIndex] : null;
  const after = activeIndex >= 0 ? rows.slice(activeIndex + 1) : [];

  function renderRow(row: Row, key: string) {
    if (row.kind === "link") {
      return (
        <Link key={key} href={row.href} className={`nav-row ${row.indent ? "nav-row-child" : ""}`} onClick={onClose}>
          {row.icon}
          {!collapsed && row.label}
        </Link>
      );
    }
    if (row.kind === "group") {
      return (
        <button key={key} type="button" className="nav-row nav-row-group" onClick={row.onToggle}>
          <span className="nav-row-group-label">
            {row.icon}
            {!collapsed && <span>{row.label}</span>}
          </span>
          <span className={`nav-row-chevron ${row.expanded ? "nav-row-chevron-open" : ""}`}>
            <IconChevronDown />
          </span>
        </button>
      );
    }
    if (row.kind === "avatar") {
      return (
        <Link key={key} href={row.href} className="nav-row" title={email} onClick={onClose}>
          <span className="avatar nav-row-avatar">{row.initials}</span>
          {!collapsed && row.label}
        </Link>
      );
    }
    return (
      <button key={key} type="button" className="nav-row" onClick={row.onClick}>
        {row.icon}
        {!collapsed && row.label}
      </button>
    );
  }

  const rootClass = [
    "sidebar",
    variant === "desktop" ? "sidebar-desktop" : "sidebar-mobile",
    collapsed ? "sidebar-collapsed" : "sidebar-expanded",
    mobileOpen ? "sidebar-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <nav className={rootClass}>
      <div className="sidebar-top">
        <Logo withWordmark={!collapsed} />
        {variant === "desktop" && !collapsed && (
          <button className="icon-btn sidebar-collapse-btn" aria-label="Collapse sidebar" onClick={onToggleCollapse}>
            <IconChevronsLeft />
          </button>
        )}
        {variant === "mobile" && (
          <button className="icon-btn sidebar-collapse-btn" aria-label="Close menu" onClick={onClose}>
            <IconClose />
          </button>
        )}
      </div>

      {variant === "desktop" && collapsed && (
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }}>
          <button className="icon-btn" aria-label="Expand sidebar" onClick={onToggleCollapse}>
            <IconChevronsRight size={15} />
          </button>
        </div>
      )}

      <div className="nav-stack">
        {before.length > 0 && (
          <div className={`nav-card ${active ? "nav-card-top" : "nav-card-solo"}`}>
            {before.map((row, i) => renderRow(row, `before-${i}`))}
          </div>
        )}

        {active && (active.kind === "link" || active.kind === "avatar") && (
          <div className="nav-active-wrap">
            {before.length > 0 && <span className="nav-notch nav-notch-top" />}
            <Link href={active.href} className="nav-active-row" onClick={onClose}>
              {active.kind === "link" ? (
                <span className="nav-active-icon">{active.icon}</span>
              ) : (
                <span className="avatar nav-row-avatar nav-active-avatar">{active.initials}</span>
              )}
              {!collapsed && active.label}
            </Link>
            {after.length > 0 && <span className="nav-notch nav-notch-bottom" />}
          </div>
        )}

        {after.length > 0 && (
          <div className={`nav-card ${active ? "nav-card-bottom" : "nav-card-solo"}`}>
            {after.map((row, i) => renderRow(row, `after-${i}`))}
          </div>
        )}
      </div>
    </nav>
  );
}
