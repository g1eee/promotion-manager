import { beforeEach, describe, expect, it } from "vitest";

import {
  MIGRATIONS,
  MigrationError,
  MigrationRunner,
  type Migration,
  type MigrationExecutor,
  type MigrationStateStore,
} from "./index";

/** Records executed SQL for assertions. */
class FakeExecutor implements MigrationExecutor {
  readonly executed: string[] = [];
  async execute(sql: string): Promise<void> {
    this.executed.push(sql);
  }
}

/** In-memory migration ledger. */
class FakeStateStore implements MigrationStateStore {
  private applied = new Set<number>();
  async getApplied(): Promise<number[]> {
    return [...this.applied].sort((a, b) => a - b);
  }
  async markApplied(version: number): Promise<void> {
    this.applied.add(version);
  }
  async markReverted(version: number): Promise<void> {
    this.applied.delete(version);
  }
}

describe("MigrationRunner", () => {
  let executor: FakeExecutor;
  let state: FakeStateStore;

  beforeEach(() => {
    executor = new FakeExecutor();
    state = new FakeStateStore();
  });

  it("applies all pending migrations in order", async () => {
    const runner = new MigrationRunner({ executor, state });
    const ran = await runner.up();

    expect(ran).toEqual(MIGRATIONS.map((m) => m.version));
    expect(await state.getApplied()).toEqual(MIGRATIONS.map((m) => m.version));
    // Core tables are encoded in the executed SQL.
    const sql = executor.executed.join("\n");
    expect(sql).toContain("CREATE TABLE brands");
    expect(sql).toContain("CREATE TABLE promo_scenarios");
    expect(sql).toContain("UNIQUE (brand_id, product_id)");
  });

  it("is idempotent — a second up applies nothing", async () => {
    const runner = new MigrationRunner({ executor, state });
    await runner.up();
    const second = await runner.up();
    expect(second).toEqual([]);
  });

  it("up then down restores the empty schema (round-trip)", async () => {
    const runner = new MigrationRunner({ executor, state });
    await runner.up();
    const reverted = await runner.reset();

    expect(reverted).toEqual([...MIGRATIONS].map((m) => m.version).reverse());
    expect(await state.getApplied()).toEqual([]);
    // down drops every table created by up.
    const downSql = executor.executed
      .filter((sql) => sql.startsWith("DROP TABLE"))
      .join("\n");
    expect(downSql).toContain("DROP TABLE IF EXISTS brands");
    expect(downSql).toContain("DROP TABLE IF EXISTS promo_scenarios");
  });

  it("down reverts only the most recent migration by default", async () => {
    const migrations: Migration[] = [
      { version: 1, name: "first", up: ["CREATE TABLE a (id TEXT)"], down: ["DROP TABLE a"] },
      { version: 2, name: "second", up: ["CREATE TABLE b (id TEXT)"], down: ["DROP TABLE b"] },
    ];
    const runner = new MigrationRunner({ executor, state, migrations });
    await runner.up();

    const reverted = await runner.down();
    expect(reverted).toEqual([2]);
    expect(await state.getApplied()).toEqual([1]);
  });

  it("rejects non-monotonic migration versions", () => {
    const migrations: Migration[] = [
      { version: 2, name: "a", up: [], down: [] },
      { version: 1, name: "b", up: [], down: [] },
    ];
    expect(
      () => new MigrationRunner({ executor, state, migrations }),
    ).toThrowError(MigrationError);
  });
});
