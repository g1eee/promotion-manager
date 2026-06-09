/**
 * Transaction / Unit-of-Work ports.
 *
 * `UnitOfWork` groups every repository behind one cohesive handle so a service
 * can perform a multi-entity operation against a single, consistent context
 * (e.g. change promo status AND append Approval_History together, Req 17.3).
 *
 * `TransactionRunner.runInTransaction` executes `work` atomically: if `work`
 * resolves, all mutations commit; if `work` throws/rejects, every mutation is
 * rolled back and the original error propagates. This is the contract services
 * rely on for atomicity (Req 17.3 status+history, Req 18.4 execution status,
 * Req 4 cost-config range validation).
 */

import type {
  ApprovalHistoryRepository,
  BrandRepository,
  CampaignRepository,
  CostConfigurationRepository,
  ExecutionStatusRepository,
  FeedbackRecordRepository,
  ProductRepository,
  PromoScenarioRepository,
  PromoTemplateRepository,
} from "./repositories";

/** Cohesive handle exposing all repositories for a single consistent context. */
export interface UnitOfWork {
  readonly brands: BrandRepository;
  readonly products: ProductRepository;
  readonly campaigns: CampaignRepository;
  readonly promos: PromoScenarioRepository;
  readonly costConfigs: CostConfigurationRepository;
  readonly promoTemplates: PromoTemplateRepository;
  readonly feedback: FeedbackRecordRepository;
  readonly approvalHistory: ApprovalHistoryRepository;
  readonly executionStatus: ExecutionStatusRepository;
}

/** Runs a unit of work atomically with commit-on-success / rollback-on-error. */
export interface TransactionRunner {
  /**
   * Execute `work` atomically. All persistence mutations performed via the
   * provided {@link UnitOfWork} commit only if `work` completes successfully;
   * any thrown error rolls them all back before the error is re-thrown.
   */
  runInTransaction<T>(work: (uow: UnitOfWork) => Promise<T> | T): Promise<T>;
}

/**
 * Full persistence facade: the repositories are directly usable for
 * auto-committing single operations, and {@link TransactionRunner} groups
 * several operations into one atomic unit.
 */
export interface Persistence extends UnitOfWork, TransactionRunner {}
