"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Grid,
  Input,
  Modal,
  Select,
  SkeletonTable,
  Stack,
  StatusBadge,
  useToast,
} from "@ui/components";
import { CampaignStatus } from "@domain/enums";
import type { Brand, Campaign } from "@domain/types";
import { useActiveBrand } from "../../_components/BrandContext";

interface CampaignRow extends Campaign {
  promoCount: number;
}

interface ApiErrorBody {
  errorType?: string;
  message?: string;
  fields?: Record<string, string>;
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

interface CampaignForm {
  brandId: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  status: CampaignStatus;
}

const EMPTY_FORM: CampaignForm = {
  brandId: "",
  nama: "",
  tanggalMulai: "",
  tanggalSelesai: "",
  status: CampaignStatus.Draft,
};

const STATUS_OPTIONS = [
  { label: "Draft", value: CampaignStatus.Draft },
  { label: "Active", value: CampaignStatus.Active },
  { label: "Completed", value: CampaignStatus.Completed },
  { label: "Archived", value: CampaignStatus.Archived },
];

type FormMode = "create" | "edit";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveActiveBrandId(
  brands: readonly Brand[],
  activeBrandId: string,
): string {
  const normalized = normalizeKey(activeBrandId);
  const match = brands.find((brand) => {
    const brandId = normalizeKey(brand.brandId);
    const displayName = normalizeKey(brand.displayName);
    const brandName = normalizeKey(brand.brandName);
    const surrogateId = normalizeKey(brand.id);
    return (
      surrogateId === normalized ||
      brandId === normalized ||
      displayName === normalized ||
      brandName === normalized ||
      surrogateId.endsWith(`-${normalized}`)
    );
  });
  return match?.id ?? brands[0]?.id ?? "";
}

function toDateInput(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formFromCampaign(campaign: CampaignRow): CampaignForm {
  return {
    brandId: campaign.brandId,
    nama: campaign.nama,
    tanggalMulai: toDateInput(campaign.tanggalMulai),
    tanggalSelesai: toDateInput(campaign.tanggalSelesai),
    status: campaign.status,
  };
}

function payloadFromForm(form: CampaignForm, includeStatus: boolean) {
  return {
    brandId: form.brandId,
    nama: form.nama.trim(),
    tanggalMulai: form.tanggalMulai,
    tanggalSelesai: form.tanggalSelesai,
    ...(includeStatus ? { status: form.status } : {}),
  };
}

export function CampaignsView() {
  const toast = useToast();
  const { activeBrandId } = useActiveBrand();
  const fieldPrefix = useId();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<CampaignRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  const activeApiBrandId = useMemo(
    () => resolveActiveBrandId(brands, activeBrandId),
    [brands, activeBrandId],
  );

  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brands) map.set(brand.id, brand.displayName);
    return map;
  }, [brands]);

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ label: brand.displayName, value: brand.id })),
    [brands],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loadedBrands = await readJson<Brand[]>(
        await fetch("/api/brands", { cache: "no-store" }),
      );
      const brandId = resolveActiveBrandId(loadedBrands, activeBrandId);
      const params = new URLSearchParams();
      if (brandId) params.set("brandId", brandId);
      const loadedCampaigns = await readJson<CampaignRow[]>(
        await fetch(`/api/campaigns?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setBrands(loadedBrands);
      setCampaigns(loadedCampaigns);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat Campaign.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFormMode("create");
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      brandId: activeApiBrandId,
      tanggalMulai: today,
      tanggalSelesai: today,
    });
    setFieldErrors({});
    setFormOpen(true);
  }, [activeApiBrandId]);

  const openEdit = useCallback((campaign: CampaignRow) => {
    setFormMode("edit");
    setEditingId(campaign.id);
    setForm(formFromCampaign(campaign));
    setFieldErrors({});
    setFormOpen(true);
  }, []);

  const updateField = useCallback((key: keyof CampaignForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const submitForm = useCallback(async () => {
    setSubmitting(true);
    setFieldErrors({});
    const isEdit = formMode === "edit" && editingId !== null;
    try {
      const saved = await readJson<CampaignRow>(
        await fetch(isEdit ? `/api/campaigns/${editingId}` : "/api/campaigns", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payloadFromForm(form, isEdit)),
        }),
      );
      toast.success(
        isEdit
          ? `Campaign "${saved.nama}" berhasil diperbarui.`
          : `Campaign "${saved.nama}" berhasil dibuat.`,
      );
      setFormOpen(false);
      await loadData();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.body.fields) {
        setFieldErrors(error.body.fields);
        if (error.body.message) toast.error(error.body.message);
      } else {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal menyimpan Campaign.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [editingId, form, formMode, loadData, toast]);

  const confirmArchive = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await readJson<CampaignRow>(
        await fetch(`/api/campaigns/${archiveTarget.id}/archive`, {
          method: "POST",
        }),
      );
      toast.success(`Campaign "${archiveTarget.nama}" diarsipkan.`);
      setArchiveTarget(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Gagal mengarsipkan Campaign.",
      );
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, loadData, toast]);

  const brandIdField = `${fieldPrefix}-brand`;
  const namaField = `${fieldPrefix}-nama`;
  const startField = `${fieldPrefix}-mulai`;
  const endField = `${fieldPrefix}-selesai`;
  const statusField = `${fieldPrefix}-status`;

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <h1 className="pms-page__title">Campaigns</h1>
        <Button onClick={openCreate} disabled={!activeApiBrandId}>
          Add Campaign
        </Button>
      </Stack>

      <Card padding="none">
        {loading ? (
          <div style={{ padding: "var(--pms-space-md)" }}>
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Campaign"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadData()}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            variant="no-campaigns"
            actionLabel="Add Campaign"
            onAction={openCreate}
          />
        ) : (
          <div className="pms-cards-grid">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="pms-project-card">
                <div className="pms-project-card__head">
                  <span className="pms-project-card__brand">
                    {brandNameById.get(campaign.brandId) ?? campaign.brandId}
                  </span>
                  <StatusBadge status={campaign.status} />
                </div>
                <Link
                  href={`/promo/campaigns/${campaign.id}`}
                  className="pms-project-card__title"
                >
                  {campaign.nama}
                </Link>
                <div className="pms-project-card__dates">
                  {formatDate(campaign.tanggalMulai)} –{" "}
                  {formatDate(campaign.tanggalSelesai)}
                </div>
                <div className="pms-project-card__stats">
                  <span>
                    <strong>{campaign.promoCount}</strong> promo
                  </span>
                </div>
                <div className="pms-project-card__actions">
                  <Link
                    href={`/promo/campaigns/${campaign.id}`}
                    className="pms-link-btn"
                  >
                    View
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEdit(campaign)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={campaign.status === CampaignStatus.Archived}
                    onClick={() => setArchiveTarget(campaign)}
                  >
                    Arsipkan
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={formMode === "create" ? "Add Campaign" : "Edit Campaign"}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setFormOpen(false)}
            >
              Batal
            </Button>
            <Button disabled={submitting} onClick={() => void submitForm()}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Field
            htmlFor={brandIdField}
            label="Brand"
            required
            error={fieldErrors.brandId}
          >
            <Select
              id={brandIdField}
              options={brandOptions}
              value={form.brandId}
              invalid={Boolean(fieldErrors.brandId)}
              onChange={(event) => updateField("brandId", event.target.value)}
            />
          </Field>
          <Field
            htmlFor={namaField}
            label="Nama Campaign"
            required
            error={fieldErrors.nama}
          >
            <Input
              id={namaField}
              value={form.nama}
              invalid={Boolean(fieldErrors.nama)}
              onChange={(event) => updateField("nama", event.target.value)}
            />
          </Field>
          <Grid columns="repeat(3, minmax(0, 1fr))" gap="md">
            <Field
              htmlFor={startField}
              label="Tanggal Mulai"
              required
              error={fieldErrors.tanggalMulai}
            >
              <Input
                id={startField}
                type="date"
                value={form.tanggalMulai}
                invalid={Boolean(fieldErrors.tanggalMulai)}
                onChange={(event) =>
                  updateField("tanggalMulai", event.target.value)
                }
              />
            </Field>
            <Field
              htmlFor={endField}
              label="Tanggal Selesai"
              required
              error={fieldErrors.tanggalSelesai}
            >
              <Input
                id={endField}
                type="date"
                value={form.tanggalSelesai}
                invalid={Boolean(fieldErrors.tanggalSelesai)}
                onChange={(event) =>
                  updateField("tanggalSelesai", event.target.value)
                }
              />
            </Field>
            <Field
              htmlFor={statusField}
              label="Status"
              required
              error={fieldErrors.status}
            >
              <Select
                id={statusField}
                options={STATUS_OPTIONS}
                value={form.status}
                disabled={formMode === "create"}
                invalid={Boolean(fieldErrors.status)}
                onChange={(event) => updateField("status", event.target.value)}
              />
            </Field>
          </Grid>
        </Stack>
      </Modal>

      <Modal
        open={archiveTarget !== null}
        onClose={() => !archiving && setArchiveTarget(null)}
        title="Arsipkan Campaign"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={archiving}
              onClick={() => setArchiveTarget(null)}
            >
              Batal
            </Button>
            <Button disabled={archiving} onClick={() => void confirmArchive()}>
              {archiving ? "Memproses..." : "Arsipkan"}
            </Button>
          </>
        }
      >
        <p>
          Arsipkan Campaign <strong>{archiveTarget?.nama}</strong>? Riwayat dan
          promo terkait tetap tersimpan.
        </p>
      </Modal>
    </Stack>
  );
}
