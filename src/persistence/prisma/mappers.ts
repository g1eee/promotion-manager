/**
 * Mappers between Prisma rows and the framework-agnostic domain types.
 *
 * Prisma returns `Decimal` for numeric(…) columns and `JsonValue` for jsonb
 * columns; the domain works in plain `number`, typed `Rule[]`, and
 * `ProductRef[]`. These pure functions translate in both directions so the
 * Prisma adapter can satisfy the same repository ports as the in-memory one.
 */

import type {
  ApprovalHistoryEntry,
  Attachment,
  Brand,
  Campaign,
  CostConfiguration,
  FeedbackRecord,
  Product,
  PromoScenario,
  PromoTemplate,
  Rule,
  ProductRef,
} from "../../domain";
import {
  BrandStatus,
  CampaignStatus,
  ExecutionStatus,
  ProductStatus,
  PromoStatus,
  PromoType,
} from "../../domain";

/** Prisma Decimal exposes toString(); convert to a plain number. */
function decToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number((value as { toString(): string }).toString());
}

export function toBrand(row: {
  id: string;
  brandId: string;
  brandName: string;
  displayName: string;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Brand {
  return {
    id: row.id,
    brandId: row.brandId,
    brandName: row.brandName,
    displayName: row.displayName,
    status: row.status as BrandStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toProduct(row: {
  id: string;
  brandId: string;
  productId: string;
  namaProduk: string;
  kategori: string;
  hpp: unknown;
  hargaJual: unknown;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: row.id,
    brandId: row.brandId,
    productId: row.productId,
    namaProduk: row.namaProduk,
    kategori: row.kategori,
    hpp: decToNumber(row.hpp),
    hargaJual: decToNumber(row.hargaJual),
    status: row.status as ProductStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toCostConfiguration(row: {
  id: string;
  brandId: string;
  adminFee: unknown;
  shippingFee: unknown;
  promoXtra: unknown;
  feePesanan: unknown;
  campaignFee: unknown;
  promosiFee: unknown;
  marketingFee: unknown;
  adsSpending: unknown;
  affiliateCommission: unknown;
  operatingCost: unknown;
  isActive: boolean;
  updatedAt: Date;
}): CostConfiguration {
  return {
    id: row.id,
    brandId: row.brandId,
    adminFee: decToNumber(row.adminFee),
    shippingFee: decToNumber(row.shippingFee),
    promoXtra: decToNumber(row.promoXtra),
    feePesanan: decToNumber(row.feePesanan),
    campaignFee: decToNumber(row.campaignFee),
    promosiFee: decToNumber(row.promosiFee),
    marketingFee: decToNumber(row.marketingFee),
    adsSpending: decToNumber(row.adsSpending),
    affiliateCommission: decToNumber(row.affiliateCommission),
    operatingCost: decToNumber(row.operatingCost),
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  };
}

export function costConfigToRow(config: CostConfiguration) {
  return {
    id: config.id,
    brandId: config.brandId,
    adminFee: config.adminFee,
    shippingFee: config.shippingFee,
    promoXtra: config.promoXtra,
    feePesanan: config.feePesanan,
    campaignFee: config.campaignFee,
    promosiFee: config.promosiFee,
    marketingFee: config.marketingFee,
    adsSpending: config.adsSpending,
    affiliateCommission: config.affiliateCommission,
    operatingCost: config.operatingCost,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  };
}

export function toCampaign(row: {
  id: string;
  brandId: string;
  nama: string;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  status: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Campaign {
  return {
    id: row.id,
    brandId: row.brandId,
    nama: row.nama,
    tanggalMulai: row.tanggalMulai,
    tanggalSelesai: row.tanggalSelesai,
    status: row.status as CampaignStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPromoScenario(row: {
  id: string;
  brandId: string;
  campaignId: string;
  namaPromo: string;
  promoType: string;
  tanggalMulai: Date;
  tanggalSelesai: Date;
  status: string;
  executionStatus: string | null;
  rules: unknown;
  productRefs: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): PromoScenario {
  return {
    id: row.id,
    brandId: row.brandId,
    campaignId: row.campaignId,
    namaPromo: row.namaPromo,
    promoType: row.promoType as PromoType,
    tanggalMulai: row.tanggalMulai,
    tanggalSelesai: row.tanggalSelesai,
    status: row.status as PromoStatus,
    executionStatus: (row.executionStatus as ExecutionStatus | null) ?? null,
    rules: (row.rules as Rule[]) ?? [],
    productRefs: (row.productRefs as ProductRef[]) ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPromoTemplate(row: {
  id: string;
  name: string;
  promoType: string | null;
  config: unknown;
  isBuiltIn: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromoTemplate {
  return {
    id: row.id,
    name: row.name,
    promoType: (row.promoType as PromoType | null) ?? null,
    config: row.config as PromoTemplate["config"],
    isBuiltIn: row.isBuiltIn,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toFeedbackRecord(row: {
  id: string;
  promoRef: string;
  message: string;
  createdByUser: string;
  createdDate: Date;
  readBy: unknown;
}): FeedbackRecord {
  return {
    id: row.id,
    promoRef: row.promoRef,
    message: row.message,
    createdByUser: row.createdByUser,
    createdDate: row.createdDate,
    readBy: (row.readBy as string[]) ?? [],
  };
}

export function toApprovalHistoryEntry(row: {
  id: string;
  promoRef: string;
  status: string;
  changedBy: string | null;
  changedAt: Date;
}): ApprovalHistoryEntry {
  return {
    id: row.id,
    promoRef: row.promoRef,
    status: row.status as PromoStatus,
    changedBy: row.changedBy,
    changedAt: row.changedAt,
  };
}

export function toAttachment(row: {
  id: string;
  promoRef: string;
  attachmentName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadDate: Date;
}): Attachment {
  return {
    id: row.id,
    promoRef: row.promoRef,
    attachmentName: row.attachmentName,
    fileUrl: row.fileUrl,
    uploadedBy: row.uploadedBy,
    uploadDate: row.uploadDate,
  };
}
