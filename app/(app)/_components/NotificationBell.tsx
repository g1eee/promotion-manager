"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveBrand } from "./BrandContext";

interface WorkQueue {
  readonly pendingReviews: number;
  readonly rejectedPromos: number;
  readonly unreadFeedback: number;
  readonly waitingForExecution: number;
}

interface DashboardSummary {
  readonly workQueue: WorkQueue;
}

interface QueueItem {
  readonly label: string;
  readonly count: number;
}

/**
 * Top-bar notification bell — surfaces the personal Work Queue (Req 2.6/2.7)
 * as an at-a-glance indicator with a count badge and a dropdown breakdown.
 * Follows the active Brand context so the count matches the dashboard.
 */
export function NotificationBell() {
  const { activeBrandId } = useActiveBrand();
  const [queue, setQueue] = useState<WorkQueue | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      const response = await fetch(`/api/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as DashboardSummary;
      setQueue(data.workQueue);
    } catch {
      // Non-critical indicator; ignore fetch errors silently.
    }
  }, [activeBrandId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const total = queue
    ? queue.pendingReviews +
      queue.rejectedPromos +
      queue.unreadFeedback +
      queue.waitingForExecution
    : 0;

  const items: QueueItem[] = queue
    ? [
        { label: "Pending Reviews", count: queue.pendingReviews },
        { label: "Rejected Promos", count: queue.rejectedPromos },
        { label: "Unread Feedback", count: queue.unreadFeedback },
        { label: "Waiting for Execution", count: queue.waitingForExecution },
      ]
    : [];

  return (
    <div className="pms-notif" ref={rootRef}>
      <button
        type="button"
        className="pms-notif__button"
        aria-label={`Notifikasi — ${total} item perlu tindakan`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">🔔</span>
        {total > 0 && (
          <span className="pms-notif__badge">{total > 99 ? "99+" : total}</span>
        )}
      </button>

      {open && (
        <div className="pms-notif__panel" role="menu">
          <div className="pms-notif__panel-header">Work Queue</div>
          {items.length === 0 || total === 0 ? (
            <p className="pms-notif__empty">Tidak ada item yang perlu aksi.</p>
          ) : (
            <ul className="pms-notif__list">
              {items.map((item) => (
                <li key={item.label} className="pms-notif__item">
                  <span>{item.label}</span>
                  <strong
                    className={
                      item.count > 0 ? "pms-notif__count--active" : undefined
                    }
                  >
                    {item.count}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
