"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
  useToast,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { BrandStatus } from "@domain/enums";
import type { Brand } from "@domain/types";

/**
 * Brand Management screen (Settings → Brand Management, Task 5.3).
 *
 * Lists every Brand and exposes the full lifecycle actions required by
 * Requirement 19:
 *   - Create (19.1) with duplicate Brand ID feedback (19.3 → 19.2).
 *   - Edit (19.3) that persists only when validation passes; field errors keep
 *     the modal open so nothing is saved on invalid input (19.4).
 *   - Archive (19.7) — a non-destructive status change.
 *   - Delete (19.5) with reference protection (19.6): a Brand that still owns a
 *     Product/Campaign/Promo is rejected and the user is guided toward Archive.
 *
 * Data is read/written through the `/api/brands` Route Handlers; the in-memory
 * container seeds the sample Brands (Kalova/Chanira/AMK/ATRIA, Req 19.9).
 *
 * The component depends on a {@link useToast} provider supplied by the page
 * wrapper, so it can be unit-tested in isolation by rendering it under a
 * `ToastProvider`.
 */

/** Shape of the structured error body returned by the API error mapper. */
interface ApiErrorBody {
  errorType?: string;
  message?: string;
  fields?: Record<string, string>;
}

/** A typed error carrying the parsed API error body and HTTP status. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? "Terjadi kesalahan.");
    this.name = "ApiError";
  }
}

/** Parse a `fetch` Response, throwing {@link ApiError} on a non-2xx status. */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

/** Editable Brand form fields (mirrors {@link CreateBrandInput}). */
interface BrandForm {
  brandId: string;
  brandName: string;
  displayName: string;
  status: BrandStatus;
}

const EMPTY_FORM: BrandForm = {
  brandId: "",
  brandName: "",
  displayName: "",
  status: BrandStatus.Active,
};

const STATUS_OPTIONS = [
  { label: "Active", value: BrandStatus.Active },
  { label: "Archived", value: BrandStatus.Archived },
];

type FormMode = "create" | "edit";

/** A Brand pending a confirmation action (archive or delete). */
interface PendingAction {
  kind: "archive" | "delete";
  brand: Brand;
}

