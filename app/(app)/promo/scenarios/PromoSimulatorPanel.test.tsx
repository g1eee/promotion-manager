// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BenefitType, PromoStatus, PromoType } from "@domain/enums";
import type { CostConfiguration, PromoScenario } from "@domain/types";
import { PromoSimulatorPanel } from "./PromoSimulatorPanel";

const promo: PromoScenario = {
  id: "promo-1",
  brandId: "brand-1",
  campaignId: "campaign-1",
  namaPromo: "Payday Serum",
  promoType: PromoType.BuyXDiscount,
  tanggalMulai: new Date("2026-01-01T00:00:00Z"),
  tanggalSelesai: new Date("2026-01-02T00:00:00Z"),
  status: PromoStatus.Draft,
  executionStatus: null,
  rules: [
    {
      id: "rule-1",
      minQuantity: 1,
      benefitType: BenefitType.DiscountPercent,
      discountPercent: 20,
      gift: null,
    },
  ],
  productRefs: [{ brandId: "brand-1", productId: "P-1" }],
  createdBy: "user-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const costConfig: CostConfiguration = {
  id: "cost-1",
  brandId: "brand-1",
  adminFee: 5,
  shippingFee: 5,
  promoXtra: 0,
  feePesanan: 0,
  campaignFee: 0,
  promosiFee: 0,
  marketingFee: 0,
  adsSpending: 0,
  affiliateCommission: 0,
  operatingCost: 0,
  isActive: true,
  updatedAt: new Date("2026-01-03T04:05:00Z"),
};

const selection = {
  selected: [
    {
      brandId: "brand-1",
      productId: "P-1",
      namaProduk: "Serum Bright",
      hpp: 50_000,
      hargaJual: 100_000,
    },
  ],
  selectable: [],
};

describe("PromoSimulatorPanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/products")) {
          return new Response(JSON.stringify(selection), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes("/cost-config")) {
          return new Response(JSON.stringify(costConfig), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders active cost config, health summary, and expandable per-product outputs", async () => {
    render(<PromoSimulatorPanel promo={promo} brandName="Kalova" />);

    await waitFor(() => {
      expect(screen.getByText("Active Cost Configuration")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith("/api/promos/promo-1/products", {
      cache: "no-store",
    });
    expect(fetch).toHaveBeenCalledWith("/api/brands/brand-1/cost-config", {
      cache: "no-store",
    });
    expect(screen.getByText("Kalova")).toBeInTheDocument();
    expect(screen.getByText("20% discount")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("Harga Normal")).toBeInTheDocument();
    expect(screen.getByText("Harga Promo")).toBeInTheDocument();
    expect(screen.getByText("Potongan")).toBeInTheDocument();
    expect(screen.getByText("Margin Rp")).toBeInTheDocument();
    expect(screen.getByText("Margin %")).toBeInTheDocument();
    expect(screen.getByText("NPM Rp")).toBeInTheDocument();
    expect(screen.getByText("NPM %")).toBeInTheDocument();
    expect(screen.getByText("P-1")).toBeInTheDocument();
    expect(screen.getByText("Serum Bright")).toBeInTheDocument();
  });
});
