import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export interface Tab {
  /** Unique key for the tab. */
  key: string;
  /** Visible label. */
  label: ReactNode;
  /** Content rendered when this tab is active. */
  content: ReactNode;
  /** Disable the tab. */
  disabled?: boolean;
}

export interface TabsProps {
  /** Tab definitions. */
  tabs: readonly Tab[];
  /** Currently active tab key. */
  activeKey: string;
  /** Called when a tab is selected. */
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Horizontal tab bar with lazy content rendering (only the active tab's
 * content is rendered). Controlled via `activeKey` / `onChange`.
 */
export function Tabs({
  tabs,
  activeKey,
  onChange,
  className,
}: TabsProps) {
  const active = tabs.find((t) => t.key === activeKey);

  return (
    <div className={cx("pms-tabs", className)}>
      <div className="pms-tabs__bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeKey}
            disabled={tab.disabled}
            className={cx(
              "pms-tabs__tab",
              tab.key === activeKey && "pms-tabs__tab--active",
            )}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="pms-tabs__panel" role="tabpanel">
          {active.content}
        </div>
      )}
    </div>
  );
}
