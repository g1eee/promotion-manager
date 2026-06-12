"use client";

import { useState } from "react";
import { Stack } from "@ui/components";
import { CampaignHistoryView } from "../campaign-history/CampaignHistoryView";
import { PromoHistoryView } from "../promo-history/PromoHistoryView";

type Tab = "campaign" | "promo";

const TABS: { key: Tab; label: string }[] = [
  { key: "campaign", label: "Campaign" },
  { key: "promo", label: "Promo" },
];

export function HistoryView() {
  const [tab, setTab] = useState<Tab>("campaign");

  return (
    <Stack gap="lg">
      <div className="pms-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`pms-tabs__tab ${tab === t.key ? "pms-tabs__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "campaign" && <CampaignHistoryView />}
      {tab === "promo" && <PromoHistoryView />}
    </Stack>
  );
}
