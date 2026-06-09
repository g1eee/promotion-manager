import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Skeleton,
  SkeletonText,
  SkeletonTable,
  SkeletonCard,
  Spinner,
  SpinnerOverlay,
} from "@ui/components";

/** Count non-overlapping occurrences of a substring. */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Skeleton", () => {
  it("renders the requested shape class and is decorative (aria-hidden)", () => {
    const html = renderToStaticMarkup(<Skeleton shape="circle" width={40} height={40} />);
    expect(html).toContain("pms-skeleton--circle");
    expect(html).toContain('aria-hidden="true"');
  });

  it("defaults to the text shape", () => {
    const html = renderToStaticMarkup(<Skeleton />);
    expect(html).toContain("pms-skeleton--text");
  });
});

describe("SkeletonText", () => {
  it("renders one skeleton line per requested line", () => {
    const html = renderToStaticMarkup(<SkeletonText lines={4} />);
    expect(countOccurrences(html, "pms-skeleton--text")).toBe(4);
  });

  it("announces a loading status to assistive tech", () => {
    const html = renderToStaticMarkup(<SkeletonText lines={2} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Memuat konten");
  });

  it("clamps lines to a minimum of one", () => {
    const html = renderToStaticMarkup(<SkeletonText lines={0} />);
    expect(countOccurrences(html, "pms-skeleton--text")).toBe(1);
  });
});

describe("SkeletonTable", () => {
  it("renders header + body rows with the requested column count", () => {
    const html = renderToStaticMarkup(
      <SkeletonTable rows={3} columns={4} header />,
    );
    // 1 header row + 3 body rows = 4 rows; each row has 4 cells = 16 cells.
    // Match on the class attribute start to avoid double-counting the
    // header's "--header" modifier (same base class appears twice there).
    expect(countOccurrences(html, 'class="pms-skeleton-table__row')).toBe(4);
    expect(countOccurrences(html, "pms-skeleton-table__cell")).toBe(16);
  });

  it("omits the header row when header is false", () => {
    const html = renderToStaticMarkup(
      <SkeletonTable rows={2} columns={2} header={false} />,
    );
    expect(html).not.toContain("pms-skeleton-table__row--header");
  });
});

describe("SkeletonCard", () => {
  it("renders a circular media placeholder only when requested", () => {
    const withMedia = renderToStaticMarkup(<SkeletonCard media lines={2} />);
    const withoutMedia = renderToStaticMarkup(<SkeletonCard lines={2} />);
    expect(withMedia).toContain("pms-skeleton--circle");
    expect(withoutMedia).not.toContain("pms-skeleton--circle");
  });
});

describe("Spinner", () => {
  it("exposes an accessible label by default", () => {
    const html = renderToStaticMarkup(<Spinner label="Menyimpan" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Menyimpan"');
    expect(html).toContain("pms-spinner--md");
  });

  it("is hidden from assistive tech when decorative", () => {
    const html = renderToStaticMarkup(<Spinner decorative />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="status"');
  });

  it("applies the requested size", () => {
    const html = renderToStaticMarkup(<Spinner size="lg" />);
    expect(html).toContain("pms-spinner--lg");
  });
});

describe("SpinnerOverlay", () => {
  it("renders a caption and a busy status region", () => {
    const html = renderToStaticMarkup(
      <SpinnerOverlay caption="Memuat data" />,
    );
    expect(html).toContain("pms-spinner-overlay");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Memuat data");
  });

  it("adds the fill modifier when fill is set", () => {
    const html = renderToStaticMarkup(<SpinnerOverlay fill />);
    expect(html).toContain("pms-spinner-overlay--fill");
  });
});
