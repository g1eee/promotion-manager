/**
 * Public barrel for the in-memory persistence adapter.
 */

export { InMemoryStore, clone } from "./store";
export type { StoreData } from "./store";
export { InMemoryPersistence } from "./persistence";
export {
  InMemoryApprovalHistoryRepository,
  InMemoryAttachmentRepository,
  InMemoryBrandRepository,
  InMemoryCampaignRepository,
  InMemoryCostConfigurationRepository,
  InMemoryExecutionStatusRepository,
  InMemoryFeedbackRecordRepository,
  InMemoryProductRepository,
  InMemoryPromoScenarioRepository,
  InMemoryPromoTemplateRepository,
} from "./repositories";
