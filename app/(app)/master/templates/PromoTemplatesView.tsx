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
import { BenefitType, PromoType } from "@domain/enums";
import type { PromoTemplate } from "@domain/types";

interface ApiErrorBody {
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

type FormMode = "create" | "edit";

interface TemplateForm {
  name: string;
  promoType: PromoType;
  minQuantity: string;
  benefitType: BenefitType;
  discountPercent: string;
  gift: string;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  promoType: PromoType.BuyXDiscount,
  minQuantity: "1",
  benefitType: BenefitType.DiscountPercent,
  discountPercent: "10",
  gift: "",
};

const PROMO_TYPE_OPTIONS = Object.values(PromoType).map((value) => ({
  label: value,
  value,
}));

const BENEFIT_OPTIONS = [
  { label: "Discount %", value: BenefitType.DiscountPercent },
  { label: "Free Gift", value: BenefitType.FreeGift },
];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function summarizeConfig(template: PromoTemplate): string {
  const rule = template.config.rules[0];
  if (!rule) return "Tanpa rule";
  if (rule.benefitType === BenefitType.FreeGift) {
    return `Min ${rule.minQuantity} → Free Gift${rule.gift ? ` (${rule.gift})` : ""}`;
  }
  return `Min ${rule.minQuantity} → Diskon ${rule.discountPercent ?? 0}%`;
}

function buildConfigPayload(form: TemplateForm) {
  const minQuantity = Number(form.minQuantity);
  if (form.benefitType === BenefitType.FreeGift) {
    return {
      rules: [
        {
          minQuantity,
          benefitType: BenefitType.FreeGift,
          discountPercent: null,
          gift: form.gift.trim() || "Free Gift",
        },
      ],
    };
  }
  return {
    rules: [
      {
        minQuantity,
        benefitType: BenefitType.DiscountPercent,
        discountPercent: Number(form.discountPercent),
        gift: null,
      },
    ],
  };
}

export function PromoTemplatesView() {
  const toast = useToast();
  const nameField = useId();
  const promoTypeField = useId();
  const minQtyField = useId();
  const benefitField = useId();
  const discountField = useId();
  const giftField = useId();

  const [templates, setTemplates] = useState<PromoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await readJson<PromoTemplate[]>(
        await fetch("/api/promo-templates", { cache: "no-store" }),
      );
      setTemplates(loaded);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Promo Templates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const updateField = useCallback(
    <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((template: PromoTemplate) => {
    const rule = template.config.rules[0];
    setFormMode("edit");
    setEditingId(template.id);
    setForm({
      name: template.name,
      promoType: template.promoType ?? PromoType.BuyXDiscount,
      minQuantity: String(rule?.minQuantity ?? 1),
      benefitType: rule?.benefitType ?? BenefitType.DiscountPercent,
      discountPercent: String(rule?.discountPercent ?? 10),
      gift: rule?.gift ?? "",
    });
    setFormOpen(true);
  }, []);

  const submitForm = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        promoType: form.promoType,
        config: buildConfigPayload(form),
      };
      const isEdit = formMode === "edit" && editingId !== null;
      const saved = await readJson<PromoTemplate>(
        await fetch(
          isEdit ? `/api/promo-templates/${editingId}` : "/api/promo-templates",
          {
            method: isEdit ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        ),
      );
      setTemplates((current) =>
        isEdit
          ? current.map((template) =>
              template.id === saved.id ? saved : template,
            )
          : [...current, saved],
      );
      toast.success(
        isEdit ? "Template diperbarui." : `Template "${saved.name}" dibuat.`,
      );
      setFormOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Gagal menyimpan Template.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [editingId, form, formMode, toast]);

  const deleteTemplate = useCallback(
    async (template: PromoTemplate) => {
      setDeletingId(template.id);
      try {
        const response = await fetch(`/api/promo-templates/${template.id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          await readJson(response);
        }
        setTemplates((current) =>
          current.filter((candidate) => candidate.id !== template.id),
        );
        toast.success(`Template "${template.name}" dihapus.`);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal menghapus Template.",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [toast],
  );

  const columns = useMemo<TableColumn<PromoTemplate>[]>(
    () => [
      {
        key: "name",
        header: "Nama Template",
        render: (template) => (
          <Stack gap="xs">
            <strong>{template.name}</strong>
            {template.isBuiltIn ? (
              <StatusBadge status="Bawaan" tone="neutral" />
            ) : (
              <StatusBadge status="Custom" tone="info" />
            )}
          </Stack>
        ),
      },
      {
        key: "promoType",
        header: "Promo Type",
        render: (template) => template.promoType ?? "-",
      },
      {
        key: "config",
        header: "Pola Rule",
        render: (template) => summarizeConfig(template),
      },
      {
        key: "actions",
        header: "Aksi",
        width: "200px",
        render: (template) => (
          <Stack direction="horizontal" gap="xs" wrap>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEdit(template)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={deletingId === template.id}
              onClick={() => void deleteTemplate(template)}
            >
              {deletingId === template.id ? "Menghapus..." : "Delete"}
            </Button>
          </Stack>
        ),
      },
    ],
    [deleteTemplate, deletingId, openEdit],
  );

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <div>
          <h1 className="pms-page__title">Promo Templates</h1>
          <p className="pms-muted">
            Template promo siap pakai untuk mempercepat pembuatan promo.
          </p>
        </div>
        <Button onClick={openCreate}>+ Tambah Template</Button>
      </Stack>

      <Card padding="none">
        {loading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Promo Templates"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadTemplates()}
          />
        ) : templates.length === 0 ? (
          <EmptyState
            title="Belum ada template"
            description="Buat template promo pertama untuk mempercepat penyiapan promo."
            actionLabel="Tambah Template"
            onAction={openCreate}
          />
        ) : (
          <Table
            columns={columns}
            data={templates}
            rowKey={(template) => template.id}
            caption="Daftar Promo Templates"
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={formMode === "create" ? "Tambah Template" : "Edit Template"}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submitting}
              onClick={() => setFormOpen(false)}
            >
              Batal
            </Button>
            <Button
              disabled={submitting || form.name.trim() === ""}
              onClick={() => void submitForm()}
            >
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Field htmlFor={nameField} label="Nama Template" required>
            <Input
              id={nameField}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </Field>
          <Field htmlFor={promoTypeField} label="Promo Type">
            <Select
              id={promoTypeField}
              options={PROMO_TYPE_OPTIONS}
              value={form.promoType}
              onChange={(event) =>
                updateField("promoType", event.target.value as PromoType)
              }
            />
          </Field>
          <Field htmlFor={minQtyField} label="Minimum Qty">
            <Input
              id={minQtyField}
              type="number"
              min={1}
              value={form.minQuantity}
              onChange={(event) =>
                updateField("minQuantity", event.target.value)
              }
            />
          </Field>
          <Field htmlFor={benefitField} label="Benefit">
            <Select
              id={benefitField}
              options={BENEFIT_OPTIONS}
              value={form.benefitType}
              onChange={(event) =>
                updateField("benefitType", event.target.value as BenefitType)
              }
            />
          </Field>
          {form.benefitType === BenefitType.DiscountPercent ? (
            <Field htmlFor={discountField} label="Discount %">
              <Input
                id={discountField}
                type="number"
                min={0}
                value={form.discountPercent}
                onChange={(event) =>
                  updateField("discountPercent", event.target.value)
                }
              />
            </Field>
          ) : (
            <Field htmlFor={giftField} label="Free Gift">
              <Input
                id={giftField}
                value={form.gift}
                onChange={(event) => updateField("gift", event.target.value)}
              />
            </Field>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
