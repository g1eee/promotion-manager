"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  SkeletonCard,
  Stack,
  StatusBadge,
} from "@ui/components";
import type {
  DashboardSummary,
  RecentApprovalActivity,
  RecentCampaignActivity,
  RecentPromoActivity,
} from "@services/index";
import { useActiveBrand } from "../_components/BrandContext";

interface ApiErrorBody {
  readonly message?: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? "Terjadi kesalahan.");
    this.name = "ApiError";
  }
}

type MetricTone = "info" | "warning" | "success" | "danger" | "neutral";

interface MetricCardProps {
  readonly label: string;
  readonly value: number;
  readonly caption: string;
  readonly tone: MetricTone;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function number(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function dateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function metricCard({
  label,
  value,
  caption,
  tone,
}: MetricCardProps) {
  return (
    <Card className={`pms-dashboard-metric pms-dashboard-metric--${tone}`}>
      <span className="pms-dashboard-metric__label">{label}</span>
      <strong className="pms-dashboard-metric__value">{number(value)}</strong>
      <span className="pms-dashboard-metric__caption">{caption}</span>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      <div className="pms-dashboard__metrics" aria-label="Memuat metrik dashboard">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} lines={2} label="Memuat widget dashboard" />
        ))}
      </div>
      <div className="pms-dashboard__split">
        <SkeletonCard lines={4} label="Memuat work queue" />
        <SkeletonCard lines={4} label="Memuat ringkasan historis" />
      </div>
      <div className="pms-dashboard__recent-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonCard key={index} lines={4} label="Memuat recent activity" />
        ))}
      </div>
    </Stack>
  );
}

