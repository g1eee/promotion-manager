// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { DashboardView } from "./DashboardView";
import { BrandProvider } from "../_components/BrandContext";

const summary = {
  brandId: "brand-kalova",
  brandName: "Kalova",
  widgets: {
    totalCampaigns: 4,
    totalPromos: 12,
    draftPromos: 2,
    reviewPromos: 3,
    approvedPromos: 5,
    rejectedPromos: 1,
    activePromos: 2,
    completedPromos: 6,
    pendingReviewPromos: 3,
    waitingForExecutionPromos: 4,
  },
  workQueue: {
    pendingReviews: 3,
    rejectedPromos: 1,
    unreadFeedback: 2,
    waitingForExecution: 4,
  },
  recentActivity: {
    campaigns: [
      {
        id: "campaign-1",
        brandId: "brand-kalova",
        brandName: "Kalova",
        name: "Payday Campaign",
        status: "Active",
        promoCount: 3,
        occurredAt: "2026-01-01T09:00:00.000Z",
      },
    ],
    promos: [
      {
        id: "promo-1",
        brandId: "brand-kalova",
        brandName: "Kalova",
        campaignId: "campaign-1",
        campaignName: "Payday Campaign",
        name: "Payday Voucher",
        promoType: "Voucher",
        status: "Approved",
        productCount: 8,
        occurredAt: "2026-01-01T09:10:00.000Z",
      },
    ],
    approvals: [
      {
        id: "approval-1",
        promoId: "promo-1",
        promoName: "Payday Voucher",
        campaignId: "campaign-1",
        campaignName: "Payday Campaign",
        brandId: "brand-kalova",
        brandName: "Kalova",
        status: "Approved",
        changedBy: "user-spv",
        occurredAt: "2026-01-01T09:15:00.000Z",
      },
    ],
  },
  upcomingPromos: [
    {
      id: "promo-up-1",
      name: "Flash Sale Serbu",
      brandId: "brand-kalova",
      brandName: "Kalova",
      campaignId: "campaign-1",
      campaignName: "Payday Campaign",
      promoType: "Flash Sale",
      status: "Approved",
      startsAt: "2026-01-03T00:00:00.000Z",
      daysUntilStart: 2,
    },
  ],
  activeCampaigns: [
    {
      id: "campaign-1",
      name: "Payday Campaign",
      brandId: "brand-kalova",
      brandName: "Kalova",
      status: "Active",
      promoCount: 4,
      progress: 25,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-01-07T00:00:00.000Z",
      daysUntilEnd: 6,
    },
  ],
  calendarCampaigns: [
    {
      id: "campaign-1",
      name: "Payday Campaign",
      brandId: "brand-kalova",
      brandName: "Kalova",
      status: "Active",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-01-07T00:00:00.000Z",
    },
  ],
  recomputedAt: "2026-01-01T09:20:00.000Z",
};

describe("DashboardView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(summary), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("loads the active Brand dashboard and renders the Command Center", async () => {
    render(
      <BrandProvider initialBrandId="kalova">
        <DashboardView />
      </BrandProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Needs Attention")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith("/api/dashboard?brandId=kalova&limit=5", {
      cache: "no-store",
    });
    // Hero summary + Action Center
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.getByText("Waiting Execution")).toBeInTheDocument();
    expect(screen.getByText("Unread Feedback")).toBeInTheDocument();
    // Promotion Timeline (upcoming promo)
    expect(screen.getByText("Promotion Timeline")).toBeInTheDocument();
    expect(screen.getByText("Flash Sale Serbu")).toBeInTheDocument();
    // Active campaign project card
    expect(screen.getByText("Active Campaigns")).toBeInTheDocument();
    expect(screen.getAllByText("Payday Campaign").length).toBeGreaterThan(0);
    // Campaign calendar
    expect(screen.getByText("Kalender Campaign")).toBeInTheDocument();
  });
});
