"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  Field,
  Grid,
  Input,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
} from "@ui/components";
import type { TableColumn } from "@ui/components";
import { BenefitType, MarginHealth } from "@domain/enums";
import type { CostConfiguration, PromoScenario, Rule } from "@domain/types";
import type {
  ProductSelectionItem,
} from "@domain/product-selection";
import { RuleSelector } from "@domain/rule-selector";
import { Simulator } from "@domain/simulator";
import type { SimulatedProduct } from "@domain/simulator";

interface PromoSimulatorPanelProps {
  readonly promo: PromoScenario;
  readonly brandName: string;
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

interface ProductSelectionPayload {
  selected: ProductSelectionItem[];
  selectable: unknown[];
}

interface SimulatorRow extends SimulatedProduct {
  readonly namaProduk: string;
  readonly marginHealth: MarginHealth | null;
}

const NO_DISCOUNT_RULE: Rule = {
  id: "simulator-no-rule",
  minQuantity: 1,
  benefitType: BenefitType.DiscountPercent,
  discountPercent: 0,
  gift: null,
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function formatMoney(value: number | null): string {
  if (value === null) return "Deferred";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "Deferred";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRule(rule: Rule | null): string {
  if (!rule) return "No eligible rule";
  if (rule.benefitType === BenefitType.DiscountPercent) {
    return `${rule.discountPercent ?? 0}% discount`;
  }
  return rule.gift ?? "Free gift";
}

function healthOf(result: SimulatedProduct): MarginHealth | null {
  return result.npmPct === null
    ? null
    : Simulator.classifyMarginHealth(result.npmPct);
}

export function PromoSimulatorPanel({
  promo,
  brandName,
}: PromoSimulatorPanelProps) {
  const [selection, setSelection] = useState<ProductSelectionPayload | null>(
    null,
  );
  const [costConfig, setCostConfig] = useState<CostConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedSelection, loadedCostConfig] = await Promise.all([
        readJson<ProductSelectionPayload>(
          await fetch(`/api/promos/${promo.id}/products`, {
            cache: "no-store",
          }),
        ),
        readJson<CostConfiguration>(
          await fetch(`/api/brands/${promo.brandId}/cost-config`, {
            cache: "no-store",
          }),
        ),
      ]);
      setSelection(loadedSelection);
      setCostConfig(loadedCostConfig);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat simulator.",
      );
    } finally {
      setLoading(false);
    }
  }, [promo.brandId, promo.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const simulationQty = useMemo(() => {
    const parsed = Number(quantity);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  }, [quantity]);

  const selectedRule = useMemo(
    () => RuleSelector.select(promo.rules, simulationQty),
    [promo.rules, simulationQty],
  );

  const appliedRule = selectedRule ?? NO_DISCOUNT_RULE;

  const rows = useMemo<SimulatorRow[]>(() => {
    if (!selection || !costConfig) return [];
    const simulated = Simulator.simulateAll(
      selection.selected,
      appliedRule,
      costConfig,
    );
    return simulated.map((result, index) => ({
      ...result,
      namaProduk: selection.selected[index]?.namaProduk ?? result.productId,
      marginHealth: healthOf(result),
    }));
  }, [appliedRule, costConfig, selection]);

  const costInfo = useMemo(
    () => (costConfig ? Simulator.activeCostConfigInfo(costConfig) : null),
    [costConfig],
  );

  const summary = useMemo(() => {
    const counts = {
      total: rows.length,
      healthy: 0,
      warning: 0,
      risky: 0,
    };
    for (const row of rows) {
      if (row.marginHealth === MarginHealth.Healthy) counts.healthy += 1;
      if (row.marginHealth === MarginHealth.Warning) counts.warning += 1;
      if (row.marginHealth === MarginHealth.Risky) counts.risky += 1;
    }
    return counts;
  }, [rows]);

  const columns = useMemo<TableColumn<SimulatorRow>[]>(
    () => [
      {
        key: "productId",
        header: "Product ID",
        render: (row) => row.productId,
      },
      {
        key: "namaProduk",
        header: "Nama Produk",
        render: (row) => row.namaProduk,
      },
      {
        key: "hargaNormal",
        header: "Harga Normal",
        numeric: true,
        render: (row) => formatMoney(row.hargaNormal),
      },
      {
        key: "hargaPromo",
        header: "Harga Promo",
        numeric: true,
        render: (row) => formatMoney(row.hargaPromo),
      },
      {
        key: "potongan",
        header: "Potongan",
        numeric: true,
        render: (row) => formatMoney(row.potongan),
      },
      {
        key: "marginRp",
        header: "Margin Rp",
        numeric: true,
        render: (row) => formatMoney(row.marginRp),
      },
      {
        key: "marginPct",
        header: "Margin %",
        numeric: true,
        render: (row) => formatPct(row.marginPct),
      },
      {
        key: "npmRp",
        header: "NPM Rp",
        numeric: true,
        render: (row) => formatMoney(row.npmRp),
      },
      {
        key: "npmPct",
        header: "NPM %",
        numeric: true,
        render: (row) => formatPct(row.npmPct),
      },
      {
        key: "health",
        header: "Health",
        render: (row) =>
          row.marginHealth ? (
            <StatusBadge status={row.marginHealth} />
          ) : (
            <StatusBadge status="Deferred" tone="neutral" />
          ),
      },
    ],
    [],
  );

  if (loading) {
    return <SkeletonTable rows={4} columns={6} />;
  }

  if (loadError) {
    return (
      <EmptyState
        title="Gagal memuat simulator"
        description={loadError}
        actionLabel="Refresh"
        onAction={() => void loadData()}
      />
    );
  }

  if (!selection || !costConfig) {
    return (
      <EmptyState
        title="Simulator belum tersedia"
        description="Data promo belum lengkap."
      />
    );
  }

  return (
    <Stack gap="lg">
      <div className="pms-simulator__cost-strip">
        <div>
          <div className="pms-simulator__label">Active Cost Configuration</div>
          <strong>{brandName}</strong>
        </div>
        <StatusBadge
          status={costInfo?.isActive ? "Active" : "Inactive"}
          tone={costInfo?.isActive ? "success" : "warning"}
        />
        <div className="pms-simulator__cost-date">
          <span>Last Updated Date</span>
          <strong>
            {costInfo ? formatDateTime(costInfo.lastUpdatedDate) : "-"}
          </strong>
        </div>
      </div>

      <Grid columns="minmax(160px, 220px) minmax(0, 1fr)" gap="lg">
        <Field htmlFor="promo-simulator-qty" label="Simulation Qty">
          <Input
            id="promo-simulator-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <div className="pms-simulator__rule">
          <span>Applied Rule</span>
          <strong>{formatRule(selectedRule)}</strong>
          <span>{selectedRule ? `Minimum Qty ${selectedRule.minQuantity}` : "Harga normal"}</span>
        </div>
      </Grid>

      {selection.selected.length === 0 ? (
        <EmptyState
          title="Belum ada produk untuk disimulasikan"
          description="Tambahkan produk ke promo sebelum membaca kelayakan."
        />
      ) : (
        <>
          <div className="pms-simulator-summary" aria-label="Simulator summary">
            <div className="pms-simulator-summary__item">
              <span>Total</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="pms-simulator-summary__item pms-simulator-summary__item--healthy">
              <span>Healthy</span>
              <strong>{summary.healthy}</strong>
            </div>
            <div className="pms-simulator-summary__item pms-simulator-summary__item--warning">
              <span>Warning</span>
              <strong>{summary.warning}</strong>
            </div>
            <div className="pms-simulator-summary__item pms-simulator-summary__item--risky">
              <span>Risky</span>
              <strong>{summary.risky}</strong>
            </div>
          </div>

          {!costInfo?.isActive ? (
            <div className="pms-simulator__notice">
              NPM ditunda sampai Cost Configuration Brand aktif.
            </div>
          ) : null}

          <Stack direction="horizontal" justify="space-between" align="center">
            <h2 className="pms-simulator__section-title">Detailed View</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {detailsOpen ? "Collapse" : "Expand"}
            </Button>
          </Stack>

          {detailsOpen ? (
            <Table
              columns={columns}
              data={rows}
              rowKey={(row) => row.productId}
              caption="Promo Simulator per product"
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
