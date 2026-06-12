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
  useToast,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { PromoStatus, PromoType } from "@domain/enums";
import type { Brand, Campaign, PromoScenario } from "@domain/types";
import type { PromoHistoryItem } from "@services/promo-history-service";
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
  keyword: string;
  campaignId: string;
  promoType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  keyword: "",
  campaignId: "",
  promoType: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

const PROMO_TYPE_OPTIONS = Object.values(PromoType).map((value) => ({
  label: value,
  value,
}));

const STATUS_OPTIONS = Object.values(PromoStatus).map((value) => ({
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

/** Resolve the Global Brand Selector key to the API surrogate Brand id. */
function resolveBrandId(
  brands: readonly Brand[],
  key: string | undefined,
): string {
  if (!key) return "";
  const normalized = key.trim().toLowerCase();
  const match = brands.find((brand) => {
    const candidates = [
      brand.id,
      brand.brandId,
      brand.brandName,
      brand.displayName,
    ].map((value) => value.toLowerCase());
    return (
      candidates.includes(normalized) ||
      brand.id.toLowerCase().endsWith(`-${normalized}`)
    );
  });
  return match?.id ?? "";
}

function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.keyword.trim() !== "" ||
    filters.campaignId !== "" ||
    filters.promoType !== "" ||
    filters.status !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== ""
  );
}

export function PromoHistoryView() {
  const toast = useToast();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const keywordField = useId();
  const campaignField = useId();
  const promoTypeField = useId();
  const statusField = useId();
  const dateFromField = useId();
  const dateToField = useId();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [items, setItems] = useState<PromoHistoryItem[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cloneSubmitting, setCloneSubmitting] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loadedBrands = await readJson<Brand[]>(
        await fetch("/api/brands", { cache: "no-store" }),
      );
      const brandId = resolveBrandId(loadedBrands, activeBrandId);

      const campaignParams = new URLSearchParams();
      if (brandId) campaignParams.set("brandId", brandId);

      const historyParams = new URLSearchParams();
      if (brandId) historyParams.set("brandId", brandId);
      if (filters.keyword.trim() !== "")
        historyParams.set("keyword", filters.keyword.trim());
      if (filters.campaignId) historyParams.set("campaignId", filters.campaignId);
      if (filters.promoType) historyParams.set("promoType", filters.promoType);
      if (filters.status) historyParams.set("status", filters.status);
      if (filters.dateFrom) historyParams.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) historyParams.set("dateTo", filters.dateTo);

      const [loadedCampaigns, loadedItems] = await Promise.all([
        readJson<Campaign[]>(
          await fetch(`/api/campaigns?${campaignParams.toString()}`, {
            cache: "no-store",
          }),
        ),
        readJson<PromoHistoryItem[]>(
          await fetch(`/api/promos/history?${historyParams.toString()}`, {
            cache: "no-store",
          }),
        ),
      ]);

      setCampaigns(loadedCampaigns);
      setItems(loadedItems);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Promo History.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, filters]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const updateFilter = useCallback(
    (key: keyof FilterState, value: string) => {
      setFilters((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const clonePromo = useCallback(
    async (item: PromoHistoryItem) => {
      setCloneSubmitting(item.id);
      try {
        const cloned = await readJson<PromoScenario>(
          await fetch(`/api/promos/${item.id}/clone`, { method: "POST" }),
        );
        toast.success(`Draft "${cloned.namaPromo}" dibuat.`);
        // Open the cloned Draft in Promo Scenarios for adjustment (Task 12.3).
        window.location.assign(
          `/promo/scenarios?editPromoId=${encodeURIComponent(cloned.id)}`,
        );
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal clone Promo.",
        );
        setCloneSubmitting(null);
      }
    },
    [toast],
  );

  const campaignOptions = useMemo(
    () =>
      campaigns.map((campaign) => ({
        label: campaign.nama,
        value: campaign.id,
      })),
    [campaigns],
  );

  const filtersActive = hasActiveFilters(filters);

  const columns = useMemo<TableColumn<PromoHistoryItem>[]>(
    () => [
      {
        key: "promo",
        header: "Promo",
        render: (item) => (
          <Stack gap="xs">
            <strong>{item.namaPromo}</strong>
            <span className="pms-muted">{item.promoType}</span>
          </Stack>
        ),
      },
      { key: "brand", header: "Brand", render: (item) => item.brandName },
      {
        key: "campaign",
        header: "Campaign",
        render: (item) => item.campaignName,
      },
      {
        key: "products",
        header: "Jumlah Produk",
        render: (item) => `${item.productCount} produk`,
      },
      {
        key: "createdAt",
        header: "Tanggal Dibuat",
        render: (item) => formatDate(item.createdAt),
      },
      {
        key: "status",
        header: "Status",
        render: (item) => <StatusBadge status={item.status} />,
      },
      {
        key: "actions",
        header: "Aksi",
        width: "260px",
        render: (item) => (
          <Stack direction="horizontal" gap="xs" wrap>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.location.assign(
                  `/promo/scenarios?editPromoId=${encodeURIComponent(item.id)}`,
                )
              }
            >
              View
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.location.assign(
                  `/promo/scenarios?editPromoId=${encodeURIComponent(item.id)}`,
                )
              }
            >
              Edit
            </Button>
            <Button
              size="sm"
              disabled={cloneSubmitting === item.id}
              onClick={() => void clonePromo(item)}
            >
              {cloneSubmitting === item.id ? "Cloning..." : "Clone"}
            </Button>
          </Stack>
        ),
      },
    ],
    [clonePromo, cloneSubmitting],
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Promo History"
        subtitle={`Riwayat seluruh promo lintas campaign untuk Brand ${activeBrand?.label ?? activeBrandId}.`}
        rightContent={<StatusBadge status={`${items.length} Promo`} tone="info" />}
      />

      <Card title="Pencarian & Filter">
        <Stack gap="md">
          <Stack direction="horizontal" gap="md" wrap>
            <Field htmlFor={keywordField} label="Kata Kunci (Nama Promo)">
              <Input
                id={keywordField}
                value={filters.keyword}
                placeholder="Cari nama promo..."
                onChange={(event) => updateFilter("keyword", event.target.value)}
              />
            </Field>
            <Field htmlFor={campaignField} label="Campaign">
              <Select
                id={campaignField}
                placeholder="Semua Campaign"
                options={campaignOptions}
                value={filters.campaignId}
                onChange={(event) =>
                  updateFilter("campaignId", event.target.value)
                }
              />
            </Field>
            <Field htmlFor={promoTypeField} label="Promo Type">
              <Select
                id={promoTypeField}
                placeholder="Semua Tipe"
                options={PROMO_TYPE_OPTIONS}
                value={filters.promoType}
                onChange={(event) =>
                  updateFilter("promoType", event.target.value)
                }
              />
            </Field>
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
                onChange={(event) =>
                  updateFilter("dateFrom", event.target.value)
                }
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
          </Stack>
          <Stack direction="horizontal" gap="sm">
            <Button
              variant="secondary"
              disabled={!filtersActive}
              onClick={resetFilters}
            >
              Reset Filters
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Promo History"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadHistory()}
          />
        ) : items.length === 0 ? (
          filtersActive ? (
            <EmptyState
              variant="no-search-results"
              onAction={resetFilters}
            />
          ) : (
            <EmptyState
              variant="no-promos"
              title="Belum ada riwayat promo"
              description="Promo yang sudah dibuat akan muncul di riwayat lintas campaign ini."
            />
          )
        ) : (
          <Table
            columns={columns}
            data={items}
            rowKey={(item) => item.id}
            caption="Promo History lintas campaign"
          />
        )}
      </Card>
    </Stack>
  );
}
