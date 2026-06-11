/**
 * Public barrel for the PMS persistence layer.
 *
 * Exposes the framework-agnostic repository/transaction ports and the typed
 * persistence errors, plus the in-memory adapter (for services & tests). A
 * future Prisma adapter implements the same ports without changing consumers.
 */

export type {
  ApprovalHistoryRepository,
  AttachmentRepository,
  BrandRepository,
  CampaignRepository,
  CostConfigurationRepository,
  ExecutionStatusRepository,
  FeedbackRecordRepository,
  ProductRepository,
  PromoScenarioRepository,
  PromoTemplateRepository,
} from "./repositories";

export type { Persistence, TransactionRunner, UnitOfWork } from "./transaction";

export {
  ForeignKeyError,
  NotFoundError,
  PersistenceError,
  ReferentialIntegrityError,
  UniqueConstraintError,
} from "./errors";

export {
  InMemoryPersistence,
  InMemoryStore,
  clone as cloneEntity,
} from "./in-memory";
