import { beforeEach, describe, expect, it } from "vitest";

import {
  BackupError,
  BackupService,
  backupArtifactId,
  type BackupArtifact,
  type BackupEngine,
} from "./index";

/** In-memory backup engine; checksum is derived from recorded content. */
class FakeBackupEngine implements BackupEngine {
  private artifacts = new Map<string, BackupArtifact>();
  /** Override to simulate on-disk corruption (checksum drift). */
  corruptId: string | null = null;

  async dump(artifactId: string): Promise<BackupArtifact> {
    const artifact: BackupArtifact = {
      id: artifactId,
      createdAt: new Date(),
      sizeBytes: 1024,
      checksum: `checksum-${artifactId}`,
    };
    this.artifacts.set(artifactId, artifact);
    return artifact;
  }

  async checksumOf(artifactId: string): Promise<string> {
    if (this.corruptId === artifactId) {
      return "corrupted";
    }
    return `checksum-${artifactId}`;
  }

  async restore(artifactId: string): Promise<void> {
    if (!this.artifacts.has(artifactId)) {
      throw new Error("missing artifact");
    }
  }

  async remove(artifactId: string): Promise<void> {
    this.artifacts.delete(artifactId);
  }

  async list(): Promise<BackupArtifact[]> {
    return [...this.artifacts.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  seed(artifact: BackupArtifact): void {
    this.artifacts.set(artifact.id, artifact);
  }
}

describe("backupArtifactId", () => {
  it("produces a deterministic, filesystem-safe id from a timestamp", () => {
    const id = backupArtifactId(new Date("2026-06-11T08:30:00.000Z"));
    expect(id).toBe("pms-backup-2026-06-11T08-30-00-000Z");
  });
});

describe("BackupService", () => {
  let engine: FakeBackupEngine;
  let service: BackupService;

  beforeEach(() => {
    engine = new FakeBackupEngine();
    service = new BackupService({
      engine,
      now: () => new Date("2026-06-11T08:30:00.000Z"),
    });
  });

  it("creates and verifies a backup (checksum round-trip)", async () => {
    const artifact = await service.backup();
    expect(artifact.id).toBe("pms-backup-2026-06-11T08-30-00-000Z");
    expect(await service.verify(artifact)).toBe(true);
  });

  it("fails the backup when verification detects corruption", async () => {
    engine.corruptId = "pms-backup-2026-06-11T08-30-00-000Z";
    await expect(service.backup()).rejects.toBeInstanceOf(BackupError);
  });

  it("treats a zero-byte dump as invalid", async () => {
    const artifact: BackupArtifact = {
      id: "empty",
      createdAt: new Date(),
      sizeBytes: 0,
      checksum: "checksum-empty",
    };
    expect(await service.verify(artifact)).toBe(false);
  });

  it("restores a verified backup", async () => {
    const artifact = await service.backup();
    await expect(service.restore(artifact.id)).resolves.toBeUndefined();
  });

  it("refuses to restore a missing artifact", async () => {
    await expect(service.restore("nope")).rejects.toBeInstanceOf(BackupError);
  });

  it("refuses to restore a corrupted artifact", async () => {
    const artifact = await service.backup();
    engine.corruptId = artifact.id;
    await expect(service.restore(artifact.id)).rejects.toBeInstanceOf(
      BackupError,
    );
  });

  it("prunes old backups beyond the retention count", async () => {
    for (let index = 0; index < 5; index += 1) {
      engine.seed({
        id: `backup-${index}`,
        createdAt: new Date(2026, 5, 1 + index),
        sizeBytes: 100,
        checksum: `checksum-backup-${index}`,
      });
    }

    const removed = await service.pruneOldBackups(2);
    expect(removed).toHaveLength(3);
    // The two newest (index 4 and 3) are kept.
    const remaining = (await engine.list()).map((a) => a.id);
    expect(remaining).toEqual(["backup-4", "backup-3"]);
  });
});
