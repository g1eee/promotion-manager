/**
 * Service-layer (Application/Domain) error types.
 *
 * These complement the persistence-layer errors (see `../persistence/errors`)
 * by modelling **input validation failures** raised by services *before* any
 * data mutation, as required by the design's Error Handling section
 * (category 1: "Validation Errors"). They carry per-field messages so the API
 * layer can map them to `{ errorType: "validation", message, fields }`
 * responses (400/422).
 *
 * Keeping these distinct from {@link ../persistence/errors.PersistenceError}
 * lets callers differentiate an expected input-validation rejection from a
 * constraint/referential failure or an unexpected system error.
 */

/** Base class for deterministic service-layer validation failures. */
export class ValidationError extends Error {
  /** Discriminant used by the API layer to shape the error response. */
  readonly errorType = "validation" as const;

  constructor(
    message: string,
    /**
     * Optional per-field messages, e.g. `{ adminFee: "harus 0-100" }`.
     * Empty when the failure is not attributable to specific fields.
     */
    public readonly fields: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}
