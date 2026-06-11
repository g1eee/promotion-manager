/**
 * CombinedPromoExecutionService — optional unified Promo Execution view
 * (Req 22, nice-to-have).
 *
 * Behind the `combined-execution` feature flag, presents a single projection
 * that merges the Approved promos list (Req 13) with each promo's
 * Execution_Status (Req 18) — Approved / Sent to Admin / Marketplace Setup /
 * Completed (Req 22.2). It does NOT introduce a new data source: it delegates
 * to {@link AdminExecutionBoard} so the mandatory Approved_Promos and
 * Execution_Status capabilities remain the source of truth (Req 22.3).
 *
 * When the flag is off, {@link list} throws {@link FeatureDisabledError} so the
 * combined view stays dormant while the underlying mandatory screens keep
 * working independently.
 */

import type { AdminExecutionBoard, ApprovedPromoListItem } from "./promo-execution-service";
import { FeatureDisabledError } from "./attachment-service";

export interface CombinedPromoExecutionServiceDeps {
  readonly board: AdminExecutionBoard;
  /** Whether the `combined-execution` feature flag is enabled. */
  readonly enabled: boolean;
}

/** A combined row: Approved promo plus its Execution_Status (Req 22.1, 22.2). */
export type CombinedExecutionRow = ApprovedPromoListItem;

export class CombinedPromoExecutionService {
  constructor(private readonly deps: CombinedPromoExecutionServiceDeps) {}

  /**
   * Build the combined Approved + Execution_Status view (Req 22.1). Reuses the
   * Admin board projection as the single source (Req 22.3), optionally scoped by
   * the active Brand context.
   *
   * @throws {FeatureDisabledError} when the feature flag is off.
   */
  async list(filter: { brandId?: string } = {}): Promise<CombinedExecutionRow[]> {
    if (!this.deps.enabled) {
      throw new FeatureDisabledError("combined-execution");
    }
    return this.deps.board.list(filter);
  }
}
