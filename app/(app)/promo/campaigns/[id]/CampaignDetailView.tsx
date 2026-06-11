"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  SkeletonCard,
  Stack,
  StatusBadge,
  Table,
  useToast,
} from "@ui/components";
import type { ButtonVariant, TableColumn } from "@ui/components";
import { PromoStatus } from "@domain/enums";
import type { Brand, Campaign, PromoScenario } from "@domain/types";

interface ApprovalAction {
  readonly label: string;
  readonly status: PromoStatus;
  readonly variant: ButtonVariant;
}

interface CampaignDetailPayload {
  campaign: Campaign & { promoCount: number };
  promos: PromoScenario[];
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

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

async function changeApprovalStatusRequest(
  promoId: string,
  status: PromoStatus,
): Promise<PromoScenario> {
  return readJson<PromoScenario>(
    await fetch(`/api/promos/${promoId}/approval`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

function approvalActionsFor(promo: PromoScenario): ApprovalAction[] {
  switch (promo.status) {
    case PromoStatus.Draft:
    case PromoStatus.Rejected:
      return [
        {
          label: "Submit for Review",
          status: PromoStatus.Review,
          variant: "primary",
        },
      ];
    case PromoStatus.Review:
      return [
        { label: "Approve", status: PromoStatus.Approved, variant: "primary" },
        { label: "Reject", status: PromoStatus.Rejected, variant: "danger" },
      ];
    default:
      return [];
  }
}

function approvalSubmitKey(promoId: string, status: PromoStatus): string {
  return `${promoId}:${status}`;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<CampaignDetailPayload | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cloneSubmitting, setCloneSubmitting] = useState<string | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState<string | null>(
    null,
  );

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedBrands, loadedDetail] = await Promise.all([
        readJson<Brand[]>(await fetch("/api/brands", { cache: "no-store" })),
        readJson<CampaignDetailPayload>(
          await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" }),
        ),
      ]);
      setBrands(loadedBrands);
      setDetail(loadedDetail);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Campaign.",
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brands) map.set(brand.id, brand.displayName);
    return map;
  }, [brands]);

  const clonePromo = useCallback(
    async (promo: PromoScenario) => {
      setCloneSubmitting(promo.id);
      try {
        const cloned = await readJson<PromoScenario>(
          await fetch(`/api/promos/${promo.id}/clone`, { method: "POST" }),
        );
        setDetail((current) =>
          current
            ? {
                campaign: {
                  ...current.campaign,
                  promoCount: current.campaign.promoCount + 1,
                },
                promos: [cloned, ...current.promos],
              }
            : current,
        );
        const params = new URLSearchParams({
          brandId: cloned.brandId,
          campaignId: cloned.campaignId,
          editPromoId: cloned.id,
        });
        router.push(`/promo/scenarios?${params.toString()}`);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal clone Promo.",
        );
      } finally {
        setCloneSubmitting(null);
      }
    },
    [router, toast],
  );

  const changeApprovalStatus = useCallback(
    async (promo: PromoScenario, status: PromoStatus) => {
      const submitKey = approvalSubmitKey(promo.id, status);
      setApprovalSubmitting(submitKey);
      try {
        const saved = await changeApprovalStatusRequest(promo.id, status);
        setDetail((current) =>
          current
            ? {
                ...current,
                promos: current.promos.map((candidate) =>
                  candidate.id === saved.id ? saved : candidate,
                ),
              }
            : current,
        );
        toast.success(`Status "${saved.namaPromo}" menjadi ${saved.status}.`);
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal mengubah status approval.",
        );
      } finally {
        setApprovalSubmitting(null);
      }
    },
    [toast],
  );

  const columns = useMemo<TableColumn<PromoScenario>[]>(
    () => [
      {
        key: "namaPromo",
        header: "Promo",
        render: (promo) => promo.namaPromo,
      },
      {
        key: "promoType",
        header: "Promo Type",
        render: (promo) => promo.promoType,
      },
      {
        key: "date",
        header: "Tanggal",
        render: (promo) =>
          `${formatDate(promo.tanggalMulai)} - ${formatDate(
            promo.tanggalSelesai,
          )}`,
      },
      {
        key: "products",
        header: "Produk",
        numeric: true,
        render: (promo) => promo.productRefs.length,
      },
      {
        key: "status",
        header: "Status",
        render: (promo) => <StatusBadge status={promo.status} />,
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (promo) => (
          <Stack direction="horizontal" justify="flex-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={cloneSubmitting === promo.id}
              onClick={() => void clonePromo(promo)}
            >
              {cloneSubmitting === promo.id ? "Cloning..." : "Clone"}
            </Button>
            {approvalActionsFor(promo).map((action) => {
              const submitKey = approvalSubmitKey(promo.id, action.status);
              return (
                <Button
                  key={action.status}
                  size="sm"
                  variant={action.variant}
                  disabled={approvalSubmitting !== null}
                  onClick={() => void changeApprovalStatus(promo, action.status)}
                >
                  {approvalSubmitting === submitKey
                    ? "Memproses..."
                    : action.label}
                </Button>
              );
            })}
          </Stack>
        ),
      },
    ],
    [approvalSubmitting, changeApprovalStatus, clonePromo, cloneSubmitting],
  );

  if (loading) {
    return (
      <Stack gap="lg">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </Stack>
    );
  }

  if (loadError || detail === null) {
    return (
      <Stack gap="lg">
        <h1 className="pms-page__title">Campaign Detail</h1>
        <Card>
          <EmptyState
            title="Gagal memuat Campaign"
            description={loadError ?? "Campaign tidak ditemukan."}
            actionLabel="Refresh"
            onAction={() => void loadDetail()}
          />
        </Card>
      </Stack>
    );
  }

  const { campaign, promos } = detail;
  const brandLabel = brandNameById.get(campaign.brandId) ?? campaign.brandId;
  const addPromoHref = `/promo/scenarios?campaignId=${encodeURIComponent(
    campaign.id,
  )}&brandId=${encodeURIComponent(campaign.brandId)}`;

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <div>
          <h1 className="pms-page__title">{campaign.nama}</h1>
        </div>
        <Stack direction="horizontal" gap="sm" align="center" wrap>
          <StatusBadge status={`Brand ${brandLabel}`} tone="info" />
          <StatusBadge status={campaign.status} />
          <Link href="/promo/campaigns" className="pms-link-btn">
            Back
          </Link>
          <Link href={addPromoHref} className="pms-link-btn">
            Add Promo
          </Link>
        </Stack>
      </Stack>

      <Card>
        <div className="pms-detail-grid">
          <div>
            <span className="pms-detail-label">Brand</span>
            <strong>{brandLabel}</strong>
          </div>
          <div>
            <span className="pms-detail-label">Tanggal Berjalan</span>
            <strong>
              {formatDate(campaign.tanggalMulai)} -{" "}
              {formatDate(campaign.tanggalSelesai)}
            </strong>
          </div>
          <div>
            <span className="pms-detail-label">Jumlah Promo</span>
            <strong>{campaign.promoCount}</strong>
          </div>
          <div>
            <span className="pms-detail-label">Updated</span>
            <strong>{formatDate(campaign.updatedAt)}</strong>
          </div>
        </div>
      </Card>

      <Card padding="none">
        {promos.length === 0 ? (
          <EmptyState
            variant="no-promos"
            action={
              <Link href={addPromoHref} className="pms-link-btn">
                Add Promo
              </Link>
            }
          />
        ) : (
          <Table
            columns={columns}
            data={promos}
            rowKey={(promo) => promo.id}
            caption="Promo dalam Campaign"
          />
        )}
      </Card>
    </Stack>
  );
}
