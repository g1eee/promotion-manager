// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  EmptyState,
  emptyStatePresets,
  type EmptyStateVariant,
} from "./EmptyState";

/**
 * Unit tests for the reusable Empty State component and its preset variants
 * (No Campaigns / No Promos / No Products / No Search Results).
 *
 * The "No Search Results" variant backs the cleared-search empty state for
 * listings such as Promo History.
 *
 * Validates: Requirements 16.6
 */

const VARIANTS: EmptyStateVariant[] = [
  "no-campaigns",
  "no-promos",
  "no-products",
  "no-search-results",
];

afterEach(() => {
  cleanup();
});

describe("EmptyState variants", () => {
  it.each(VARIANTS)(
    "renders preset title and description for the %s variant",
    (variant) => {
      render(<EmptyState variant={variant} />);

      const preset = emptyStatePresets[variant];
      expect(screen.getByText(preset.title)).toBeInTheDocument();
      expect(screen.getByText(preset.description)).toBeInTheDocument();
    },
  );

  it("exposes the empty state to assistive tech via role=status", () => {
    render(<EmptyState variant="no-campaigns" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a CTA button with the preset label and invokes onAction", () => {
    const onAction = vi.fn();
    render(<EmptyState variant="no-products" onAction={onAction} />);

    const button = screen.getByRole("button", {
      name: emptyStatePresets["no-products"].actionLabel,
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("allows overriding the CTA label", () => {
    render(
      <EmptyState
        variant="no-search-results"
        onAction={() => {}}
        actionLabel="Hapus Filter"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hapus Filter" }),
    ).toBeInTheDocument();
  });
});

describe("EmptyState custom content", () => {
  it("renders a fully custom title/description without a variant", () => {
    render(<EmptyState title="Kosong" description="Tidak ada apa-apa" />);

    expect(screen.getByText("Kosong")).toBeInTheDocument();
    expect(screen.getByText("Tidak ada apa-apa")).toBeInTheDocument();
  });

  it("falls back to a generic title when nothing is provided", () => {
    render(<EmptyState />);
    expect(screen.getByText("Tidak ada data")).toBeInTheDocument();
  });

  it("custom title overrides the preset title", () => {
    render(<EmptyState variant="no-campaigns" title="Custom" />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(
      screen.queryByText(emptyStatePresets["no-campaigns"].title),
    ).not.toBeInTheDocument();
  });

  it("hides the description when explicitly set to null", () => {
    render(<EmptyState variant="no-campaigns" description={null} />);

    expect(
      screen.queryByText(emptyStatePresets["no-campaigns"].description),
    ).not.toBeInTheDocument();
  });

  it("renders a custom action slot in place of the convenience button", () => {
    render(
      <EmptyState
        variant="no-promos"
        onAction={() => {}}
        action={<a href="/promo/scenarios">Lihat semua</a>}
      />,
    );

    expect(screen.getByRole("link", { name: "Lihat semua" })).toBeInTheDocument();
    // The convenience button is suppressed when a custom action is supplied.
    expect(
      screen.queryByRole("button", {
        name: emptyStatePresets["no-promos"].actionLabel,
      }),
    ).not.toBeInTheDocument();
  });
});
