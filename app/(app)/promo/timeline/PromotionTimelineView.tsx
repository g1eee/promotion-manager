"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  EmptyState,
  Field,
  PageHeader,
  Select,
  SkeletonCard,
  Stack,
  StatusBadge,
} from "@ui/components";
import type { DashboardSummary, UpcomingPromo } from "@services/index";
import { CalendarClock } from "lucide-react";
import { useActiveBrand } from "../../_components/BrandContext";

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

const WINDOW_OPTIONS = [
  { label: "7 hari ke depan", value: "7" },
  { label: "14 hari ke depan", value: "14" },
  { label: "30 hari ke depan", value: "30" },
  { label: "60 hari ke depan", value: "60" },
  { label: "90 hari ke depan", value: "90" },
];

const DEFAULT_WINDOW = "30";

function startsLabel(daysUntilStart: number): string {
  if (daysUntilStart <= 0) return "Mulai hari ini";
  if (daysUntilStart === 1) return "Mulai besok";
  return `Mulai ${daysUntilStart} hari lagi`;
}

function dayKey(value: Date | string): string {
  return new Date(value).toDateString();
}

function dayHeading(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

interface DayGroup {
  readonly key: string;
  readonly date: Date;
  readonly promos: readonly UpcomingPromo[];
}

/** Group upcoming promos by their start day, soonest day first. */
function groupByDay(promos: readonly UpcomingPromo[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const promo of promos) {
    const key = dayKey(promo.startsAt);
    const existing = groups.get(key);
    if (existing) {
      (existing.promos as UpcomingPromo[]).push(promo);
    } else {
      groups.set(key, {
        key,
        date: new Date(promo.startsAt),
        promos: [promo],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

export function PromotionTimelineView() {
  const { activeBrandId, activeBrand } = useActiveBrand();
  const windowField = useId();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [windowDays, setWindowDays] = useState<string>(DEFAULT_WINDOW);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      params.set("upcomingWindowDays", windowDays);
      const loaded = await readJson<DashboardSummary>(
        await fetch(`/api/dashboard?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setSummary(loaded);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat Timeline.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, windowDays]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const groups = useMemo(
    () => groupByDay(summary?.upcomingPromos ?? []),
    [summary],
  );

  const total = summary?.upcomingPromos.length ?? 0;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Promotion Timeline"
        subtitle={`Jadwal promo yang akan datang untuk Brand ${summary?.brandName ?? activeBrand?.label ?? activeBrandId}.`}
        rightContent={<StatusBadge status={`${total} Promo`} tone="info" />}
      />

      <Card title="Rentang Waktu">
        <Stack direction="horizontal" gap="md" wrap>
          <Field htmlFor={windowField} label="Tampilkan promo dalam">
            <Select
              id={windowField}
              options={WINDOW_OPTIONS}
              value={windowDays}
              onChange={(event) => setWindowDays(event.target.value)}
            />
          </Field>
        </Stack>
      </Card>

      {loading ? (
        <SkeletonCard lines={6} label="Memuat timeline" />
      ) : loadError ? (
        <EmptyState
          title="Gagal memuat Timeline"
          description={loadError}
          actionLabel="Refresh"
          onAction={() => void loadTimeline()}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          variant="no-promos"
          title="Tidak ada promo akan datang"
          description="Belum ada promo yang dijadwalkan dalam rentang waktu ini."
        />
      ) : (
        <Stack gap="md">
          {groups.map((group) => (
            <Card key={group.key}>
              <Stack gap="sm">
                <div className="pms-timeline-day">
                  <CalendarClock size={16} aria-hidden="true" />
                  <span className="pms-timeline-day__label">
                    {dayHeading(group.date)}
                  </span>
                  <span className="pms-timeline-day__count">
                    {group.promos.length} promo
                  </span>
                </div>
                <ul className="pms-timeline-list">
                  {group.promos.map((promo) => (
                    <li key={promo.id} className="pms-timeline-list__item">
                      <div className="pms-timeline-list__body">
                        <Link
                          href={`/promo/scenarios?editPromoId=${encodeURIComponent(promo.id)}`}
                          className="pms-timeline-list__name"
                        >
                          {promo.name}
                        </Link>
                        <span className="pms-timeline-list__meta">
                          {promo.campaignName} · {promo.promoType} · {promo.brandName}
                        </span>
                      </div>
                      <StatusBadge status={promo.status} />
                      <span className="pms-timeline-list__when">
                        {startsLabel(promo.daysUntilStart)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
