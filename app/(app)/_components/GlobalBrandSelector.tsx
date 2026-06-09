"use client";

import { useId } from "react";
import { Select, type SelectOption } from "@ui/components/Select";
import { useActiveBrand } from "./BrandContext";

/**
 * Global Brand Selector (top app bar).
 *
 * The dropdown that sets the active-Brand context consumed across modules
 * (design.md → "Global Brand Selector (top app bar)"). It is injected into the
 * top app bar's `brandSelectorSlot` and reads/writes the sticky session state
 * via {@link useActiveBrand}.
 *
 * Changing the Brand here updates the shared context, which re-renders every
 * consumer (Dashboard, Product Master, Approved Promos, Reports) so their views
 * recompute against the newly selected Brand without per-module re-filtering.
 */
export function GlobalBrandSelector() {
  const { brands, activeBrandId, setActiveBrand } = useActiveBrand();
  const labelId = useId();

  const options: SelectOption[] = brands.map((brand) => ({
    label: brand.label,
    value: brand.id,
  }));

  return (
    <div className="pms-brand-selector" data-slot="global-brand-selector-control">
      <span id={labelId} className="pms-brand-selector__label">
        Brand
      </span>
      <Select
        className="pms-brand-selector__select"
        aria-labelledby={labelId}
        options={options}
        value={activeBrandId}
        onChange={(event) => setActiveBrand(event.target.value)}
      />
    </div>
  );
}
