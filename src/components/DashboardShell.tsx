"use client";

import { useEffect, useState } from "react";
import { Sidebar, type SidebarNavItem } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { IconMenu } from "./icons";

const COLLAPSE_KEY = "uat-sidebar-collapsed";

export function DashboardShell({
  items,
  name,
  email,
  children,
}: {
  items: SidebarNavItem[];
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="app-shell">
      <Sidebar
        variant="desktop"
        items={items}
        name={name}
        email={email}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <Sidebar
        variant="mobile"
        items={items}
        name={name}
        email={email}
        collapsed={false}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="topbar-slim">
          <button className="icon-btn hamburger-btn" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <IconMenu />
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 64px" }}>{children}</main>
      </div>
    </div>
  );
}
