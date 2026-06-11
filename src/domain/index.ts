/**
 * Public barrel for the PMS domain layer.
 *
 * Re-exports the core enums and types so consumers can import from
 * `@domain` (or `src/domain`) without reaching into individual files.
 */

export {
  Role,
  BrandStatus,
  ProductStatus,
  CampaignStatus,
  PromoStatus,
  PromoType,
  ExecutionStatus,
  MarginHealth,
  BenefitType,
} from "./enums";

export {
  RuleBuilder,
  RuleValidationError,
  MIN_RULE_QUANTITY,
} from "./rule-builder";

export { RuleSelector } from "./rule-selector";

export { PromoCalculator } from "./promo-calculator";
export type { PricedProduct } from "./promo-calculator";

export { Simulator, COST_COMPONENT_KEYS } from "./simulator";
export type {
  ActiveCostConfigInfo,
  SimulatedProduct,
  SimulatorProductInput,
} from "./simulator";

export { ProductSelection, ProductSelectionError } from "./product-selection";
export type {
  ProductSelectionItem,
  BulkAddResult,
} from "./product-selection";

export type {
  AuditFields,
  ProductRef,
  Brand,
  Product,
  CostConfiguration,
  Campaign,
  Rule,
  PromoScenario,
  FeedbackRecord,
  ApprovalHistoryEntry,
  Attachment,
  PromoTemplate,
  PromoTemplateConfig,
  PromoTemplateRuleConfig,
} from "./types";
