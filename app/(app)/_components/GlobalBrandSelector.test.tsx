// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ACTIVE_BRAND_STORAGE_KEY,
  BrandProvider,
  useActiveBrand,
  type BrandOption,
} from "./BrandContext";
import { GlobalBrandSelector } from "./GlobalBrandSelector";

/**
 * Unit tests for the Global Brand Selector (top app bar control).
 *
 * The selector reads and writes the sticky active-Brand session state, which
 * propagates to every module consumer. Changing the Brand here updates the
 * shared context and persists the choice for the session.
 *
 * Validates: Requirements 2.5, 3.15
 */

const BRANDS: readonly BrandOption[] = [
  { id: "kalova", label: "Kalova" },
  { id: "chanira", label: "Chanira" },
  { id: "amk", label: "AMK" },
];

function ActiveBrandProbe() {
  const { activeBrandId } = useActiveBrand();
  return <span data-testid="active-brand">{activeBrandId}</span>;
}

function renderSelector() {
  return render(
    <BrandProvider brands={BRANDS}>
      <GlobalBrandSelector />
      <ActiveBrandProbe />
    </BrandProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("GlobalBrandSelector", () => {
  it("renders one option per available Brand", () => {
    renderSelector();

    const select = screen.getByRole("combobox", { name: "Brand" });
    const options = screen.getAllByRole("option") as HTMLOptionElement[];

    expect(select).toBeInTheDocument();
    expect(options).toHaveLength(BRANDS.length);
    expect(options.map((option) => option.textContent)).toEqual([
      "Kalova",
      "Chanira",
      "AMK",
    ]);
  });

  it("reflects the current active Brand as the selected value", () => {
    renderSelector();

    const select = screen.getByRole("combobox", {
      name: "Brand",
    }) as HTMLSelectElement;

    expect(select.value).toBe("kalova");
  });

  it("updates the shared context and persists when the Brand changes", () => {
    renderSelector();

    const select = screen.getByRole("combobox", {
      name: "Brand",
    }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "amk" } });

    expect(select.value).toBe("amk");
    expect(screen.getByTestId("active-brand")).toHaveTextContent("amk");
    expect(window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY)).toBe("amk");
  });

  it("reflects the sticky session selection after a remount (sticky per session)", () => {
    // First mount: the user picks a Brand via the top-bar selector.
    const first = renderSelector();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Brand" }),
      { target: { value: "chanira" } },
    );
    expect(window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY)).toBe(
      "chanira",
    );

    // Simulate client navigation/reload within the same session: tear the shell
    // down and mount a fresh provider + selector. The choice must persist.
    first.unmount();
    renderSelector();

    const select = screen.getByRole("combobox", {
      name: "Brand",
    }) as HTMLSelectElement;
    expect(select.value).toBe("chanira");
    expect(screen.getByTestId("active-brand")).toHaveTextContent("chanira");
  });
});
