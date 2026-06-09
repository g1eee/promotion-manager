/**
 * In-memory {@link Persistence} adapter.
 *
 * Implements the {@link UnitOfWork} (all repositories) and
 * {@link TransactionRunner} ports against a single {@link InMemoryStore}. Used
 * by services and tests in place of a database-backed (Prisma) adapter.
 *
 * Atomicity: `runInTransaction` snapshots the entire store before invoking the
 * work function and restores that snapshot if the work throws/rejects
 * (rollback). On success the mutations are kept (commit). Because the
 * repositories read the store via `this.store.data` on every call, swapping the
 * store's `data` reference on rollback is transparently observed by them.
 *
 * Nested transactions are supported: each level snapshots independently, so an
 * inner rollback only undoes inner work while the outer transaction continues.
 */

import type { Persistence, UnitOfWork } from "../transaction";
import {
  InMemoryApprovalHistoryRepository,
  InMemoryBrandRepository,
  InMemoryCampaignRepository,
  InMemoryCostConfigurationRepository,
  InMemoryExecutionStatusRepository,
  InMemoryFeedbackRecordRepository,
  InMemoryProductRepository,
  InMemoryPromoScenarioRepository,
  InMemoryPromoTemplateRepository,
} from "./repositories";
import { InMemoryStore } from "./store";

export class InMemoryPersistence implements Persistence {
  private readonly store: InMemoryStore;

  readonly brands: InMemoryBrandRepository;
  readonly products: InMemoryProductRepository;
  readonly campaigns: InMemoryCampaignRepository;
  readonly promos: InMemoryPromoScenarioRepository;
  readonly costConfigs: InMemoryCostConfigurationRepository;
  readonly promoTemplates: InMemoryPromoTemplateRepository;
  readonly feedback: InMemoryFeedbackRecordRepository;
  readonly approvalHistory: InMemoryApprovalHistoryRepository;
  readonly executionStatus: InMemoryExecutionStatusRepository;

  constructor(store: InMemoryStore = new InMemoryStore()) {
    this.store = store;
    this.brands = new InMemoryBrandRepository(store);
    this.products = new InMemoryProductRepository(store);
    this.campaigns = new InMemoryCampaignRepository(store);
    this.promos = new InMemoryPromoScenarioRepository(store);
    this.costConfigs = new InMemoryCostConfigurationRepository(store);
    this.promoTemplates = new InMemoryPromoTemplateRepository(store);
    this.feedback = new InMemoryFeedbackRecordRepository(store);
    this.approvalHistory = new InMemoryApprovalHistoryRepository(store);
    this.executionStatus = new InMemoryExecutionStatusRepository(store);
  }

  async runInTransaction<T>(work: (uow: UnitOfWork) => Promise<T> | T): Promise<T> {
    const snapshot = this.store.snapshot();
    try {
      return await work(this);
    } catch (error) {
      this.store.restore(snapshot);
      throw error;
    }
  }

  /** Remove all stored data (test convenience). */
  reset(): void {
    this.store.reset();
  }
}
