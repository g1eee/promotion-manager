// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  BrandProvider,
  useActiveBrand,
  ACTIVE_BRAND_STORAGE_KEY,
  SAMPLE_BRANDS,
} from "../../app/(app)/_components/BrandContext";
import { GlobalBrandSelector } from "../../app/(app)/_components/GlobalBrandSelector";

/**
 * Stateful DOM tests for the active-Brand session context (Task 2.5, Req 2.5 /
 * 3.15). These exercise behaviours the static-markup tests cannot reach:
 * sticky persistence to sessionStorage across a remount/reload, recompute of
 * consumers when the Brand changes, and propagation of the active Brand to
 * multiple consumers simultaneously.
 *
 * _Requirements: 2.5, 3.15_
 */

/** Consumer that surfaces the active Brand so we can assert propagation. */
function ActiveBrandProbe({ testId }: { testId: string }) {
  const { activeBrandId, activeBrand } = useActiveBrand();
  return (
    <div data-testid={testId}>
      {activeBrandId}:{activeBrand?.label ?? "none"}
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("BrandContext (stateful / DOM)", () => {
  it("propagates the active Brand to every consumer in the subtree", () => {
    render(
      <BrandProvider>
        <ActiveBrandProbe testId="probe-a" />
        <ActiveBrandProbe testId="probe-b" />
      </BrandProvider>,
    );

    const first = SAMPLE_BRANDS[0]!;
    expect(screen.getByTestId("probe-a")).toHaveTextContent(
      `${first.id}:${first.label}`,
    );
    expect(screen.getByTestId("probe-b")).toHaveTextContent(
      `${first.id}:${first.label}`,
    );
  });

  it("recomputes consumers when the Brand changes via the selector", () => {
    render(
      <BrandProvider>
        <GlobalBrandSelector />
        <ActiveBrandProbe testId="probe" />
      </BrandProvider>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe(SAMPLE_BRANDS[0]!.id);

    fireEvent.change(select, { target: { value: "atria" } });

    expect(select.value).toBe("atria");
    expect(screen.getByTestId("probe")).toHaveTextContent("atria:ATRIA");
  });

  it("persists the selection to sessionStorage (sticky per session)", () => {
    render(
      <BrandProvider>
        <GlobalBrandSelector />
      </BrandProvider>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "chanira" } });

    expect(window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY)).toBe(
      "chanira",
    );
  });

  it("restores the sticky Brand on remount (survives reload within the session)", () => {
    window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, "amk");

    render(
      <BrandProvider>
        <GlobalBrandSelector />
        <ActiveBrandProbe testId="probe" />
      </BrandProvider>,
    );

    // The default render starts on the first Brand, then the mount effect
    // restores the persisted "amk" selection.
    expect(screen.getByTestId("probe")).toHaveTextContent("amk:AMK");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "amk",
    );
  });

  it("ignores a persisted Brand id that is not in the available list", () => {
    window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, "does-not-exist");

    render(
      <BrandProvider>
        <ActiveBrandProbe testId="probe" />
      </BrandProvider>,
    );

    const first = SAMPLE_BRANDS[0]!;
    expect(screen.getByTestId("probe")).toHaveTextContent(
      `${first.id}:${first.label}`,
    );
  });
});
