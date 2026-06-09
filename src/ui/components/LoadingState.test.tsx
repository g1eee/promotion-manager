// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Spinner, SpinnerOverlay } from "./Spinner";
import { SkeletonText, SkeletonTable, SkeletonCard } from "./Skeleton";

/**
 * Unit tests for the reusable Loading State components (Spinner + Skeleton
 * family) used while listings and panels fetch data.
 *
 * Validates: Requirements 16.6
 */

afterEach(() => {
  cleanup();
});

describe("Spinner", () => {
  it("announces a default loading label to assistive tech", () => {
    render(<Spinner />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Memuat");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("supports a custom label", () => {
    render(<Spinner label="Menyimpan" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Menyimpan");
  });

  it("is hidden from assistive tech when decorative", () => {
    const { container } = render(<Spinner decorative />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SpinnerOverlay", () => {
  it("renders a busy status region with an optional caption", () => {
    render(<SpinnerOverlay caption="Memuat data promo" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Memuat data promo")).toBeInTheDocument();
  });
});

describe("Skeleton loading placeholders", () => {
  it("SkeletonText renders a busy, labelled status region", () => {
    render(<SkeletonText lines={3} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Memuat konten")).toBeInTheDocument();
  });

  it("SkeletonTable announces a table-loading label", () => {
    render(<SkeletonTable rows={3} columns={4} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Memuat data tabel")).toBeInTheDocument();
  });

  it("SkeletonCard announces a card-loading label", () => {
    render(<SkeletonCard lines={2} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Memuat kartu")).toBeInTheDocument();
  });

  it("accepts a custom loading label", () => {
    render(<SkeletonTable label="Memuat riwayat promo" />);
    expect(screen.getByText("Memuat riwayat promo")).toBeInTheDocument();
  });
});
