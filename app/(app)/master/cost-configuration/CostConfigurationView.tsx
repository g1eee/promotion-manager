"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  Field,
  Grid,
  Input,
  SkeletonCard,
  Stack,
  StatusBadge,
  useToast,
} from "@ui/components";
import type { Brand, CostConfiguration } from "@domain/types";
import {
  COST_COMPONENT_KEYS,
  type CostComponentKey,
  type CostComponents,
} from "@services/index";
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

const COMPONENT_LABELS: Record<CostComponentKey, string> = {
  adminFee: "Admin Fee",
  shippingFee: "Shipping Fee",
  promoXtra: "Promo Xtra",
  feePesanan: "Fee Pesanan",
  campaignFee: "Campaign Fee",
  promosiFee: "Promosi Fee",
  marketingFee: "Marketing Fee",
  adsSpending: "Ads Spending",
  affiliateCommission: "Affiliate Commission",
  operatingCost: "Operating Cost",
};

type CostForm = Record<CostComponentKey, string>;

function emptyForm(): CostForm {
  const form = {} as CostForm;
  for (const key of COST_COMPONENT_KEYS) {
    form[key] = "0";
  }
  return form;
}

function formFromConfig(config: CostConfiguration): CostForm {
  const form = {} as CostForm;
  for (const key of COST_COMPONENT_KEYS) {
    form[key] = String(config[key]);
  }
  return form;
}

function componentsFromForm(form: CostForm): CostComponents {
  const components = {} as CostComponents;
  for (const key of COST_COMPONENT_KEYS) {
    components[key] = Number(form[key]);
  }
  return components;
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

function formatDate(value: Date | string): string {
  const date = new Date(value);
  if (date.getTime() === 0) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function CostConfigurationView() {
  const toast = useToast();
  const { activeBrandId, activeBrand } = useActiveBrand();
  const fieldPrefix = useId();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [config, setConfig] = useState<CostConfiguration | null>(null);
  const [form, setForm] = useState<CostForm>(() => emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const activeBrandLabel =
    brandNameById.get(activeApiBrandId) ?? activeBrand?.label ?? "Brand aktif";

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loadedBrands = await readJson<Brand[]>(
        await fetch("/api/brands", { cache: "no-store" }),
      );
      const brandId = resolveActiveBrandId(loadedBrands, activeBrandId);
      const loadedConfig = await readJson<CostConfiguration>(
        await fetch(`/api/brands/${brandId}/cost-config`, {
          cache: "no-store",
        }),
      );
      setBrands(loadedBrands);
      setConfig(loadedConfig);
      setForm(formFromConfig(loadedConfig));
      setFieldErrors({});
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Cost Configuration.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const updateField = useCallback((key: CostComponentKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!activeApiBrandId) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const saved = await readJson<CostConfiguration>(
        await fetch(`/api/brands/${activeApiBrandId}/cost-config`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(componentsFromForm(form)),
        }),
      );
      setConfig(saved);
      setForm(formFromConfig(saved));
      toast.success(`Cost Configuration ${activeBrandLabel} berhasil disimpan.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.body.fields) {
        setFieldErrors(error.body.fields);
        if (error.body.message) toast.error(error.body.message);
      } else {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal menyimpan Cost Configuration.",
        );
      }
    } finally {
      setSaving(false);
    }
  }, [activeApiBrandId, activeBrandLabel, form, toast]);

  if (loading) {
    return (
      <Stack gap="lg">
        <h1 className="pms-page__title">Cost Configuration</h1>
        <SkeletonCard lines={8} />
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Stack gap="lg">
        <h1 className="pms-page__title">Cost Configuration</h1>
        <Card>
          <Stack gap="md" align="flex-start">
            <StatusBadge status="Load Failed" tone="danger" />
            <p>{loadError}</p>
            <Button variant="secondary" onClick={() => void loadConfig()}>
              Refresh
            </Button>
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <div>
          <h1 className="pms-page__title">Cost Configuration</h1>
        </div>
        <Stack direction="horizontal" gap="sm" align="center" wrap>
          <StatusBadge status={`Brand ${activeBrandLabel}`} tone="info" />
          <StatusBadge
            status={config?.isActive ? "Active" : "Inactive"}
            tone={config?.isActive ? "success" : "neutral"}
          />
          <Button variant="secondary" onClick={() => void loadConfig()}>
            Refresh
          </Button>
          <Button onClick={() => void save()} disabled={saving || !activeApiBrandId}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </Stack>
      </Stack>

      <Card
        title="Components (%)"
        subtitle={`Last updated: ${formatDate(config?.updatedAt ?? new Date(0))}`}
      >
        <Grid columns="repeat(2, minmax(0, 1fr))" gap="lg">
          {COST_COMPONENT_KEYS.map((key) => {
            const fieldId = `${fieldPrefix}-${key}`;
            return (
              <Field
                key={key}
                htmlFor={fieldId}
                label={COMPONENT_LABELS[key]}
                required
                error={fieldErrors[key]}
              >
                <Input
                  id={fieldId}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form[key]}
                  invalid={Boolean(fieldErrors[key])}
                  onChange={(event) => updateField(key, event.target.value)}
                />
              </Field>
            );
          })}
        </Grid>
      </Card>
    </Stack>
  );
}
