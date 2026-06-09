/**
 * Public barrel for the PMS service (Application/Domain) layer.
 *
 * Services orchestrate domain logic over the persistence ports and raise typed
 * validation errors that the API layer maps to HTTP responses.
 */

export { ValidationError } from "./errors";

export {
  CostConfigService,
  COST_COMPONENT_KEYS,
} from "./cost-config-service";
export type {
  CostComponentKey,
  CostComponents,
  CostConfigServiceDeps,
} from "./cost-config-service";

export { BrandService } from "./brand-service";
export type {
  BrandServiceDeps,
  CreateBrandInput,
  UpdateBrandChanges,
} from "./brand-service";

export { ProductService } from "./product-service";
export type {
  ProductServiceDeps,
  CreateProductInput,
  CreateProductResult,
  UpdateProductInput,
  ImportProductsInput,
  ImportProductsResult,
} from "./product-service";

export {
  parseDelimitedContent,
  rowsFromMatrix,
  parseProductImportContent,
} from "./product-import";
export type {
  ProductImportColumn,
  RawImportRow,
  FailedImportRow,
} from "./product-import";

export { CampaignService } from "./campaign-service";
export type {
  CampaignServiceDeps,
  CreateCampaignInput,
  UpdateCampaignChanges,
} from "./campaign-service";

export { PromoService } from "./promo-service";
export type {
  PromoServiceDeps,
  CreatePromoInput,
} from "./promo-service";
