"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  EmptyState,
  Select,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
  useToast,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { ExecutionStatus } from "@domain/enums";
import type { PromoScenario } from "@domain/types";
import { useActiveBrand } from "../../_components/BrandContext";

interface ApprovedPromoRow {
  readonly id: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly namaPromo: string;
  readonly promoType: string;
  readonly productCount: number;
  readonly approvedAt: string;
  readonly executionStatus: ExecutionStatus;
  readonly products: readonly {
    readonly productId: string;
    readonly namaProduk: string;
  }[];
}

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

const EXECUTION_OPTIONS = [
  { label: "Approved", value: ExecutionStatus.Approved },
  { label: "Sent to Admin", value: ExecutionStatus.SentToAdmin },
  { label: "Marketplace Setup", value: ExecutionStatus.MarketplaceSetup },
  { label: "Completed", value: ExecutionStatus.Completed },
];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function productSummary(row: ApprovedPromoRow): string {
  if (row.productCount === 0) {
    return "0 produk";
  }
  const visible = row.products
    .slice(0, 3)
    .map((product) => product.productId)
    .join(", ");
  const hidden = Math.max(row.productCount - row.products.length, 0);
  const more =
    row.productCount > row.products.length
      ? `, ${hidden} belum terhubung`
      : row.products.length > 3
        ? `, +${row.products.length - 3}`
        : "";
  return `${row.productCount} produk (${visible}${more})`;
}

export function PromoExecutionView() {
  const toast = useToast();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [rows, setRows] = useState<ApprovedPromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
      const loadedRows = await readJson<ApprovedPromoRow[]>(
        await fetch(`/api/execution?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setRows(loadedRows);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Promo Execution.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const updateExecutionStatus = useCallback(
    async (row: ApprovedPromoRow, status: ExecutionStatus) => {
      setUpdatingId(row.id);
      try {
        const updated = await readJson<PromoScenario>(
          await fetch(`/api/execution/${row.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status }),
          }),
        );
        setRows((current) =>
          current.map((candidate) =>
            candidate.id === row.id
              ? {
                  ...candidate,
                  executionStatus:
                    updated.executionStatus ?? ExecutionStatus.Approved,
                }
              : candidate,
          ),
        );
        toast.success(`Execution status "${row.namaPromo}" diperbarui.`);
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal memperbarui Execution Status.",
        );
      } finally {
        setUpdatingId(null);
      }
    },
    [toast],
  );

  const columns = useMemo<TableColumn<ApprovedPromoRow>[]>(
    () => [
      {
        key: "promo",
        header: "Promo",
        render: (row) => (
          <Stack gap="xs">
            <strong>{row.namaPromo}</strong>
            <span className="pms-muted">{row.promoType}</span>
          </Stack>
        ),
      },
      {
        key: "brand",
        header: "Brand",
        render: (row) => row.brandName,
      },
      {
        key: "campaign",
        header: "Campaign",
        render: (row) => row.campaignName,
      },
      {
        key: "products",
        header: "Produk",
        render: (row) => productSummary(row),
      },
      {
        key: "approvedAt",
        header: "Approved",
        render: (row) => formatDateTime(row.approvedAt),
      },
      {
        key: "executionStatus",
        header: "Execution Status",
        width: "220px",
        render: (row) => (
          <Select
            aria-label={`Execution status ${row.namaPromo}`}
            value={row.executionStatus}
            options={EXECUTION_OPTIONS}
            disabled={updatingId !== null}
            onChange={(event) =>
              void updateExecutionStatus(
                row,
                event.target.value as ExecutionStatus,
              )
            }
          />
        ),
      },
    ],
    [updateExecutionStatus, updatingId],
  );

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <h1 className="pms-page__title">Promo Execution</h1>
        <Stack direction="horizontal" align="center" wrap>
          <StatusBadge
            status={`Brand ${activeBrand?.label ?? activeBrandId}`}
            tone="info"
          />
          <StatusBadge status={`${rows.length} Approved`} tone="success" />
        </Stack>
      </Stack>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Promo Execution"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadRows()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="no-promos"
            title="Belum ada promo Approved"
            description="Promo yang sudah Approved akan muncul di board ini untuk setup marketplace."
          />
        ) : (
          <Table
            columns={columns}
            data={rows}
            rowKey={(row) => row.id}
            caption="Approved promos execution board"
          />
        )}
      </Card>
    </Stack>
  );
}
