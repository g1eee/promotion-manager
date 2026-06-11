/**
 * Promo Execution services (Req 13, Req 14, Req 18).
 *
 * `AdminExecutionBoard` builds the Approved-only board projection consumed by
 * the Admin Marketplace UI. `ExecutionStatusService` updates the execution
 * state atomically and keeps the previous value when persistence fails.
 */

import { ExecutionStatus, PromoStatus } from "../domain";
import type {
  Brand,
  Campaign,
  Product,
  PromoScenario,
} from "../domain";
import type {
  ApprovalHistoryRepository,
  BrandRepository,
  CampaignRepository,
  ProductRepository,
  PromoScenarioRepository,
  TransactionRunner,
} from "../persistence";
import { NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

export interface ApprovedPromoProduct {
  readonly productId: string;
  readonly namaProduk: string;
  readonly hpp: number;
  readonly hargaJual: number;
}

export interface ApprovedPromoListItem {
  readonly id: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly namaPromo: string;
  readonly promoType: string;
  readonly productCount: number;
  readonly approvedAt: Date;
  readonly executionStatus: ExecutionStatus;
  readonly products: ApprovedPromoProduct[];
}

export interface AdminExecutionBoardDeps {
  readonly promos: PromoScenarioRepository;
  readonly campaigns: CampaignRepository;
  readonly brands: BrandRepository;
  readonly products: ProductRepository;
  readonly approvalHistory: ApprovalHistoryRepository;
}

export interface ExecutionStatusServiceDeps {
  readonly transactionRunner: TransactionRunner;
}

export interface UpdateExecutionStatusInput {
  readonly status: ExecutionStatus;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function matchesBrandKey(brand: Brand, key: string): boolean {
  const normalized = normalizeKey(key);
  const candidates = [
    brand.id,
    brand.brandId,
    brand.brandName,
    brand.displayName,
  ].map(normalizeKey);
  return (
    candidates.includes(normalized) ||
    normalizeKey(brand.id).endsWith(`-${normalized}`)
  );
}

function productKey(brandId: string, productId: string): string {
  return `${brandId}\u0000${productId}`;
}

function validExecutionStatus(status: ExecutionStatus): boolean {
  return Object.values(ExecutionStatus).includes(status);
}

function invalidExecutionStatusError(): ValidationError {
  return new ValidationError("Execution Status tidak valid.", {
    status:
      "Status harus berupa Approved, Sent to Admin, Marketplace Setup, atau Completed.",
  });
}

function nonApprovedPromoError(): ValidationError {
  return new ValidationError("Promo belum Approved.", {
    status: "Execution Status hanya dapat diubah untuk promo Approved.",
  });
}

export class AdminExecutionBoard {
  constructor(private readonly deps: AdminExecutionBoardDeps) {}

  async list(filter: { brandId?: string } = {}): Promise<ApprovedPromoListItem[]> {
    const brands = await this.deps.brands.list();
    const brandId = this.resolveBrandFilter(brands, filter.brandId);
    if (filter.brandId && !brandId) {
      return [];
    }

    const promos = await this.deps.promos.list({
      brandId: brandId ?? undefined,
      status: PromoStatus.Approved,
    });
    const [campaigns, products] = await Promise.all([
      this.deps.campaigns.list(brandId ? { brandId } : undefined),
      this.deps.products.list(brandId ? { brandId } : undefined),
    ]);

    const brandById = new Map(brands.map((brand) => [brand.id, brand]));
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign]),
    );
    const productByRef = new Map(
      products.map((product) => [
        productKey(product.brandId, product.productId),
        product,
      ]),
    );

    const rows: ApprovedPromoListItem[] = [];
    for (const promo of promos) {
      const brand = brandById.get(promo.brandId);
      const campaign = campaignById.get(promo.campaignId);
      if (!brand || !campaign) {
        continue;
      }
      rows.push(
        await this.toApprovedPromoRow(promo, brand, campaign, productByRef),
      );
    }

    return rows.sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime());
  }

  private resolveBrandFilter(
    brands: readonly Brand[],
    brandKey: string | undefined,
  ): string | null {
    if (!brandKey || brandKey.trim() === "") {
      return null;
    }
    return brands.find((brand) => matchesBrandKey(brand, brandKey))?.id ?? null;
  }

  private async toApprovedPromoRow(
    promo: PromoScenario,
    brand: Brand,
    campaign: Campaign,
    productByRef: ReadonlyMap<string, Product>,
  ): Promise<ApprovedPromoListItem> {
    const history = await this.deps.approvalHistory.listByPromo(promo.id);
    const approvedEntry = history
      .filter((entry) => entry.status === PromoStatus.Approved)
      .at(-1);
    const resolvedProducts = promo.productRefs
      .map((ref) => productByRef.get(productKey(ref.brandId, ref.productId)))
      .filter((product): product is Product => product !== undefined)
      .map((product) => ({
        productId: product.productId,
        namaProduk: product.namaProduk,
        hpp: product.hpp,
        hargaJual: product.hargaJual,
      }));

    return {
      id: promo.id,
      brandId: brand.id,
      brandName: brand.displayName,
      campaignId: campaign.id,
      campaignName: campaign.nama,
      namaPromo: promo.namaPromo,
      promoType: promo.promoType,
      productCount: promo.productRefs.length,
      approvedAt: approvedEntry?.changedAt ?? promo.updatedAt,
      executionStatus: promo.executionStatus ?? ExecutionStatus.Approved,
      products: resolvedProducts,
    };
  }
}

export class ExecutionStatusService {
  constructor(private readonly deps: ExecutionStatusServiceDeps) {}

  async update(
    promoId: string,
    input: UpdateExecutionStatusInput,
  ): Promise<PromoScenario> {
    const status = input.status;
    if (!validExecutionStatus(status)) {
      throw invalidExecutionStatusError();
    }

    return this.deps.transactionRunner.runInTransaction(async (uow) => {
      const promo = await uow.promos.findById(promoId);
      if (!promo) {
        throw new NotFoundError("PromoScenario", promoId);
      }
      if (promo.status !== PromoStatus.Approved) {
        throw nonApprovedPromoError();
      }

      await uow.executionStatus.set(promoId, status);
      const withExecutionStatus = await uow.promos.findById(promoId);
      if (!withExecutionStatus) {
        throw new NotFoundError("PromoScenario", promoId);
      }
      return uow.promos.update({
        ...withExecutionStatus,
        updatedAt: new Date(),
      });
    });
  }
}
