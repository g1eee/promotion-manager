/**
 * Versioned database migration framework (Deployment Readiness, Task 26.2).
 *
 * Encodes the PMS entity schema (Brand, Product, Campaign, Promo_Scenario,
 * Cost_Configuration, Promo_Template, Feedback_Record, Approval_History,
 * Execution_Status) as ordered, reversible migrations with `up`/`down` SQL and
 * enforces relational integrity (FK ownership by Brand, UNIQUE(brandId,
 * productId), etc.) consistent with the persistence model.
 *
 * The {@link MigrationRunner} is adapter-agnostic: it executes statements
 * through an injected {@link MigrationExecutor} port and tracks applied versions
 * via {@link MigrationStateStore}. A real deployment supplies a Postgres-backed
 * executor/state store; tests supply in-memory fakes. This keeps the framework
 * free of a hard database-driver dependency while still being exercisable.
 */

/** Executes a single SQL statement against the target database. */
export interface MigrationExecutor {
  execute(sql: string): Promise<void>;
}

/** Tracks which migration versions have been applied (the migrations ledger). */
export interface MigrationStateStore {
  /** Applied versions, ascending. */
  getApplied(): Promise<number[]>;
  /** Record a version as applied. */
  markApplied(version: number): Promise<void>;
  /** Remove a version's applied record (on rollback). */
  markReverted(version: number): Promise<void>;
}

/** A single reversible migration. */
export interface Migration {
  /** Monotonic version number; migrations apply in ascending order. */
  readonly version: number;
  /** Human-readable name. */
  readonly name: string;
  /** Statements that move the schema forward. */
  readonly up: readonly string[];
  /** Statements that exactly reverse `up`, in reverse dependency order. */
  readonly down: readonly string[];
}

/**
 * The ordered PMS migration set. Migration 1 creates every entity table with
 * its constraints; `down` drops them in reverse dependency order so a full
 * `up` then `down` restores the empty schema (idempotent round-trip).
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "create_core_schema",
    up: [
      `CREATE TABLE brands (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL UNIQUE,
        brand_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE products (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL REFERENCES brands(id),
        product_id TEXT NOT NULL,
        nama_produk TEXT NOT NULL,
        kategori TEXT NOT NULL,
        hpp NUMERIC(14,2) NOT NULL,
        harga_jual NUMERIC(14,2) NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (brand_id, product_id)
      )`,
      `CREATE TABLE cost_configurations (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL UNIQUE REFERENCES brands(id),
        admin_fee NUMERIC(5,2) NOT NULL,
        shipping_fee NUMERIC(5,2) NOT NULL,
        promo_xtra NUMERIC(5,2) NOT NULL,
        fee_pesanan NUMERIC(5,2) NOT NULL,
        campaign_fee NUMERIC(5,2) NOT NULL,
        promosi_fee NUMERIC(5,2) NOT NULL,
        marketing_fee NUMERIC(5,2) NOT NULL,
        ads_spending NUMERIC(5,2) NOT NULL,
        affiliate_commission NUMERIC(5,2) NOT NULL,
        operating_cost NUMERIC(5,2) NOT NULL,
        is_active BOOLEAN NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE campaigns (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL REFERENCES brands(id),
        nama TEXT NOT NULL,
        tanggal_mulai TIMESTAMPTZ NOT NULL,
        tanggal_selesai TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE promo_scenarios (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL REFERENCES brands(id),
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        nama_promo TEXT NOT NULL,
        promo_type TEXT NOT NULL,
        tanggal_mulai TIMESTAMPTZ NOT NULL,
        tanggal_selesai TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        execution_status TEXT,
        rules JSONB NOT NULL DEFAULT '[]',
        product_refs JSONB NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE promo_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        promo_type TEXT,
        config JSONB NOT NULL,
        is_built_in BOOLEAN NOT NULL,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE feedback_records (
        id TEXT PRIMARY KEY,
        promo_ref TEXT NOT NULL REFERENCES promo_scenarios(id),
        message TEXT NOT NULL,
        created_by_user TEXT NOT NULL,
        created_date TIMESTAMPTZ NOT NULL,
        read_by JSONB NOT NULL DEFAULT '[]'
      )`,
      `CREATE TABLE approval_history (
        id TEXT PRIMARY KEY,
        promo_ref TEXT NOT NULL REFERENCES promo_scenarios(id),
        status TEXT NOT NULL,
        changed_by TEXT,
        changed_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE INDEX idx_products_brand ON products(brand_id)`,
      `CREATE INDEX idx_campaigns_brand ON campaigns(brand_id)`,
      `CREATE INDEX idx_promos_brand ON promo_scenarios(brand_id)`,
      `CREATE INDEX idx_promos_campaign ON promo_scenarios(campaign_id)`,
      `CREATE INDEX idx_feedback_promo ON feedback_records(promo_ref)`,
      `CREATE INDEX idx_approval_promo ON approval_history(promo_ref)`,
    ],
    down: [
      `DROP INDEX IF EXISTS idx_approval_promo`,
      `DROP INDEX IF EXISTS idx_feedback_promo`,
      `DROP INDEX IF EXISTS idx_promos_campaign`,
      `DROP INDEX IF EXISTS idx_promos_brand`,
      `DROP INDEX IF EXISTS idx_campaigns_brand`,
      `DROP INDEX IF EXISTS idx_products_brand`,
      `DROP TABLE IF EXISTS approval_history`,
      `DROP TABLE IF EXISTS feedback_records`,
      `DROP TABLE IF EXISTS promo_templates`,
      `DROP TABLE IF EXISTS promo_scenarios`,
      `DROP TABLE IF EXISTS campaigns`,
      `DROP TABLE IF EXISTS cost_configurations`,
      `DROP TABLE IF EXISTS products`,
      `DROP TABLE IF EXISTS brands`,
    ],
  },
];

/** Raised when the migration set is malformed (e.g. non-monotonic versions). */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

