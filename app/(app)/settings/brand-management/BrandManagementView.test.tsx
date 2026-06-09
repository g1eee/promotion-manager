// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ToastProvider } from "@ui/components";
import { BrandStatus } from "@domain/enums";
import type { Brand } from "@domain/types";
import { BrandManagementView } from "./BrandManagementView";

/**
 * Unit tests for the Brand Management screen (Task 5.3, Req 19).
 *
 * `fetch` is mocked and routed by URL + method so the component exercises its
 * real load/create/edit/archive/delete flows against canned API responses.
 *
 * Validates: Requirements 19.1, 19.3, 19.5, 19.6, 19.7, 19.9
 */

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  const now = new Date();
  return {
    id: "brand-kalova",
    brandId: "KALOVA",
    brandName: "Kalova",
    displayName: "Kalova",
    status: BrandStatus.Active,
    createdBy: "user-spv",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** A JSON Response helper matching the fetch contract the view expects. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface RouteHandlers {
  list?: () => Response;
  create?: (body: Record<string, unknown>) => Response;
  update?: (id: string, body: Record<string, unknown>) => Response;
  archive?: (id: string) => Response;
  remove?: (id: string) => Response;
}

/** Install a fetch mock that dispatches on method + URL path. */
function installFetch(handlers: RouteHandlers): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const archiveMatch = url.match(/\/api\/brands\/([^/]+)\/archive$/);
    const idMatch = url.match(/\/api\/brands\/([^/]+)$/);

    if (method === "GET" && url.endsWith("/api/brands")) {
      return handlers.list?.() ?? jsonResponse([]);
    }
    if (method === "POST" && url.endsWith("/api/brands")) {
      return handlers.create?.(body) ?? jsonResponse(makeBrand(), 201);
    }
    if (method === "POST" && archiveMatch) {
      return handlers.archive?.(archiveMatch[1] ?? "") ?? jsonResponse(makeBrand());
    }
    if (method === "PATCH" && idMatch) {
      return handlers.update?.(idMatch[1] ?? "", body) ?? jsonResponse(makeBrand());
    }
    if (method === "DELETE" && idMatch) {
      return handlers.remove?.(idMatch[1] ?? "") ?? jsonResponse({ ok: true });
    }
    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView() {
  return render(
    <ToastProvider>
      <BrandManagementView />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BrandManagementView", () => {
  it("lists Brands returned by the API (Req 19.1, 19.9)", async () => {
    installFetch({
      list: () =>
        jsonResponse([
          makeBrand(),
          makeBrand({ id: "brand-amk", brandId: "AMK", brandName: "AMK Group", displayName: "AMK Store" }),
        ]),
    });

    renderView();

    expect(await screen.findByText("KALOVA")).toBeInTheDocument();
    expect(screen.getByText("AMK")).toBeInTheDocument();
    expect(screen.getByText("AMK Store")).toBeInTheDocument();
  });

  it("shows an empty state when there are no Brands", async () => {
    installFetch({ list: () => jsonResponse([]) });

    renderView();

    expect(await screen.findByText("Belum ada Brand")).toBeInTheDocument();
  });

  it("creates a Brand and shows a success toast (Req 19.1)", async () => {
    let listCalls = 0;
    installFetch({
      list: () => {
        listCalls += 1;
        return listCalls === 1
          ? jsonResponse([])
          : jsonResponse([makeBrand({ brandId: "CHANIRA", displayName: "Chanira" })]);
      },
      create: (body) =>
        jsonResponse(
          makeBrand({ brandId: String(body.brandId), displayName: String(body.displayName) }),
          201,
        ),
    });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Buat Brand" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Brand ID/), {
      target: { value: "CHANIRA" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Brand Name/), {
      target: { value: "Chanira" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Display Name/), {
      target: { value: "Chanira" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText(/berhasil dibuat/)).toBeInTheDocument();
  });

  it("surfaces a duplicate Brand ID error inline and keeps the modal open (Req 19.3)", async () => {
    installFetch({
      list: () => jsonResponse([]),
      create: () =>
        jsonResponse(
          {
            errorType: "validation",
            message: "Brand ID duplikat.",
            fields: { brandId: 'Brand ID "KALOVA" sudah digunakan oleh Brand lain.' },
          },
          422,
        ),
    });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Buat Brand" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Brand ID/), {
      target: { value: "KALOVA" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Brand Name/), {
      target: { value: "Kalova" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Display Name/), {
      target: { value: "Kalova" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText(/sudah digunakan oleh Brand lain/)).toBeInTheDocument();
    // The modal remains open so nothing is saved on invalid input (Req 19.4).
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("gates an edit on validation: invalid changes show errors and are not saved (Req 19.3)", async () => {
    installFetch({
      list: () => jsonResponse([makeBrand()]),
      update: () =>
        jsonResponse(
          {
            errorType: "validation",
            message: "Data Brand tidak valid.",
            fields: { brandName: "Brand Name wajib diisi." },
          },
          422,
        ),
    });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Edit Brand Kalova/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Brand Name/), {
      target: { value: "   " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByText("Brand Name wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("archives a Brand without deleting it (Req 19.7)", async () => {
    const archive = vi.fn((id: string) =>
      jsonResponse(makeBrand({ id, status: BrandStatus.Archived })),
    );
    installFetch({ list: () => jsonResponse([makeBrand()]), archive });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Arsipkan Brand Kalova/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Arsipkan" }));

    expect(await screen.findByText(/telah diarsipkan/)).toBeInTheDocument();
    expect(archive).toHaveBeenCalledWith("brand-kalova");
  });

  it("rejects deleting a Brand with related data and guides toward Archive (Req 19.6)", async () => {
    installFetch({
      list: () => jsonResponse([makeBrand()]),
      remove: () =>
        jsonResponse(
          {
            errorType: "constraint",
            message:
              "Brand masih memiliki data terkait (Product, Campaign, atau Promo_Scenario); arsipkan Brand sebagai gantinya",
          },
          409,
        ),
    });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Hapus Brand Kalova/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus" }));

    expect(await screen.findByText(/masih memiliki data terkait/)).toBeInTheDocument();
  });

  it("deletes a Brand with no related data (Req 19.5)", async () => {
    const remove = vi.fn(() => jsonResponse({ ok: true }));
    installFetch({ list: () => jsonResponse([makeBrand()]), remove });

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Hapus Brand Kalova/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus" }));

    expect(await screen.findByText(/telah dihapus/)).toBeInTheDocument();
    await waitFor(() => expect(remove).toHaveBeenCalledWith("brand-kalova"));
  });
});
