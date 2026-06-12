"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { CampaignStatus } from "@domain/enums";
import type { CampaignHistoryItem } from "@services/campaign-history-service";
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

interface FilterState {
  status: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  status: "",
  dateFrom: "",
  dateTo: "",
};

const STATUS_OPTIONS = Object.values(CampaignStatus).map((value) => ({
  label: value,
  value,
}));

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.status !== "" || filters.dateFrom !== "" || filters.dateTo !== ""
  );
}

export function CampaignHistoryView() {
  const { activeBrandId, activeBrand } = useActiveBrand();
  const statusField = useId();
  const dateFromField = useId();
  const dateToField = useId();

  const [items, setItems] = useState<CampaignHistoryItem[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      if (filters.status) params.set("status", filters.status);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const loaded = await readJson<CampaignHistoryItem[]>(
        await fetch(`/api/campaigns/history?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setItems(loaded);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Campaign History.",
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
    setFilters(EMPTY_FILTERS);
  }, []);

  const filtersActive = hasActiveFilters(filters);

  const columns = useMemo<TableColumn<CampaignHistoryItem>[]>(
    () => [
      {
        key: "nama",
        header: "Nama Campaign",
        render: (item) => <strong>{item.nama}</strong>,
      },
      { key: "brand", header: "Brand", render: (item) => item.brandName },
      {
        key: "createdAt",
        header: "Tanggal Dibuat",
        render: (item) => formatDate(item.createdAt),
      },
      {
        key: "running",
        header: "Tanggal Berjalan",
        render: (item) =>
          `${formatDate(item.tanggalMulai)} – ${formatDate(item.tanggalSelesai)}`,
      },
      {
        key: "promoCount",
        header: "Jumlah Promo",
        render: (item) => `${item.promoCount} promo`,
      },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge status={item.status} />,
      },
    ],
    [],
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Campaign History"
        subtitle={`Riwayat seluruh campaign untuk Brand ${activeBrand?.label ?? activeBrandId}.`}
        rightContent={<StatusBadge status={`${items.length} Campaign`} tone="info" />}
      />

      <Card title="Filter">
        <Stack direction="horizontal" gap="md" align="end" wrap>
          <Field htmlFor={statusField} label="Status">
            <Select
              id={statusField}
              placeholder="Semua Status"
              options={STATUS_OPTIONS}
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            />
          </Field>
          <Field htmlFor={dateFromField} label="Tanggal Dibuat (Dari)">
            <Input
              id={dateFromField}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field htmlFor={dateToField} label="Tanggal Dibuat (Sampai)">
            <Input
              id={dateToField}
              type="date"
              value={filters.dateTo}
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
      </Card>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Campaign History"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadHistory()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            variant="no-campaigns"
            title={filtersActive ? "Tidak ada campaign cocok" : undefined}
            description={
              filtersActive
                ? "Tidak ada campaign yang memenuhi filter. Coba ubah atau reset filter."
                : undefined
            }
            actionLabel={filtersActive ? "Reset Filter" : undefined}
            onAction={filtersActive ? resetFilters : undefined}
          />
        ) : (
          <Table
            columns={columns}
            data={items}
            rowKey={(item) => item.id}
            caption="Riwayat campaign"
          />
        )}
      </Card>
    </Stack>
  );
}
