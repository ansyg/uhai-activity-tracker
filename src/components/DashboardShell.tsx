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
  subscriptionStatus,
  children,
}: {
  items: SidebarNavItem[];
  name: string;
  email: string;
  subscriptionStatus?: "PENDING" | "APPROVED" | "REJECTED";
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
        <main style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 28px 64px" }}>
          {subscriptionStatus === "PENDING" && (
            <div
              className="card"
              style={{ padding: "12px 18px", marginBottom: 20, borderColor: "var(--warning, #c9972c)" }}
            >
              <strong>Your account is awaiting approval.</strong>{" "}
              <span className="muted">
                A platform admin needs to approve your account before you can create a tracker, request to join one,
                or accept an invite.
              </span>
            </div>
          )}
          {subscriptionStatus === "REJECTED" && (
            <div className="card" style={{ padding: "12px 18px", marginBottom: 20, borderColor: "var(--danger)" }}>
              <strong>Your account request was declined.</strong>{" "}
              <span className="muted">Contact the platform owner if you think this is a mistake.</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
