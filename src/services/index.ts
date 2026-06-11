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
  CreateInlineCampaignInput,
  UpdateCampaignChanges,
} from "./campaign-service";

export { PromoService } from "./promo-service";
export type {
  PromoServiceDeps,
  CreatePromoInput,
  CreatePromoWithInlineCampaignInput,
  CreateRuleInput,
  PromoProductSelection,
  UpdatePromoChanges,
} from "./promo-service";

export { PromoCloneService } from "./promo-clone-service";
export type { PromoCloneServiceDeps } from "./promo-clone-service";

export { PromoSimulatorService } from "./promo-simulator-service";
export type {
  PromoSimulationResult,
  PromoSimulatorCostConfigReader,
  PromoSimulatorServiceDeps,
  PromoSimulatorSummary,
  SimulatePromoInput,
  SimulatedPromoRow,
} from "./promo-simulator-service";

export { ApprovalService } from "./approval-service";
export type {
  ApprovalServiceDeps,
  ChangeApprovalStatusInput,
} from "./approval-service";

export {
  AdminExecutionBoard,
  ExecutionStatusService,
} from "./promo-execution-service";
export type {
  AdminExecutionBoardDeps,
  ApprovedPromoListItem,
  ApprovedPromoProduct,
  ExecutionStatusServiceDeps,
  UpdateExecutionStatusInput,
} from "./promo-execution-service";

export { PromoHistoryService } from "./promo-history-service";
export type {
  PromoHistoryItem,
  PromoHistorySearch,
  PromoHistoryServiceDeps,
} from "./promo-history-service";

export { FeedbackService } from "./feedback-service";
export type {
  AddFeedbackInput,
  FeedbackServiceDeps,
} from "./feedback-service";

export { ApprovalHistoryService } from "./approval-history-service";
export type {
  ApprovalHistoryItem,
  ApprovalHistoryServiceDeps,
} from "./approval-history-service";

export { PromoTemplateService, BUILT_IN_TEMPLATES } from "./promo-template-service";
export type {
  PromoTemplateInput,
  PromoTemplateServiceDeps,
} from "./promo-template-service";

export { CampaignHistoryService } from "./campaign-history-service";
export type {
  CampaignHistoryFilter,
  CampaignHistoryItem,
  CampaignHistoryServiceDeps,
} from "./campaign-history-service";

export { AttachmentService, FeatureDisabledError } from "./attachment-service";
export type {
  AttachmentServiceDeps,
  UploadAttachmentInput,
} from "./attachment-service";

export { CombinedPromoExecutionService } from "./combined-execution-service";
export type {
  CombinedExecutionRow,
  CombinedPromoExecutionServiceDeps,
} from "./combined-execution-service";

export { DashboardService } from "./dashboard-service";
export type {
  ActiveCampaignCard,
  DashboardRecentActivity,
  DashboardServiceDeps,
  DashboardSummary,
  DashboardSummaryQuery,
  DashboardWidgets,
  DashboardWorkQueue,
  RecentApprovalActivity,
  RecentCampaignActivity,
  RecentPromoActivity,
  UpcomingPromo,
} from "./dashboard-service";