function assertOrdered(migrations: readonly Migration[]): void {
  for (let index = 1; index < migrations.length; index += 1) {
    const prev = migrations[index - 1]!;
    const current = migrations[index]!;
    if (current.version <= prev.version) {
      throw new MigrationError(
        `Migration versions must be strictly ascending; found ${prev.version} then ${current.version}.`,
      );
    }
  }
}

export interface MigrationRunnerDeps {
  readonly executor: MigrationExecutor;
  readonly state: MigrationStateStore;
  /** Defaults to the canonical {@link MIGRATIONS} set. */
  readonly migrations?: readonly Migration[];
}

/**
 * Applies and reverts migrations in order, tracking applied versions so `up` is
 * idempotent (already-applied migrations are skipped) and `down` rolls back the
 * most recent migrations.
 */
export class MigrationRunner {
  private readonly migrations: readonly Migration[];

  constructor(private readonly deps: MigrationRunnerDeps) {
    this.migrations = deps.migrations ?? MIGRATIONS;
    assertOrdered(this.migrations);
  }

  /**
   * Apply every migration not yet applied, in ascending order. Returns the
   * versions applied during this run (empty when already up to date).
   */
  async up(): Promise<number[]> {
    const applied = new Set(await this.deps.state.getApplied());
    const ran: number[] = [];
    for (const migration of this.migrations) {
      if (applied.has(migration.version)) {
        continue;
      }
      for (const sql of migration.up) {
        await this.deps.executor.execute(sql);
      }
      await this.deps.state.markApplied(migration.version);
      ran.push(migration.version);
    }
    return ran;
  }

  /**
   * Revert the `steps` most recently applied migrations (default 1), running
   * their `down` statements in reverse version order. Returns the versions
   * reverted.
   */
  async down(steps = 1): Promise<number[]> {
    const applied = (await this.deps.state.getApplied()).sort((a, b) => a - b);
    const toRevert = applied.slice(Math.max(0, applied.length - steps)).reverse();
    const reverted: number[] = [];
    for (const version of toRevert) {
      const migration = this.migrations.find((m) => m.version === version);
      if (!migration) {
        throw new MigrationError(
          `Cannot revert version ${version}: definition not found.`,
        );
      }
      for (const sql of migration.down) {
        await this.deps.executor.execute(sql);
      }
      await this.deps.state.markReverted(version);
      reverted.push(version);
    }
    return reverted;
  }

  /** Revert every applied migration (full teardown). */
  async reset(): Promise<number[]> {
    const applied = await this.deps.state.getApplied();
    return this.down(applied.length);
  }
}
