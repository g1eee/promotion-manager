"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import type { ApprovalHistoryItem } from "@services/approval-history-service";
import { useActiveBrand } from "../../_components/BrandContext";

interface ApiErrorBody {
  message?: string;
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

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasActiveFilters(filters: FilterState): boolean {
  return filters.dateTo !== "";
}

export function ApprovalHistoryView() {
  const { activeBrandId, activeBrand } = useActiveBrand();
  const dateFromField = useId();
  const dateToField = useId();

  const [items, setItems] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    dateFrom: threeMonthsAgo(),
    dateTo: "",
  });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const loaded = await readJson<ApprovalHistoryItem[]>(
        await fetch(`/api/promos/approval-history?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setItems(loaded);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Approval History.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, filters]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ dateFrom: threeMonthsAgo(), dateTo: "" });
  }, []);

  const filtersActive = hasActiveFilters(filters);

  const columns = useMemo<TableColumn<ApprovalHistoryItem>[]>(
    () => [
      {
        key: "promo",
        header: "Nama Promo",
        render: (item) => <strong>{item.promoName}</strong>,
      },
      { key: "campaign", header: "Campaign", render: (item) => item.campaignName },
      {
        key: "changedAt",
        header: "Tanggal Approval",
        render: (item) => formatDateTime(item.changedAt),
      },
      {
        key: "status",
        header: "Status Approval",
        render: (item) => <StatusBadge status={item.status} />,
      },
    ],
    [],
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Approval History"
        subtitle={`Riwayat perubahan status approval promo untuk Brand ${activeBrand?.label ?? activeBrandId}.`}
        rightContent={<StatusBadge status={`${items.length} Catatan`} tone="info" />}
      />

      <Card title="Filter Tanggal">
        <Stack direction="horizontal" gap="md" align="end" wrap>
          <Field htmlFor={dateFromField} label="Dari">
            <Input
              id={dateFromField}
              type="date"
              value={filters.dateFrom}
              min={threeMonthsAgo()}
              max={today()}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field htmlFor={dateToField} label="Sampai">
            <Input
              id={dateToField}
              type="date"
              value={filters.dateTo}
              min={threeMonthsAgo()}
              max={today()}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={!filtersActive}
            onClick={resetFilters}
          >
            Reset Filter
          </Button>
        </Stack>
        <p className="pms-muted" style={{ marginTop: "var(--pms-space-sm)", fontSize: "var(--pms-font-size-xs)" }}>
          Riwayat hanya tersedia untuk 3 bulan terakhir.
        </p>
      </Card>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} columns={4} />
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Approval History"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadHistory()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Belum ada riwayat approval"
            description="Setiap perubahan status approval promo akan tercatat di sini."
          />
        ) : (
          <Table
            columns={columns}
            data={items}
            rowKey={(item) => item.id}
            caption="Riwayat approval promo"
          />
        )}
      </Card>
    </Stack>
  );
}
