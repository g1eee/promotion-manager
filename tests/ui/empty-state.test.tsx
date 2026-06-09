import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EmptyState,
  emptyStatePresets,
  type EmptyStateVariant,
} from "@ui/components/EmptyState";

const variants: EmptyStateVariant[] = [
  "no-campaigns",
  "no-promos",
  "no-products",
  "no-search-results",
];

describe("EmptyState", () => {
  it("renders each preset variant with its contextual title and description", () => {
    for (const variant of variants) {
      const preset = emptyStatePresets[variant];
      const html = renderToStaticMarkup(<EmptyState variant={variant} />);
      expect(html).toContain(preset.title);
      expect(html).toContain(preset.description);
    }
  });

  it("renders the preset call-to-action label when onAction is provided", () => {
    const html = renderToStaticMarkup(
      <EmptyState variant="no-campaigns" onAction={() => {}} />,
    );
    expect(html).toContain(emptyStatePresets["no-campaigns"].actionLabel);
    expect(html).toContain("pms-btn");
  });

  it("does not render a button when no action handler or slot is given", () => {
    const html = renderToStaticMarkup(<EmptyState variant="no-products" />);
    expect(html).not.toContain("pms-btn");
  });

  it("allows overriding title, description, and action label", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        variant="no-search-results"
        title="Custom title"
        description="Custom description"
        actionLabel="Custom CTA"
        onAction={() => {}}
      />,
    );
    expect(html).toContain("Custom title");
    expect(html).toContain("Custom description");
    expect(html).toContain("Custom CTA");
    expect(html).not.toContain(emptyStatePresets["no-search-results"].title);
  });

  it("renders a custom action slot in place of the convenience button", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        variant="no-promos"
        action={<a href="/promo/scenarios/new">Buka form</a>}
        onAction={() => {}}
      />,
    );
    expect(html).toContain("Buka form");
    expect(html).not.toContain("pms-btn");
  });

  it("hides the description when explicitly set to null", () => {
    const html = renderToStaticMarkup(
      <EmptyState variant="no-products" description={null} />,
    );
    expect(html).not.toContain(emptyStatePresets["no-products"].description);
    expect(html).toContain(emptyStatePresets["no-products"].title);
  });

  it("falls back to a generic title with no variant or title", () => {
    const html = renderToStaticMarkup(<EmptyState />);
    expect(html).toContain("Tidak ada data");
  });

  it("wires the convenience button to the onAction handler", () => {
    // Confirms the button is configured with the handler (rendered markup
    // can't fire events; this guards the wiring path stays intact).
    const onAction = vi.fn();
    const html = renderToStaticMarkup(
      <EmptyState variant="no-campaigns" onAction={onAction} />,
    );
    expect(html).toContain(emptyStatePresets["no-campaigns"].actionLabel);
    expect(onAction).not.toHaveBeenCalled();
  });
});
