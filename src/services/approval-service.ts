/**
 * ApprovalService - promo approval workflow (Req 12, Req 17.2/17.3).
 *
 * Changes Promo_Scenario status and appends Approval_History inside one
 * transaction so a history write failure rolls back the status change.
 */

import { ExecutionStatus, PromoStatus } from "../domain";
import type { ApprovalHistoryEntry, PromoScenario } from "../domain";
import type { TransactionRunner } from "../persistence";
import { NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

export interface ApprovalServiceDeps {
  readonly transactionRunner: TransactionRunner;
}

export interface ChangeApprovalStatusInput {
  readonly status: PromoStatus;
}

const WORKFLOW_STATUSES: readonly PromoStatus[] = [
  PromoStatus.Draft,
  PromoStatus.Review,
  PromoStatus.Approved,
  PromoStatus.Rejected,
];

const ALLOWED_TRANSITIONS: Readonly<Record<PromoStatus, readonly PromoStatus[]>> = {
  [PromoStatus.Draft]: [PromoStatus.Review],
  [PromoStatus.Review]: [PromoStatus.Approved, PromoStatus.Rejected],
  [PromoStatus.Approved]: [],
  [PromoStatus.Rejected]: [PromoStatus.Review],
  [PromoStatus.Active]: [],
  [PromoStatus.Completed]: [],
};

function invalidStatusError(): ValidationError {
  return new ValidationError("Status approval tidak valid.", {
    status: "Status harus berupa Draft, Review, Approved, atau Rejected.",
  });
}

function transitionError(current: PromoStatus, next: PromoStatus): ValidationError {
  return new ValidationError("Transisi status approval tidak valid.", {
    status: `Promo berstatus ${current} tidak dapat diubah ke ${next}.`,
  });
}

function executionStatusFor(status: PromoStatus): ExecutionStatus | null {
  return status === PromoStatus.Approved ? ExecutionStatus.Approved : null;
}

export class ApprovalService {
  constructor(private readonly deps: ApprovalServiceDeps) {}

  /**
   * Change a promo approval status and append exactly one Approval_History entry
   * for that successful change. Both writes commit or roll back together.
   */
  async changeStatus(
    promoId: string,
    input: ChangeApprovalStatusInput,
    actor: string,
  ): Promise<PromoScenario> {
    const nextStatus = input.status;
    if (!WORKFLOW_STATUSES.includes(nextStatus)) {
      throw invalidStatusError();
    }

    return this.deps.transactionRunner.runInTransaction(async (uow) => {
      const existing = await uow.promos.findById(promoId);
      if (!existing) {
        throw new NotFoundError("PromoScenario", promoId);
      }

      const allowedNext = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowedNext.includes(nextStatus)) {
        throw transitionError(existing.status, nextStatus);
      }

      const now = new Date();
      const updated = await uow.promos.update({
        ...existing,
        status: nextStatus,
        executionStatus: executionStatusFor(nextStatus),
        updatedAt: now,
      });

      const history: ApprovalHistoryEntry = {
        id: crypto.randomUUID(),
        promoRef: promoId,
        status: nextStatus,
        changedBy: actor,
        changedAt: now,
      };
      await uow.approvalHistory.insert(history);

      return updated;
    });
  }
}
