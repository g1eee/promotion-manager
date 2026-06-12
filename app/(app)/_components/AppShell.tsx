"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "@ui/utils/cx";

const STORAGE_KEY = "pms.sidebarCollapsed";

export interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Client shell wrapper that owns the collapsible-sidebar state.
 *
 * Renders the persistent top bar + sidebar + content grid and a toggle that
 * collapses the sidebar to an icon rail. The choice is sticky per browser via
 * localStorage. Sidebar/TopBar stay presentation-only so their unit tests
 * remain isolated.
 */
export function AppShell({ topBar, sidebar, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Restore the sticky preference after mount (keeps SSR markup deterministic).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      // localStorage unavailable; ignore.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // best-effort persistence.
      }
      return next;
    });
  }, []);

  return (
    <div className={cx("pms-shell", collapsed && "pms-shell--collapsed")}>
      {topBar}
      <div className="pms-shell__sidebar-wrap">
        <button
          type="button"
          className="pms-shell__sidebar-toggle"
          aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
          aria-pressed={collapsed}
          onClick={toggle}
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
        </button>
        {sidebar}
      </div>
      <main className="pms-shell__content" id="main-content">
        {children}
      </main>
    </div>
  );
}
