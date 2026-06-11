/**
 * AttachmentService — supporting files on a Promo_Scenario (Req 21, nice-to-have).
 *
 * Behind a feature flag (`attachments`): when disabled, every operation throws
 * {@link FeatureDisabledError} so the capability stays dormant until explicitly
 * enabled. When enabled, it supports upload/list/remove of {@link Attachment}
 * records (Attachment Name, File URL, Uploaded By, Upload Date) tied to a promo
 * (Req 21.1), allows many attachments per promo (Req 21.2), removes by id
 * (Req 21.3), and lists all attachments for a promo with their metadata
 * (Req 21.4).
 *
 * Depends only on repository ports (Dependency Inversion).
 */

import type { Attachment } from "../domain";
import type {
  AttachmentRepository,
  PromoScenarioRepository,
} from "../persistence";
import { ForeignKeyError, NotFoundError } from "../persistence";
import { ValidationError } from "./errors";

export interface AttachmentServiceDeps {
  readonly attachments: AttachmentRepository;
  readonly promos: PromoScenarioRepository;
  /** Whether the `attachments` feature flag is enabled. */
  readonly enabled: boolean;
}

/** Fields required to upload an attachment (Req 21.1). */
export interface UploadAttachmentInput {
  attachmentName: string;
  fileUrl: string;
}

/** Raised when an attachment operation is attempted while the flag is off. */
export class FeatureDisabledError extends Error {
  constructor(feature: string) {
    super(`Fitur "${feature}" tidak aktif.`);
    this.name = "FeatureDisabledError";
  }
}

export class AttachmentService {
  constructor(private readonly deps: AttachmentServiceDeps) {}

  private assertEnabled(): void {
    if (!this.deps.enabled) {
      throw new FeatureDisabledError("attachments");
    }
  }

  /**
   * Upload an attachment to a promo (Req 21.1). Many attachments per promo are
   * allowed (Req 21.2).
   *
   * @throws {FeatureDisabledError} when the feature flag is off.
   * @throws {ValidationError} when name/URL is blank.
   * @throws {NotFoundError} when the promo does not exist.
   */
  async upload(
    promoId: string,
    input: UploadAttachmentInput,
    actor: string,
  ): Promise<Attachment> {
    this.assertEnabled();

    const attachmentName =
      typeof input.attachmentName === "string" ? input.attachmentName.trim() : "";
    const fileUrl = typeof input.fileUrl === "string" ? input.fileUrl.trim() : "";
    const fields: Record<string, string> = {};
    if (attachmentName === "") {
      fields.attachmentName = "Nama attachment wajib diisi.";
    }
    if (fileUrl === "") {
      fields.fileUrl = "File URL wajib diisi.";
    }
    if (Object.keys(fields).length > 0) {
      throw new ValidationError("Attachment tidak valid.", fields);
    }

    const promo = await this.deps.promos.findById(promoId);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoId);
    }

    const attachment: Attachment = {
      id: crypto.randomUUID(),
      promoRef: promoId,
      attachmentName,
      fileUrl,
      uploadedBy: actor,
      uploadDate: new Date(),
    };

    try {
      return await this.deps.attachments.insert(attachment);
    } catch (error) {
      if (error instanceof ForeignKeyError) {
        throw new NotFoundError("PromoScenario", promoId);
      }
      throw error;
    }
  }

  /**
   * List every attachment for a promo with Name/Uploaded By/Upload Date
   * (Req 21.4), oldest-first.
   *
   * @throws {FeatureDisabledError} when the feature flag is off.
   * @throws {NotFoundError} when the promo does not exist.
   */
  async list(promoId: string): Promise<Attachment[]> {
    this.assertEnabled();
    const promo = await this.deps.promos.findById(promoId);
    if (!promo) {
      throw new NotFoundError("PromoScenario", promoId);
    }
    return this.deps.attachments.listByPromo(promoId);
  }

  /**
   * Remove an attachment from a promo's list (Req 21.3).
   *
   * @throws {FeatureDisabledError} when the feature flag is off.
   * @throws {NotFoundError} when the attachment does not exist.
   */
  async remove(attachmentId: string): Promise<void> {
    this.assertEnabled();
    await this.deps.attachments.delete(attachmentId);
  }
}
