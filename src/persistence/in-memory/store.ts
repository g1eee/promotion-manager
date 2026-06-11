/**
 * In-memory data store backing the test/persistence adapter.
 *
 * Holds one `Map<id, entity>` per entity type plus snapshot/restore primitives
 * used to implement atomic transactions: a transaction snapshots the entire
 * store on begin and restores it on failure (rollback), keeping mutations on
 * success (commit).
 *
 * Entities are deep-cloned on write and on read (`clone`) so the store remains
 * the single source of truth — external mutation of a returned object can never
 * silently corrupt stored state, mirroring how a real database returns fresh
 * rows. This keeps snapshot/restore correctness independent of caller behavior.
 */

import type {
  ApprovalHistoryEntry,
  Attachment,
  Brand,
  Campaign,
  CostConfiguration,
  FeedbackRecord,
  Product,
  PromoScenario,
  PromoTemplate,
} from "../../domain";

/** Deep clone helper. `structuredClone` preserves Date values and arrays. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** The full set of entity tables held in memory. */
export interface StoreData {
  brands: Map<string, Brand>;
  products: Map<string, Product>;
  campaigns: Map<string, Campaign>;
  promos: Map<string, PromoScenario>;
  costConfigs: Map<string, CostConfiguration>;
  promoTemplates: Map<string, PromoTemplate>;
  feedback: Map<string, FeedbackRecord>;
  approvalHistory: Map<string, ApprovalHistoryEntry>;
  attachments: Map<string, Attachment>;
}

function emptyData(): StoreData {
  return {
    brands: new Map(),
    products: new Map(),
    campaigns: new Map(),
    promos: new Map(),
    costConfigs: new Map(),
    promoTemplates: new Map(),
    feedback: new Map(),
    approvalHistory: new Map(),
    attachments: new Map(),
  };
}

/**
 * Mutable in-memory store. Repositories reference the store (not the inner maps
 * directly) so that a rollback which swaps `data` out remains visible to every
 * repository instance.
 */
export class InMemoryStore {
  data: StoreData = emptyData();

  /** Produce a deep, independent copy of the entire store for rollback. */
  snapshot(): StoreData {
    return {
      brands: cloneMap(this.data.brands),
      products: cloneMap(this.data.products),
      campaigns: cloneMap(this.data.campaigns),
      promos: cloneMap(this.data.promos),
      costConfigs: cloneMap(this.data.costConfigs),
      promoTemplates: cloneMap(this.data.promoTemplates),
      feedback: cloneMap(this.data.feedback),
      approvalHistory: cloneMap(this.data.approvalHistory),
      attachments: cloneMap(this.data.attachments),
    };
  }

  /** Replace the live store with a previously captured snapshot (rollback). */
  restore(snapshot: StoreData): void {
    this.data = snapshot;
  }

  /** Remove all data (test convenience). */
  reset(): void {
    this.data = emptyData();
  }
}

function cloneMap<V>(source: Map<string, V>): Map<string, V> {
  const target = new Map<string, V>();
  for (const [key, value] of source) {
    target.set(key, clone(value));
  }
  return target;
}
