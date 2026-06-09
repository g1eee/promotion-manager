// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ACTIVE_BRAND_STORAGE_KEY,
  BrandProvider,
  SAMPLE_BRANDS,
  useActiveBrand,
  type BrandOption,
} from "./BrandContext";

/**
 * Unit tests for the active-Brand session context (App Shell state).
 *
 * Covers Brand-context propagation that is sticky per session:
 *   - selection drives a shared value consumed across modules (Req 2.5, 3.15),
 *   - selection is persisted to and restored from sessionStorage (sticky per
 *     session) without leaking across sessions.
 *
 * Validates: Requirements 2.5, 3.15
 */

const TEST_BRANDS: readonly BrandOption[] = [
  { id: "kalova", label: "Kalova" },
  { id: "chanira", label: "Chanira" },
  { id: "amk", label: "AMK" },
];

function makeWrapper(
  brands: readonly BrandOption[] = TEST_BRANDS,
  initialBrandId?: string,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BrandProvider brands={brands} initialBrandId={initialBrandId}>
        {children}
      </BrandProvider>
    );
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("BrandProvider / useActiveBrand", () => {
  it("defaults the active Brand to the first available Brand", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.activeBrandId).toBe("kalova");
    expect(result.current.activeBrand).toEqual({ id: "kalova", label: "Kalova" });
    expect(result.current.brands).toEqual(TEST_BRANDS);
  });

  it("honours an explicit initialBrandId", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(TEST_BRANDS, "chanira"),
    });

    expect(result.current.activeBrandId).toBe("chanira");
  });

  it("switches the active Brand and resolves the matching option", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.setActiveBrand("amk"));

    expect(result.current.activeBrandId).toBe("amk");
    expect(result.current.activeBrand).toEqual({ id: "amk", label: "AMK" });
  });

  it("ignores attempts to select a Brand that does not exist", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.setActiveBrand("does-not-exist"));

    expect(result.current.activeBrandId).toBe("kalova");
  });

  it("persists the selection to sessionStorage (sticky per session)", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.setActiveBrand("chanira"));

    expect(window.sessionStorage.getItem(ACTIVE_BRAND_STORAGE_KEY)).toBe(
      "chanira",
    );
  });

  it("restores the sticky selection from sessionStorage on mount", () => {
    window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, "amk");

    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.activeBrandId).toBe("amk");
  });

  it("ignores a persisted Brand that is not in the available list", () => {
    window.sessionStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, "ghost-brand");

    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.activeBrandId).toBe("kalova");
  });

  it("throws when useActiveBrand is used outside a BrandProvider", () => {
    expect(() => renderHook(() => useActiveBrand())).toThrow(
      /must be used within a BrandProvider/,
    );
  });

  it("propagates an active-Brand change to every consumer at once", () => {
    function BrandLabel({ testId }: { testId: string }) {
      const { activeBrand } = useActiveBrand();
      return <span data-testid={testId}>{activeBrand?.label ?? "none"}</span>;
    }

    function Switcher() {
      const { setActiveBrand } = useActiveBrand();
      return (
        <button type="button" onClick={() => setActiveBrand("amk")}>
          switch
        </button>
      );
    }

    render(
      <BrandProvider brands={TEST_BRANDS}>
        <BrandLabel testId="consumer-a" />
        <BrandLabel testId="consumer-b" />
        <Switcher />
      </BrandProvider>,
    );

    expect(screen.getByTestId("consumer-a")).toHaveTextContent("Kalova");
    expect(screen.getByTestId("consumer-b")).toHaveTextContent("Kalova");

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("consumer-a")).toHaveTextContent("AMK");
    expect(screen.getByTestId("consumer-b")).toHaveTextContent("AMK");
  });

  it("exposes the default SAMPLE_BRANDS when no brands prop is given", () => {
    const { result } = renderHook(() => useActiveBrand(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      ),
    });

    expect(result.current.brands).toEqual(SAMPLE_BRANDS);
    expect(result.current.activeBrandId).toBe(SAMPLE_BRANDS[0]?.id);
  });
});
