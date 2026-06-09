import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BrandProvider,
  SAMPLE_BRANDS,
  useActiveBrand,
  type BrandContextValue,
} from "../../app/(app)/_components/BrandContext";
import { GlobalBrandSelector } from "../../app/(app)/_components/GlobalBrandSelector";

/** Test helper that captures the context value exposed to consumers. */
function Capture({ onValue }: { onValue: (value: BrandContextValue) => void }) {
  onValue(useActiveBrand());
  return null;
}

describe("BrandProvider + GlobalBrandSelector", () => {
  it("renders every Brand as an option in the selector", () => {
    const html = renderToStaticMarkup(
      <BrandProvider>
        <GlobalBrandSelector />
      </BrandProvider>,
    );
    for (const brand of SAMPLE_BRANDS) {
      expect(html).toContain(`value="${brand.id}"`);
      expect(html).toContain(brand.label);
    }
  });

  it("defaults the active Brand to the first available Brand", () => {
    let captured: BrandContextValue | null = null;
    renderToStaticMarkup(
      <BrandProvider>
        <Capture onValue={(value) => (captured = value)} />
      </BrandProvider>,
    );
    expect(captured).not.toBeNull();
    const value = captured as unknown as BrandContextValue;
    expect(value.activeBrandId).toBe(SAMPLE_BRANDS[0]!.id);
    expect(value.activeBrand?.id).toBe(SAMPLE_BRANDS[0]!.id);
    expect(value.brands).toEqual(SAMPLE_BRANDS);
  });

  it("honors an explicit initialBrandId", () => {
    let captured: BrandContextValue | null = null;
    renderToStaticMarkup(
      <BrandProvider initialBrandId="amk">
        <Capture onValue={(value) => (captured = value)} />
      </BrandProvider>,
    );
    const value = captured as unknown as BrandContextValue;
    expect(value.activeBrandId).toBe("amk");
    expect(value.activeBrand?.label).toBe("AMK");
  });

  it("exposes a custom Brand list when provided", () => {
    let captured: BrandContextValue | null = null;
    const brands = [
      { id: "x", label: "Brand X" },
      { id: "y", label: "Brand Y" },
    ];
    renderToStaticMarkup(
      <BrandProvider brands={brands}>
        <Capture onValue={(value) => (captured = value)} />
      </BrandProvider>,
    );
    const value = captured as unknown as BrandContextValue;
    expect(value.brands).toEqual(brands);
    expect(value.activeBrandId).toBe("x");
  });

  it("throws when useActiveBrand is used outside a BrandProvider", () => {
    expect(() => renderToStaticMarkup(<Capture onValue={() => {}} />)).toThrow(
      /BrandProvider/,
    );
  });
});
