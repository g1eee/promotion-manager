/**
 * Database backup & restore strategy (Deployment Readiness, Task 26.3).
 *
 * Provides a schedulable backup/restore workflow with result verification to
 * protect historical promo/campaign data continuity. Like the migration
 * framework, it is adapter-agnostic: the actual dump/restore is performed
 * through an injected {@link BackupEngine} port (a real deployment wraps
 * `pg_dump`/`pg_restore`), while a checksum-based {@link verifyBackup} guards
 * against silent corruption.
 *
 * The pure orchestration here — naming, scheduling cadence, verification, and
 * retention pruning — is fully testable without a live database.
 */

/** Metadata describing a produced backup artifact. */
export interface BackupArtifact {
  /** Stable artifact identifier / filename. */
  readonly id: string;
  /** When the backup was taken. */
  readonly createdAt: Date;
  /** Size in bytes of the produced dump. */
  readonly sizeBytes: number;
  /** Content checksum used to verify integrity on restore. */
  readonly checksum: string;
}

/** Performs the low-level dump/restore against the target database. */
export interface BackupEngine {
  /** Produce a dump and return its artifact metadata. */
  dump(artifactId: string): Promise<BackupArtifact>;
  /** Recompute the checksum of a stored artifact (for verification). */
  checksumOf(artifactId: string): Promise<string>;
  /** Restore the database from a stored artifact. */
  restore(artifactId: string): Promise<void>;
  /** Delete a stored artifact (retention pruning). */
  remove(artifactId: string): Promise<void>;
  /** List stored artifacts, newest-first. */
  list(): Promise<BackupArtifact[]>;
}

/** Raised when a backup or restore fails verification. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

/** Build a deterministic, sortable backup id from a timestamp. */
export function backupArtifactId(now: Date, prefix = "pms-backup"): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${iso}`;
}

export interface BackupServiceDeps {
  readonly engine: BackupEngine;
  /** Clock injection for deterministic ids/tests. Defaults to `Date`. */
  readonly now?: () => Date;
}

export class BackupService {
  private readonly now: () => Date;

  constructor(private readonly deps: BackupServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Create a verified backup. Produces the dump, then re-reads its checksum and
   * compares to the recorded one; a mismatch throws {@link BackupError} so a
   * corrupt backup never passes silently.
   */
  async backup(): Promise<BackupArtifact> {
    const artifactId = backupArtifactId(this.now());
    const artifact = await this.deps.engine.dump(artifactId);

    const verified = await this.verify(artifact);
    if (!verified) {
      throw new BackupError(
        `Backup "${artifactId}" failed verification: checksum mismatch.`,
      );
    }
    return artifact;
  }

  /**
   * Verify a stored backup by recomputing its checksum and comparing it to the
   * artifact's recorded checksum. A zero-byte dump is treated as invalid.
   */
  async verify(artifact: BackupArtifact): Promise<boolean> {
    if (artifact.sizeBytes <= 0) {
      return false;
    }
    const actual = await this.deps.engine.checksumOf(artifact.id);
    return actual === artifact.checksum;
  }

  /**
   * Restore from a stored artifact after verifying its integrity. Throws
   * {@link BackupError} when the artifact is missing or fails verification, so a
   * corrupt backup is never restored.
   */
  async restore(artifactId: string): Promise<void> {
    const artifacts = await this.deps.engine.list();
    const artifact = artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      throw new BackupError(`Backup "${artifactId}" not found.`);
    }
    const verified = await this.verify(artifact);
    if (!verified) {
      throw new BackupError(
        `Refusing to restore "${artifactId}": failed verification.`,
      );
    }
    await this.deps.engine.restore(artifactId);
  }

  /**
   * Prune backups beyond a retention count, keeping the `keep` newest and
   * removing the rest. Returns the ids removed.
   */
  async pruneOldBackups(keep: number): Promise<string[]> {
    if (keep < 0) {
      throw new BackupError("Retention count must be non-negative.");
    }
    const artifacts = (await this.deps.engine.list()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const stale = artifacts.slice(keep);
    for (const artifact of stale) {
      await this.deps.engine.remove(artifact.id);
    }
    return stale.map((artifact) => artifact.id);
  }
}