function RecentCampaigns({
  campaigns,
}: {
  readonly campaigns: readonly RecentCampaignActivity[];
}) {
  return (
    <Card title="Recent Campaigns" subtitle="Campaign terbaru">
      {campaigns.length === 0 ? (
        <p className="pms-dashboard-empty">Belum ada campaign.</p>
      ) : (
        <div className="pms-dashboard-list">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="pms-dashboard-list__item">
              <div className="pms-dashboard-list__main">
                <strong>{campaign.name}</strong>
                <span>
                  {campaign.brandName} · {number(campaign.promoCount)} promo ·{" "}
                  {dateTime(campaign.occurredAt)}
                </span>
              </div>
              <StatusBadge status={campaign.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentPromos({
  promos,
}: {
  readonly promos: readonly RecentPromoActivity[];
}) {
  return (
    <Card title="Recent Promos" subtitle="Promo terbaru">
      {promos.length === 0 ? (
        <p className="pms-dashboard-empty">Belum ada promo.</p>
      ) : (
        <div className="pms-dashboard-list">
          {promos.map((promo) => (
            <div key={promo.id} className="pms-dashboard-list__item">
              <div className="pms-dashboard-list__main">
                <strong>{promo.name}</strong>
                <span>
                  {promo.campaignName} · {promo.promoType} ·{" "}
                  {number(promo.productCount)} produk
                </span>
              </div>
              <StatusBadge status={promo.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentApprovals({
  approvals,
}: {
  readonly approvals: readonly RecentApprovalActivity[];
}) {
  return (
    <Card title="Recent Approvals" subtitle="Approval terbaru">
      {approvals.length === 0 ? (
        <p className="pms-dashboard-empty">Belum ada approval.</p>
      ) : (
        <div className="pms-dashboard-list">
          {approvals.map((approval) => (
            <div key={approval.id} className="pms-dashboard-list__item">
              <div className="pms-dashboard-list__main">
                <strong>{approval.promoName}</strong>
                <span>
                  {approval.campaignName} · {dateTime(approval.occurredAt)}
                </span>
              </div>
              <StatusBadge status={approval.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function DashboardView() {
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      params.set("limit", "5");
      const loaded = await readJson<DashboardSummary>(
        await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setSummary(loaded);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat Dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeBrandLabel = useMemo(
    () => summary?.brandName ?? activeBrand?.label ?? activeBrandId,
    [activeBrand?.label, activeBrandId, summary?.brandName],
  );

  return (
    <Stack gap="lg" className="pms-dashboard">
      <div className="pms-dashboard__header">
        <div>
          <h1 className="pms-page__title">Dashboard</h1>
          <p className="pms-dashboard__scope">Brand {activeBrandLabel}</p>
        </div>
        {summary && !loading ? (
          <StatusBadge
            status={`Updated ${dateTime(summary.recomputedAt)}`}
            tone="info"
          />
        ) : null}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : loadError ? (
        <EmptyState
          title="Gagal memuat Dashboard"
          description={loadError}
          actionLabel="Refresh"
          onAction={() => void loadDashboard()}
        />
      ) : summary ? (
        <>
          <section aria-labelledby="dashboard-actionable-heading">
            <Stack gap="md">
              <h2
                id="dashboard-actionable-heading"
                className="pms-dashboard__section-title"
              >
                Perlu Aksi
              </h2>
              <div className="pms-dashboard__metrics">
                {metricCard({
                  label: "Promo Pending Review",
                  value: summary.widgets.pendingReviewPromos,
                  caption: "Status Review",
                  tone: "warning",
                })}
                {metricCard({
                  label: "Waiting for Execution",
                  value: summary.widgets.waitingForExecutionPromos,
                  caption: "Approved belum Completed",
                  tone: "info",
                })}
                {metricCard({
                  label: "Active Promos",
                  value: summary.widgets.activePromos,
                  caption: "Sedang berjalan",
                  tone: "success",
                })}
                {metricCard({
                  label: "Completed Promos",
                  value: summary.widgets.completedPromos,
                  caption: "Selesai",
                  tone: "neutral",
                })}
              </div>
            </Stack>
          </section>

          <div className="pms-dashboard__split">
            <Card title="Work Queue" subtitle="Antrian kerja personal">
              <div className="pms-dashboard-queue">
                <div className="pms-dashboard-queue__item">
                  <span>Pending Reviews</span>
                  <strong>{number(summary.workQueue.pendingReviews)}</strong>
                </div>
                <div className="pms-dashboard-queue__item">
                  <span>Rejected Promos</span>
                  <strong>{number(summary.workQueue.rejectedPromos)}</strong>
                </div>
                <div className="pms-dashboard-queue__item">
                  <span>Unread Feedback</span>
                  <strong>{number(summary.workQueue.unreadFeedback)}</strong>
                </div>
                <div className="pms-dashboard-queue__item">
                  <span>Waiting for Execution</span>
                  <strong>{number(summary.workQueue.waitingForExecution)}</strong>
                </div>
              </div>
            </Card>

            <Card title="Ringkasan Historis" subtitle="Snapshot data terkini">
              <div className="pms-dashboard-history">
                <div>
                  <span>Total Campaign</span>
                  <strong>{number(summary.widgets.totalCampaigns)}</strong>
                </div>
                <div>
                  <span>Total Promo</span>
                  <strong>{number(summary.widgets.totalPromos)}</strong>
                </div>
                <div className="pms-dashboard-history__statuses">
                  <StatusBadge status={`Draft ${summary.widgets.draftPromos}`} />
                  <StatusBadge status={`Review ${summary.widgets.reviewPromos}`} tone="info" />
                  <StatusBadge status={`Approved ${summary.widgets.approvedPromos}`} tone="success" />
                  <StatusBadge status={`Rejected ${summary.widgets.rejectedPromos}`} tone="danger" />
                </div>
              </div>
            </Card>
          </div>

          <section aria-labelledby="dashboard-recent-heading">
            <Stack gap="md">
              <h2
                id="dashboard-recent-heading"
                className="pms-dashboard__section-title"
              >
                Recent Activity
              </h2>
              <div className="pms-dashboard__recent-grid">
                <RecentCampaigns
                  campaigns={summary.recentActivity.campaigns}
                />
                <RecentPromos promos={summary.recentActivity.promos} />
                <RecentApprovals
                  approvals={summary.recentActivity.approvals}
                />
              </div>
            </Stack>
          </section>
        </>
      ) : null}
    </Stack>
  );
}
