"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  EmptyState,
  SkeletonCard,
  Stack,
  StatusBadge,
} from "@ui/components";
import type {
  ActiveCampaignCard,
  DashboardSummary,
  RecentApprovalActivity,
  RecentCampaignActivity,
  RecentPromoActivity,
} from "@services/index";
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  CircleDot,
  MessageSquare,
  Rocket,
  Tag as Tag2,
  TriangleAlert,
} from "lucide-react";
import { useActiveBrand } from "../_components/BrandContext";
import { CampaignCalendar } from "./CampaignCalendar";

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

function timeOfDay(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(
    new Date(value),
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

function endsLabel(daysUntilEnd: number): string {
  if (daysUntilEnd < 0) return "Sudah berakhir";
  if (daysUntilEnd === 0) return "Berakhir hari ini";
  if (daysUntilEnd === 1) return "Berakhir besok";
  return `Berakhir ${daysUntilEnd} hari lagi`;
}

function DashboardSkeleton() {
  return (
    <Stack gap="lg">
      <SkeletonCard lines={3} label="Memuat ringkasan" />
      <SkeletonCard lines={1} label="Memuat antrian" />
      <div className="pms-cc__layout">
        <div className="pms-cc__main">
          <SkeletonCard lines={4} label="Memuat aktivitas" />
        </div>
        <div className="pms-cc__rail">
          <SkeletonCard lines={5} label="Memuat kalender" />
          <SkeletonCard lines={3} label="Memuat campaign" />
        </div>
      </div>
    </Stack>
  );
}

function HeroSummary({
  summary,
  brandLabel,
}: {
  readonly summary: DashboardSummary;
  readonly brandLabel: string;
}) {
  const needsReview = summary.workQueue.pendingReviews;
  const startingSoon = summary.upcomingPromos.length;
  const activeCampaigns = summary.activeCampaigns.length;

  return (
    <section className="pms-cc-hero">
      <div className="pms-cc-hero__main">
        <p className="pms-cc-hero__eyebrow">Brand {brandLabel}</p>
        <h1 className="pms-cc-hero__title">{greeting()}, mari kelola promo 👋</h1>
        <p className="pms-cc-hero__lead">
          {needsReview > 0 ? (
            <strong>{needsReview} promo perlu direview</strong>
          ) : (
            <span>Tidak ada promo menunggu review</span>
          )}
          <span className="pms-cc-hero__dot">•</span>
          {startingSoon} promo mulai dalam 7 hari
          <span className="pms-cc-hero__dot">•</span>
          {activeCampaigns} campaign aktif
        </p>
      </div>
      <div className="pms-cc-hero__actions">
        <Link href="/promo/scenarios" className="pms-btn pms-btn--primary pms-btn--md">
          <Rocket size={16} aria-hidden="true" /> Buat Promo
        </Link>
        <Link href="/promo/execution" className="pms-btn pms-btn--secondary pms-btn--md">
          Buka Antrian
        </Link>
      </div>
    </section>
  );
}

interface ActionBlock {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly tone: "review" | "execution" | "rejected" | "feedback";
  readonly icon: typeof CircleDot;
}

function ActionCenter({
  summary,
}: {
  readonly summary: DashboardSummary;
}) {
  const blocks: ActionBlock[] = [
    {
      key: "review",
      label: "Pending Review",
      count: summary.workQueue.pendingReviews,
      tone: "review",
      icon: CircleDot,
    },
    {
      key: "execution",
      label: "Waiting Execution",
      count: summary.workQueue.waitingForExecution,
      tone: "execution",
      icon: Rocket,
    },
    {
      key: "rejected",
      label: "Rejected Promo",
      count: summary.workQueue.rejectedPromos,
      tone: "rejected",
      icon: TriangleAlert,
    },
    {
      key: "feedback",
      label: "Unread Feedback",
      count: summary.workQueue.unreadFeedback,
      tone: "feedback",
      icon: MessageSquare,
    },
  ];

  return (
    <section className="pms-cc-kpi" aria-label="Needs Attention">
      <span className="pms-cc-kpi__heading">Needs Attention</span>
      <div className="pms-cc-kpi__items">
        {blocks.map((block) => {
          const Icon = block.icon;
          return (
            <div
              key={block.key}
              className={`pms-cc-kpi__item pms-cc-kpi__item--${block.tone}`}
            >
              <span className="pms-cc-kpi__icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <strong className="pms-cc-kpi__count">
                {number(block.count)}
              </strong>
              <span className="pms-cc-kpi__label">{block.label}</span>
            </div>
          );
        })}
      </div>
      <Link href="/promo/execution" className="pms-cc-kpi__link">
        Buka Antrian <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}

function ActiveCampaigns({
  campaigns,
}: {
  readonly campaigns: readonly ActiveCampaignCard[];
}) {
  return (
    <Card title="Active Campaigns" subtitle="Sedang berjalan">
      {campaigns.length === 0 ? (
        <p className="pms-cc-empty">Belum ada campaign aktif.</p>
      ) : (
        <ul className="pms-cc-active">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="pms-cc-active__item">
              <div className="pms-cc-active__head">
                <Link
                  href={`/promo/campaigns/${campaign.id}`}
                  className="pms-cc-active__name"
                >
                  {campaign.name}
                </Link>
                <StatusBadge status={campaign.status} />
              </div>
              <div className="pms-cc-active__progress">
                <div
                  className="pms-cc-active__bar"
                  style={{ width: `${campaign.progress}%` }}
                />
              </div>
              <div className="pms-cc-active__meta">
                <span>{campaign.progress}%</span>
                <span>{number(campaign.promoCount)} promo</span>
                <span>{endsLabel(campaign.daysUntilEnd)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type ActivityItem = {
  readonly id: string;
  readonly at: Date;
  readonly icon: typeof CircleCheck;
  readonly text: string;
};

function buildActivityFeed(summary: DashboardSummary): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const c of summary.recentActivity.campaigns as RecentCampaignActivity[]) {
    items.push({
      id: `c-${c.id}`,
      at: new Date(c.occurredAt),
      icon: CalendarClock,
      text: `Campaign "${c.name}" diperbarui`,
    });
  }
  for (const p of summary.recentActivity.promos as RecentPromoActivity[]) {
    items.push({
      id: `p-${p.id}`,
      at: new Date(p.occurredAt),
      icon: Tag2,
      text: `Promo "${p.name}" diperbarui (${p.status})`,
    });
  }
  for (const a of summary.recentActivity.approvals as RecentApprovalActivity[]) {
    items.push({
      id: `a-${a.id}`,
      at: new Date(a.occurredAt),
      icon: CircleCheck,
      text: `${a.promoName} → ${a.status}`,
    });
  }
  return items.sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, 8);
}

function RecentActivity({
  summary,
}: {
  readonly summary: DashboardSummary;
}) {
  const items = useMemo(() => buildActivityFeed(summary), [summary]);
  return (
    <Card title="Recent Activity" subtitle="Aktivitas terbaru">
      {items.length === 0 ? (
        <p className="pms-cc-empty">Belum ada aktivitas.</p>
      ) : (
        <ul className="pms-cc-feed">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="pms-cc-feed__item">
                <span className="pms-cc-feed__time">{timeOfDay(item.at)}</span>
                <span className="pms-cc-feed__icon">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="pms-cc-feed__text">{item.text}</span>
              </li>
            );
          })}
        </ul>
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

  const brandLabel = useMemo(
    () => summary?.brandName ?? activeBrand?.label ?? activeBrandId,
    [activeBrand?.label, activeBrandId, summary?.brandName],
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (loadError) {
    return (
      <EmptyState
        title="Gagal memuat Dashboard"
        description={loadError}
        actionLabel="Refresh"
        onAction={() => void loadDashboard()}
      />
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Stack gap="lg" className="pms-cc">
      <HeroSummary summary={summary} brandLabel={brandLabel} />

      <ActionCenter summary={summary} />

      <div className="pms-cc__layout">
        <div className="pms-cc__main">
          <RecentActivity summary={summary} />
        </div>

        <aside className="pms-cc__rail">
          <ActiveCampaigns campaigns={summary.activeCampaigns} />
          <Card title="Kalender Campaign" subtitle="Jadwal bulanan" padding="none">
            <CampaignCalendar campaigns={summary.calendarCampaigns} />
          </Card>
        </aside>
      </div>
    </Stack>
  );
}
