"use client";

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
  Table,
  Textarea,
  useToast,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { ProductStatus } from "@domain/enums";
import type { Brand, Product } from "@domain/types";
import type { FailedImportRow } from "@services/index";
import { useActiveBrand } from "../../_components/BrandContext";

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

interface ProductForm {
  brandId: string;
  productId: string;
  namaProduk: string;
  kategori: string;
  hpp: string;
  hargaJual: string;
  status: ProductStatus;
}

interface ImportResult {
  created: Product[];
  failed: FailedImportRow[];
  total: number;
}

interface PendingAction {
  product: Product;
}

const EMPTY_FORM: ProductForm = {
  brandId: "",
  productId: "",
  namaProduk: "",
  kategori: "",
  hpp: "",
  hargaJual: "",
  status: ProductStatus.Active,
};

const STATUS_OPTIONS = [
  { label: "Active", value: ProductStatus.Active },
  { label: "Inactive", value: ProductStatus.Inactive },
  { label: "Archived", value: ProductStatus.Archived },
];

type FormMode = "create" | "edit";

function currency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

function productFormFromProduct(product: Product): ProductForm {
  return {
    brandId: product.brandId,
    productId: product.productId,
    namaProduk: product.namaProduk,
    kategori: product.kategori,
    hpp: String(product.hpp),
    hargaJual: String(product.hargaJual),
    status: product.status,
  };
}

function productPayload(form: ProductForm) {
  return {
    brandId: form.brandId,
    productId: form.productId.trim(),
    namaProduk: form.namaProduk.trim(),
    kategori: form.kategori.trim(),
    hpp: Number(form.hpp),
    hargaJual: Number(form.hargaJual),
    status: form.status,
  };
}

