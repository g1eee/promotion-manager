"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Global Brand context — the active-brand session state that drives
 * cross-module filtering (design.md → "Global Brand Selector (top app bar)").
 *
 * The Brand chosen in the top app bar becomes the **active context** that
 * automatically filters Dashboard widgets/Recent Activity (Req 2.5), Product
 * Master listing (Req 3.15), Approved Promos (Req 13.3), and Reports listings
 * (Req 15.2). Selection is **sticky for the session**: it is persisted to
 * `sessionStorage` so it survives client navigation and reloads within the same
 * browser tab, but does not leak across sessions.
 *
 * Recompute mechanism: changing the active Brand updates this context value,
 * which re-renders every consumer of {@link useActiveBrand}. Feature-phase
 * modules (Dashboard, Product Master, Approved Promos, Reports) consume the hook
 * and recompute their views from the new `activeBrandId` — no per-module brand
 * filter is required.
 *
 * Real Brand data integration lands with Brand Management (Task 5). Until then a
 * temporary in-memory list of sample Brands is provided so the context and
 * filter mechanism are available for other modules to consume.
 */

/** A selectable Brand option surfaced in the Global Brand Selector. */
export interface BrandOption {
  /** Stable identifier used as the active-brand key and persisted value. */
  readonly id: string;
  /** Human-readable label rendered in the dropdown. */
  readonly label: string;
}

/**
 * Temporary sample Brands (Kalova / Chanira / AMK / ATRIA) used until the real
 * Brand Management module supplies the live list. The shape matches what a real
 * fetch will return, so swapping the source later is a drop-in change.
 */
export const SAMPLE_BRANDS: readonly BrandOption[] = [
  { id: "kalova", label: "Kalova" },
  { id: "chanira", label: "Chanira" },
  { id: "amk", label: "AMK" },
  { id: "atria", label: "ATRIA" },
];

/** sessionStorage key holding the sticky active-brand id for the session. */
export const ACTIVE_BRAND_STORAGE_KEY = "pms.activeBrandId";

/** Value exposed by {@link useActiveBrand}. */
export interface BrandContextValue {
  /** All Brands available for selection. */
  readonly brands: readonly BrandOption[];
  /** The currently active Brand id (the cross-module filter source). */
  readonly activeBrandId: string;
  /** The resolved active Brand option, or `null` when none matches. */
  readonly activeBrand: BrandOption | null;
  /** Switch the active Brand and persist it for the session. */
  setActiveBrand: (brandId: string) => void;
}

const BrandContext = createContext<BrandContextValue | null>(null);

/** Reads the persisted active-brand id, validating it against `brands`. */
function readStoredBrandId(brands: readonly BrandOption[]): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    if (stored && brands.some((brand) => brand.id === stored)) {
      return stored;
    }
  } catch {
    // sessionStorage may be unavailable (e.g. privacy mode); fall back silently.
  }
  return null;
}

export interface BrandProviderProps {
  children: ReactNode;
  /**
   * Brands to offer. Defaults to {@link SAMPLE_BRANDS}; tests and the future
   * Brand Management integration can inject a real list here.
   */
  brands?: readonly BrandOption[];
  /**
   * Initial active Brand id. When omitted, the first available Brand is used
   * (later overridden by any sticky value restored from the session).
   */
  initialBrandId?: string;
}

/**
 * Provides the active-Brand session context to the `(app)` subtree.
 *
 * The initial render uses a deterministic default (the provided
 * `initialBrandId` or the first Brand) so server and client markup match; the
 * sticky value persisted in `sessionStorage` is then restored on mount to avoid
 * hydration mismatches.
 */
export function BrandProvider({
  children,
  brands = SAMPLE_BRANDS,
  initialBrandId,
}: BrandProviderProps) {
  const defaultBrandId = initialBrandId ?? brands[0]?.id ?? "";

  const [activeBrandId, setActiveBrandId] = useState<string>(defaultBrandId);

  // Restore the sticky selection from the session after mount. Running this in
  // an effect keeps the first client render identical to the server render.
  useEffect(() => {
    const stored = readStoredBrandId(brands);
    if (stored && stored !== activeBrandId) {
      setActiveBrandId(stored);
    }
    // Only restore once on mount; subsequent changes flow through setActiveBrand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveBrand = useCallback(
    (brandId: string) => {
      if (!brands.some((brand) => brand.id === brandId)) return;
      setActiveBrandId(brandId);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, brandId);
        } catch {
          // Persisting is best-effort; ignore storage failures.
        }
      }
    },
    [brands],
  );

  const value = useMemo<BrandContextValue>(() => {
    const activeBrand =
      brands.find((brand) => brand.id === activeBrandId) ?? null;
    return { brands, activeBrandId, activeBrand, setActiveBrand };
  }, [brands, activeBrandId, setActiveBrand]);

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

/**
 * Access the active-Brand context.
 *
 * This is the single consumption point for feature-phase modules (Dashboard,
 * Product Master, Approved Promos, Reports). Throws when used outside a
 * {@link BrandProvider} so missing wiring fails fast.
 */
export function useActiveBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (ctx === null) {
    throw new Error("useActiveBrand must be used within a BrandProvider");
  }
  return ctx;
}