export function BrandManagementView() {
  const toast = useToast();
  const fieldIdPrefix = useId();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create/Edit modal state.
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Confirmation (archive/delete) state.
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await readJson<Brand[]>(await fetch("/api/brands"));
      setBrands(data);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Gagal memuat daftar Brand.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((brand: Brand) => {
    setFormMode("edit");
    setEditingId(brand.id);
    setForm({
      brandId: brand.brandId,
      brandName: brand.brandName,
      displayName: brand.displayName,
      status: brand.status,
    });
    setFieldErrors({});
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    if (submitting) return;
    setFormOpen(false);
  }, [submitting]);

  const updateField = useCallback(
    (key: keyof BrandForm, value: string) => {
      setForm((current) => ({ ...current, [key]: value }));
      // Clear the per-field error as the user edits it.
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const submitForm = useCallback(async () => {
    setSubmitting(true);
    setFieldErrors({});

    const payload = {
      brandId: form.brandId.trim(),
      brandName: form.brandName.trim(),
      displayName: form.displayName.trim(),
      status: form.status,
    };

    const isEdit = formMode === "edit" && editingId !== null;
    const url = isEdit ? `/api/brands/${editingId}` : "/api/brands";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const saved = await readJson<Brand>(
        await fetch(url, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      toast.success(
        isEdit
          ? `Brand "${saved.displayName}" berhasil diperbarui.`
          : `Brand "${saved.displayName}" berhasil dibuat.`,
      );
      setFormOpen(false);
      await loadBrands();
    } catch (error) {
      // Validation errors (incl. duplicate Brand ID, Req 19.2/19.3) surface as
      // inline field messages so the modal stays open and nothing is saved.
      if (error instanceof ApiError && error.status === 422 && error.body.fields) {
        setFieldErrors(error.body.fields);
        if (error.body.message) {
          toast.error(error.body.message);
        }
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : "Gagal menyimpan Brand.";
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, formMode, editingId, loadBrands, toast]);

  const confirmAction = useCallback(async () => {
    if (!pending) return;
    setActionBusy(true);
    const { kind, brand } = pending;
    try {
      if (kind === "archive") {
        await readJson<Brand>(
          await fetch(`/api/brands/${brand.id}/archive`, { method: "POST" }),
        );
        toast.success(`Brand "${brand.displayName}" telah diarsipkan.`);
      } else {
        await readJson<{ ok: true }>(
          await fetch(`/api/brands/${brand.id}`, { method: "DELETE" }),
        );
        toast.success(`Brand "${brand.displayName}" telah dihapus.`);
      }
      setPending(null);
      await loadBrands();
    } catch (error) {
      // Reference protection (Req 19.6): a delete on a Brand that still owns
      // related data is rejected (409); guide the user toward Archive instead.
      const message =
        error instanceof ApiError
          ? error.message
          : kind === "archive"
            ? "Gagal mengarsipkan Brand."
            : "Gagal menghapus Brand.";
      toast.error(message);
      setPending(null);
    } finally {
      setActionBusy(false);
    }
  }, [pending, loadBrands, toast]);

  const columns = useMemo<TableColumn<Brand>[]>(
    () => [
      {
        key: "brandId",
        header: "Brand ID",
        render: (brand) => <span className="pms-mono">{brand.brandId}</span>,
      },
      { key: "brandName", header: "Brand Name", render: (brand) => brand.brandName },
      {
        key: "displayName",
        header: "Display Name",
        render: (brand) => brand.displayName,
      },
      {
        key: "status",
        header: "Status",
        render: (brand) => <StatusBadge status={brand.status} />,
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (brand) => (
          <Stack direction="horizontal" gap="xs" justify="flex-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEdit(brand)}
              aria-label={`Edit Brand ${brand.displayName}`}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPending({ kind: "archive", brand })}
              aria-label={`Arsipkan Brand ${brand.displayName}`}
              disabled={brand.status === BrandStatus.Archived}
            >
              Arsipkan
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setPending({ kind: "delete", brand })}
              aria-label={`Hapus Brand ${brand.displayName}`}
            >
              Hapus
            </Button>
          </Stack>
        ),
      },
    ],
    [openEdit],
  );

  const brandIdFieldId = `${fieldIdPrefix}-brandId`;
  const brandNameFieldId = `${fieldIdPrefix}-brandName`;
  const displayNameFieldId = `${fieldIdPrefix}-displayName`;
  const statusFieldId = `${fieldIdPrefix}-status`;

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <h1 className="pms-page__title">Brand Management</h1>
        <Button onClick={openCreate}>Buat Brand</Button>
      </Stack>

      <Card padding="none">
        {loading ? (
          <div style={{ padding: "var(--pms-space-md)" }}>
            <SkeletonTable rows={4} columns={5} />
          </div>
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Brand"
            description={loadError}
            actionLabel="Coba lagi"
            onAction={() => void loadBrands()}
          />
        ) : brands.length === 0 ? (
          <EmptyState
            title="Belum ada Brand"
            description="Mulai dengan membuat Brand pertama untuk menjalankan operasi multi-brand."
            actionLabel="Buat Brand"
            onAction={openCreate}
          />
        ) : (
          <Table
            columns={columns}
            data={brands}
            rowKey={(brand) => brand.id}
            caption="Daftar Brand"
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={formMode === "create" ? "Buat Brand" : "Edit Brand"}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Field
            htmlFor={brandIdFieldId}
            label="Brand ID"
            required
            error={fieldErrors.brandId}
            helpText="Identifier unik global untuk Brand."
          >
            <Input
              id={brandIdFieldId}
              value={form.brandId}
              invalid={Boolean(fieldErrors.brandId)}
              onChange={(event) => updateField("brandId", event.target.value)}
            />
          </Field>
          <Field
            htmlFor={brandNameFieldId}
            label="Brand Name"
            required
            error={fieldErrors.brandName}
          >
            <Input
              id={brandNameFieldId}
              value={form.brandName}
              invalid={Boolean(fieldErrors.brandName)}
              onChange={(event) => updateField("brandName", event.target.value)}
            />
          </Field>
          <Field
            htmlFor={displayNameFieldId}
            label="Display Name"
            required
            error={fieldErrors.displayName}
          >
            <Input
              id={displayNameFieldId}
              value={form.displayName}
              invalid={Boolean(fieldErrors.displayName)}
              onChange={(event) =>
                updateField("displayName", event.target.value)
              }
            />
          </Field>
          <Field
            htmlFor={statusFieldId}
            label="Status"
            required
            error={fieldErrors.status}
          >
            <Select
              id={statusFieldId}
              options={STATUS_OPTIONS}
              value={form.status}
              invalid={Boolean(fieldErrors.status)}
              onChange={(event) => updateField("status", event.target.value)}
            />
          </Field>
        </Stack>
      </Modal>

      <Modal
        open={pending !== null}
        onClose={() => !actionBusy && setPending(null)}
        title={pending?.kind === "archive" ? "Arsipkan Brand" : "Hapus Brand"}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPending(null)}
              disabled={actionBusy}
            >
              Batal
            </Button>
            <Button
              variant={pending?.kind === "delete" ? "danger" : "primary"}
              onClick={() => void confirmAction()}
              disabled={actionBusy}
            >
              {actionBusy
                ? "Memproses..."
                : pending?.kind === "archive"
                  ? "Arsipkan"
                  : "Hapus"}
            </Button>
          </>
        }
      >
        {pending?.kind === "archive" ? (
          <p>
            Arsipkan Brand <strong>{pending.brand.displayName}</strong>? Data
            Brand tetap tersimpan dan dapat dipulihkan dengan mengubah statusnya
            kembali ke Active.
          </p>
        ) : (
          <p>
            Hapus Brand <strong>{pending?.brand.displayName}</strong> secara
            permanen? Jika Brand masih memiliki Product, Campaign, atau Promo
            terkait, penghapusan akan ditolak — arsipkan Brand sebagai gantinya.
          </p>
        )}
      </Modal>
    </Stack>
  );
}