export function ProductMasterView() {
  const toast = useToast();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const fieldPrefix = useId();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const activeApiBrandId = useMemo(
    () => resolveActiveBrandId(brands, activeBrandId),
    [brands, activeBrandId],
  );

  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brands) {
      map.set(brand.id, brand.displayName);
    }
    return map;
  }, [brands]);

  const brandOptions = useMemo(
    () =>
      brands.map((brand) => ({
        label: brand.displayName,
        value: brand.id,
      })),
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
      if (keyword.trim()) params.set("keyword", keyword.trim());
      const loadedProducts = await readJson<Product[]>(
        await fetch(`/api/products?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setBrands(loadedBrands);
      setProducts(loadedProducts);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Product Master.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, keyword]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingId(null);
    setForm({ ...EMPTY_FORM, brandId: activeApiBrandId });
    setFieldErrors({});
    setFormOpen(true);
  }, [activeApiBrandId]);

  const openEdit = useCallback((product: Product) => {
    setFormMode("edit");
    setEditingId(product.id);
    setForm(productFormFromProduct(product));
    setFieldErrors({});
    setFormOpen(true);
  }, []);

  const updateField = useCallback((key: keyof ProductForm, value: string) => {
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
      const response = await fetch(
        isEdit ? `/api/products/${editingId}` : "/api/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(productPayload(form)),
        },
      );
      const saved = isEdit
        ? await readJson<Product>(response)
        : (await readJson<{ product: Product; warning: string | null }>(
            response,
          )).product;
      toast.success(
        isEdit
          ? `Produk "${saved.namaProduk}" berhasil diperbarui.`
          : `Produk "${saved.namaProduk}" berhasil dibuat.`,
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
            : "Gagal menyimpan produk.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [editingId, form, formMode, loadData, toast]);

  const confirmAction = useCallback(async () => {
    if (!pending) return;
    setActionBusy(true);
    try {
      await readJson<Product>(
        await fetch(`/api/products/${pending.product.id}/archive`, {
          method: "POST",
        }),
      );
      toast.success(`Produk "${pending.product.namaProduk}" diarsipkan.`);
      setPending(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Gagal mengarsipkan produk.",
      );
      setPending(null);
    } finally {
      setActionBusy(false);
    }
  }, [loadData, pending, toast]);

  const downloadTemplate = useCallback(async () => {
    try {
      const response = await fetch("/api/products/import-template");
      if (!response.ok) {
        throw new ApiError(response.status, {});
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "product-import-template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh template impor.");
    }
  }, [toast]);

  const onImportFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const content = await file.text();
      setImportContent(content);
      setImportResult(null);
    },
    [],
  );

  const runImport = useCallback(async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await readJson<ImportResult>(
        await fetch("/api/products/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            brandId: activeApiBrandId,
            content: importContent,
          }),
        }),
      );
      setImportResult(result);
      toast.success(
        `Impor selesai: ${result.created.length} berhasil, ${result.failed.length} gagal.`,
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Gagal mengimpor produk.",
      );
    } finally {
      setImporting(false);
    }
  }, [activeApiBrandId, importContent, loadData, toast]);

  const columns = useMemo<TableColumn<Product>[]>(
    () => [
      {
        key: "brand",
        header: "Brand",
        render: (product) => brandNameById.get(product.brandId) ?? product.brandId,
      },
      {
        key: "productId",
        header: "Product ID",
        render: (product) => <span className="pms-mono">{product.productId}</span>,
      },
      {
        key: "namaProduk",
        header: "Nama Produk",
        render: (product) => product.namaProduk,
      },
      {
        key: "kategori",
        header: "Kategori",
        render: (product) => product.kategori,
      },
      {
        key: "hpp",
        header: "HPP",
        numeric: true,
        render: (product) => currency(product.hpp),
      },
      {
        key: "hargaJual",
        header: "Harga Jual",
        numeric: true,
        render: (product) => currency(product.hargaJual),
      },
      {
        key: "status",
        header: "Status",
        render: (product) => <StatusBadge status={product.status} />,
      },
      {
        key: "updatedAt",
        header: "Updated",
        render: (product) => dateTime(product.updatedAt),
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (product) => (
          <Stack direction="horizontal" gap="xs" justify="flex-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEdit(product)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={product.status === ProductStatus.Archived}
              onClick={() => setPending({ product })}
            >
              Arsipkan
            </Button>
          </Stack>
        ),
      },
    ],
    [brandNameById, openEdit],
  );

  const activeBrandLabel =
    brandNameById.get(activeApiBrandId) ?? activeBrand?.label ?? "Brand aktif";
  const isSearch = keyword.trim() !== "";

  const productIdId = `${fieldPrefix}-productId`;
  const namaProdukId = `${fieldPrefix}-namaProduk`;
  const kategoriId = `${fieldPrefix}-kategori`;
  const hppId = `${fieldPrefix}-hpp`;
  const hargaJualId = `${fieldPrefix}-hargaJual`;
  const statusId = `${fieldPrefix}-status`;
  const brandIdId = `${fieldPrefix}-brand`;

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <div>
          <h1 className="pms-page__title">Product Master</h1>
        </div>
        <Stack direction="horizontal" gap="sm" wrap>
          <Button variant="secondary" onClick={downloadTemplate}>
            Download Template
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button onClick={openCreate} disabled={!activeApiBrandId}>
            Add Product
          </Button>
        </Stack>
      </Stack>

      <Card>
        <Grid columns="minmax(220px, 420px) auto" gap="md" align="end">
          <Field label="Search" htmlFor={`${fieldPrefix}-search`}>
            <Input
              id={`${fieldPrefix}-search`}
              value={keyword}
              placeholder="Product ID atau Nama Produk"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </Field>
          <Stack direction="horizontal" gap="sm" wrap>
            <Button variant="secondary" onClick={() => void loadData()}>
              Refresh
            </Button>
            {isSearch && (
              <Button variant="ghost" onClick={() => setKeyword("")}>
                Reset
              </Button>
            )}
          </Stack>
        </Grid>
      </Card>

      <Card padding="none">
        {loading ? (
          <div style={{ padding: "var(--pms-space-md)" }}>
            <SkeletonTable rows={6} columns={9} />
          </div>
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat produk"
            description={loadError}
            actionLabel="Coba lagi"
            onAction={() => void loadData()}
          />
        ) : products.length === 0 ? (
          <EmptyState
            variant={isSearch ? "no-search-results" : "no-products"}
            onAction={isSearch ? () => setKeyword("") : openCreate}
            actionLabel={isSearch ? "Reset Search" : "Add Product"}
          />
        ) : (
          <Table
            columns={columns}
            data={products}
            rowKey={(product) => product.id}
            caption="Daftar Product Master"
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={formMode === "create" ? "Add Product" : "Edit Product"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setFormOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Field label="Brand" htmlFor={brandIdId} required error={fieldErrors.brandId}>
            <Select
              id={brandIdId}
              options={brandOptions}
              value={form.brandId}
              invalid={Boolean(fieldErrors.brandId)}
              onChange={(event) => updateField("brandId", event.target.value)}
            />
          </Field>
          <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
            <Field
              label="Product ID"
              htmlFor={productIdId}
              required
              error={fieldErrors.productId}
            >
              <Input
                id={productIdId}
                value={form.productId}
                invalid={Boolean(fieldErrors.productId)}
                onChange={(event) =>
                  updateField("productId", event.target.value)
                }
              />
            </Field>
            <Field
              label="Kategori"
              htmlFor={kategoriId}
              required
              error={fieldErrors.kategori}
            >
              <Input
                id={kategoriId}
                value={form.kategori}
                invalid={Boolean(fieldErrors.kategori)}
                onChange={(event) => updateField("kategori", event.target.value)}
              />
            </Field>
          </Grid>
          <Field
            label="Nama Produk"
            htmlFor={namaProdukId}
            required
            error={fieldErrors.namaProduk}
          >
            <Input
              id={namaProdukId}
              value={form.namaProduk}
              invalid={Boolean(fieldErrors.namaProduk)}
              onChange={(event) => updateField("namaProduk", event.target.value)}
            />
          </Field>
          <Grid columns="repeat(3, minmax(0, 1fr))" gap="md">
            <Field label="HPP" htmlFor={hppId} required error={fieldErrors.hpp}>
              <Input
                id={hppId}
                type="number"
                min="0"
                value={form.hpp}
                invalid={Boolean(fieldErrors.hpp)}
                onChange={(event) => updateField("hpp", event.target.value)}
              />
            </Field>
            <Field
              label="Harga Jual"
              htmlFor={hargaJualId}
              required
              error={fieldErrors.hargaJual}
            >
              <Input
                id={hargaJualId}
                type="number"
                min="0"
                value={form.hargaJual}
                invalid={Boolean(fieldErrors.hargaJual)}
                onChange={(event) =>
                  updateField("hargaJual", event.target.value)
                }
              />
            </Field>
            <Field
              label="Status"
              htmlFor={statusId}
              required
              error={fieldErrors.status}
            >
              <Select
                id={statusId}
                options={STATUS_OPTIONS}
                value={form.status}
                invalid={Boolean(fieldErrors.status)}
                onChange={(event) => updateField("status", event.target.value)}
              />
            </Field>
          </Grid>
        </Stack>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => !importing && setImportOpen(false)}
        title="Import Product Master"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Tutup
            </Button>
            <Button
              onClick={() => void runImport()}
              disabled={importing || importContent.trim() === "" || !activeApiBrandId}
            >
              {importing ? "Mengimpor..." : "Import"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <StatusBadge status={`Brand ${activeBrandLabel}`} tone="info" />
          <Field label="File CSV/TSV" htmlFor={`${fieldPrefix}-import-file`}>
            <Input
              id={`${fieldPrefix}-import-file`}
              type="file"
              accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file?.name.endsWith(".xlsx")) {
                  toast.error("Format Excel (.xlsx) belum didukung. Export ke CSV terlebih dahulu.");
                  event.target.value = "";
                  return;
                }
                void onImportFile(file);
              }}
            />
          </Field>
          <Field label="Preview / Paste CSV" htmlFor={`${fieldPrefix}-import-content`}>
            <Textarea
              id={`${fieldPrefix}-import-content`}
              rows={8}
              value={importContent}
              onChange={(event) => {
                setImportContent(event.target.value);
                setImportResult(null);
              }}
            />
          </Field>
          {importResult && (
            <Stack gap="sm">
              <div className="pms-import-summary">
                <StatusBadge status={`Total ${importResult.total}`} tone="info" />
                <StatusBadge
                  status={`Berhasil ${importResult.created.length}`}
                  tone="success"
                />
                <StatusBadge
                  status={`Gagal ${importResult.failed.length}`}
                  tone={importResult.failed.length > 0 ? "danger" : "neutral"}
                />
              </div>
              {importResult.failed.length > 0 && (
                <Table
                  columns={[
                    {
                      key: "row",
                      header: "Row",
                      render: (row) => row.row,
                      width: "72px",
                    },
                    {
                      key: "reason",
                      header: "Reason",
                      render: (row) => row.reason,
                    },
                    {
                      key: "fields",
                      header: "Fields",
                      render: (row) =>
                        row.fields
                          ? Object.entries(row.fields)
                              .map(([field, message]) => `${field}: ${message}`)
                              .join("; ")
                          : "-",
                    },
                  ]}
                  data={importResult.failed}
                  rowKey={(row) => row.row}
                  caption="Import validation feedback"
                />
              )}
            </Stack>
          )}
        </Stack>
      </Modal>

      <Modal
        open={pending !== null}
        onClose={() => !actionBusy && setPending(null)}
        title="Arsipkan Product"
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
              variant="primary"
              onClick={() => void confirmAction()}
              disabled={actionBusy}
            >
              {actionBusy ? "Memproses..." : "Arsipkan"}
            </Button>
          </>
        }
      >
        <p>
          Arsipkan produk <strong>{pending?.product.namaProduk}</strong>? Produk
          tetap tersimpan untuk riwayat dan pelaporan.
        </p>
      </Modal>
    </Stack>
  );
}
