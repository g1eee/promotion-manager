"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  EmptyState,
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

export function ApprovalHistoryView() {
  const { activeBrandId, activeBrand } = useActiveBrand();
  const [items, setItems] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeBrandId) params.set("brandId", activeBrandId);
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
  }, [activeBrandId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <div>
          <h1 className="pms-page__title">Approval History</h1>
          <p className="pms-muted">
            Riwayat perubahan status approval promo untuk Brand{" "}
            {activeBrand?.label ?? activeBrandId}.
          </p>
        </div>
        <StatusBadge status={`${items.length} Catatan`} tone="info" />
      </Stack>

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
