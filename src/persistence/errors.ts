/**
 * Persistence-layer error types.
 *
 * These errors model the relational-integrity and constraint failures the
 * persistence layer enforces. They are framework-agnostic so that both the
 * in-memory adapter (tests) and a future Prisma adapter can raise the same
 * semantic errors, letting the Application Layer map them to HTTP responses
 * (validation/constraint → 409/422, system → 500) per the design's Error
 * Handling section.
 *
 * `PersistenceError` is deliberately distinct from generic runtime/system
 * errors so callers can differentiate an expected constraint violation from an
 * unexpected system failure.
 */

/** Base class for all deterministic persistence constraint failures. */
export abstract class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A unique constraint was violated (e.g. duplicate `UNIQUE(brand_id)` or
 * `UNIQUE(brand_id, product_id)`).
 */
export class UniqueConstraintError extends PersistenceError {
  constructor(
    /** Logical entity name, e.g. "Brand" or "Product". */
    public readonly entity: string,
    /** Human-readable constraint description. */
    public readonly constraint: string,
  ) {
    super(`Unique constraint violated on ${entity}: ${constraint}.`);
  }
}

/**
 * A foreign-key reference points to a non-existent parent row (e.g. inserting a
 * Product whose `brandId` has no matching Brand).
 */
export class ForeignKeyError extends PersistenceError {
  constructor(
    public readonly entity: string,
    public readonly reference: string,
  ) {
    super(`Foreign key violation on ${entity}: missing ${reference}.`);
  }
}

/**
 * A delete was rejected because dependent rows still reference the target
 * (e.g. deleting a Brand that still owns Products/Campaigns/Promos, Req 19.6;
 * deleting a Product referenced by a promo, Req 3.10).
 */
export class ReferentialIntegrityError extends PersistenceError {
  constructor(
    public readonly entity: string,
    public readonly detail: string,
  ) {
    super(`Referential integrity violation on ${entity}: ${detail}.`);
  }
}

/** A required row was not found for an update/delete/get-by-id operation. */
export class NotFoundError extends PersistenceError {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} not found: ${id}.`);
  }
}
