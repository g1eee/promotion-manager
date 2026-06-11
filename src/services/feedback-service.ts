/**
 * FeedbackService — two-way discussion thread on a Promo_Scenario (Req 14.4–14.6,
 * Req 1.4, 1.5).
 *
 * A Promo_Scenario can carry many {@link FeedbackRecord} entries, each preserved
 * as a separate, structured note (Feedback Message, Created By User, Created
 * Date, Promo Reference). Any role with access to the promo — SPV_Marketing or
 * Admin_Marketplace — may append to the thread; this service does not itself
 * enforce role (the API layer gates create via RBAC, Req 1.5), it only validates
 * the message and the target promo, then persists an immutable record.
 *
 * `list` returns the full thread oldest-first with each note's Created By User
 * and Created Date intact (Req 14.5, 14.6). The service depends only on
 * repository ports so it works against the in-memory adapter in tests and a
 * database-backed adapter later without code changes.
 */

import type { FeedbackRecord } from "../domain";
import type {
  FeedbackRecordRepository,
  PromoScenarioRepository,
} from "../persistence";
import { ForeignKeyError, NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

/** Repository ports required by {@link FeedbackService}. */
export interface FeedbackServiceDeps {
  readonly feedback: FeedbackRecordRepository;
  readonly promos: PromoScenarioRepository;
}

/** Fields required to add a feedback note to a promo (Req 14.4). */
export interface AddFeedbackInput {
  /** Free-text discussion message; must be non-empty after trimming. */
  message: string;
}

function emptyMessageError(): ValidationError {
  return new ValidationError("Feedback tidak valid.", {
    message: "Pesan feedback wajib diisi.",
  });
}

export class FeedbackService {
  constructor(private readonly deps: FeedbackServiceDeps) {}

  /**
   * Append a structured {@link FeedbackRecord} to a promo's thread (Req 14.4).
   *
   * Validates that the message is non-empty and the target promo exists, then
   * stamps Created By User / Created Date and persists the note. Many records
   * per promo are supported; each is kept as a separate entry (Req 14.4).
   *
   * @param promoId Promo Reference (Promo_Scenario id).
   * @param input The feedback message.
   * @param actor Identifier of the creating user (Created By User).
   * @throws {ValidationError} when the message is blank.
   * @throws {NotFoundError} when the target promo does not exist.
   */
  async add(
    promoId: string,
    input: AddFeedbackInput,
    actor: string,
  ): Promise<FeedbackRecord> {
    const message =
      typeof input.message === "string" ? input.message.trim() : "";
    if (message === "") {
      throw emptyMessageError();
    }

    const promo = await this.deps.promos.findById(promoId);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoId);
    }

    const record: FeedbackRecord = {
      id: crypto.randomUUID(),
      promoRef: promoId,
      message,
      createdByUser: actor,
      createdDate: new Date(),
      // The author has implicitly read their own note (Unread Feedback, Req 2.6).
      readBy: [actor],
    };

    try {
      return await this.deps.feedback.insert(record);
    } catch (error) {
      if (error instanceof ForeignKeyError) {
        throw new NotFoundError("PromoScenario", promoId);
      }
      throw error;
    }
  }

  /**
   * Return the full feedback thread for a promo, oldest-first, with each note's
   * Created By User and Created Date preserved (Req 14.5, 14.6).
   *
   * @param promoId Promo Reference (Promo_Scenario id).
   * @throws {NotFoundError} when the target promo does not exist.
   */
  async list(promoId: string): Promise<FeedbackRecord[]> {
    const promo = await this.deps.promos.findById(promoId);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoId);
    }
    return this.deps.feedback.listByPromo(promoId);
  }
}
