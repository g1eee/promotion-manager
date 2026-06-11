"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Grid,
  Input,
  Modal,
  Select,
  SkeletonTable,
  Stack,
  StatusBadge,
  Table,
  Textarea,
  useToast,
} from "@ui/components";
import type { ButtonVariant, TableColumn } from "@ui/components";
import { BenefitType, PromoStatus, PromoType } from "@domain/enums";
import type {
  Brand,
  Campaign,
  Product,
  PromoScenario,
  Rule,
} from "@domain/types";
import type { ProductSelectionItem } from "@domain/product-selection";
import { useActiveBrand } from "../../_components/BrandContext";
import { PromoSimulatorPanel } from "./PromoSimulatorPanel";
import { FeedbackThread } from "./FeedbackThread";

type CampaignMode = "existing" | "inline";
type FormMode = "create" | "edit";
type SubmitIntent = "draft" | "submit";
type RuleSubmitState = "saving" | `deleting:${string}`;
type ProductSubmitState = "adding" | "bulk" | `removing:${string}`;

interface ApprovalAction {
  readonly label: string;
  readonly status: PromoStatus;
  readonly variant: ButtonVariant;
}

interface PromoScenariosViewProps {
  readonly initialBrandId?: string;
  readonly initialCampaignId?: string;
  readonly initialEditPromoId?: string;
}

interface ApiErrorBody {
  errorType?: string;
  message?: string;
  fields?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? "Terjadi kesalahan.");
    this.name = "ApiError";
  }
}

interface PromoForm {
  brandId: string;
  campaignId: string;
  campaignMode: CampaignMode;
  inlineCampaignName: string;
  inlineCampaignStart: string;
  inlineCampaignEnd: string;
  namaPromo: string;
  promoType: PromoType;
  tanggalMulai: string;
  tanggalSelesai: string;
}

interface RuleForm {
  minQuantity: string;
  benefitType: BenefitType;
  discountPercent: string;
  gift: string;
}

interface ProductSelectionPayload {
  selected: ProductSelectionItem[];
  selectable: Product[];
}

interface BulkAddPayload {
  promo: PromoScenario;
  result: {
    added: string[];
    skippedDuplicate: string[];
    skippedOtherBrand: string[];
    unmatched: string[];
  };
}

const EMPTY_FORM: PromoForm = {
  brandId: "",
  campaignId: "",
  campaignMode: "existing",
  inlineCampaignName: "",
  inlineCampaignStart: "",
  inlineCampaignEnd: "",
  namaPromo: "",
  promoType: PromoType.BuyXDiscount,
  tanggalMulai: "",
  tanggalSelesai: "",
};

const EMPTY_RULE_FORM: RuleForm = {
  minQuantity: "1",
  benefitType: BenefitType.DiscountPercent,
  discountPercent: "10",
  gift: "",
};

const PROMO_TYPE_OPTIONS = [
  { label: "Buy X Discount", value: PromoType.BuyXDiscount },
  { label: "Buy X Get Gift", value: PromoType.BuyXGetGift },
  { label: "Voucher", value: PromoType.Voucher },
  { label: "Flash Sale", value: PromoType.FlashSale },
  { label: "Bundle Promo", value: PromoType.BundlePromo },
];

const CAMPAIGN_MODE_OPTIONS = [
  { label: "Existing Campaign", value: "existing" },
  { label: "Create Campaign Inline", value: "inline" },
];

const BENEFIT_TYPE_OPTIONS = [
  { label: "Discount Percent", value: BenefitType.DiscountPercent },
  { label: "Free Gift", value: BenefitType.FreeGift },
];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveBrandId(brands: readonly Brand[], preferred: string): string {
  const normalized = normalizeKey(preferred);
  const match = brands.find((brand) => {
    const brandId = normalizeKey(brand.brandId);
    const displayName = normalizeKey(brand.displayName);
    const brandName = normalizeKey(brand.brandName);
    const surrogateId = normalizeKey(brand.id);
    return (
      surrogateId === normalized ||
      brandId === normalized ||
      displayName === normalized ||
      brandName === normalized ||
      surrogateId.endsWith(`-${normalized}`)
    );
  });
  return match?.id ?? brands[0]?.id ?? "";
}

function toDateInput(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formFromPromo(promo: PromoScenario): PromoForm {
  return {
    ...EMPTY_FORM,
    brandId: promo.brandId,
    campaignId: promo.campaignId,
    namaPromo: promo.namaPromo,
    promoType: promo.promoType,
    tanggalMulai: toDateInput(promo.tanggalMulai),
    tanggalSelesai: toDateInput(promo.tanggalSelesai),
  };
}

function basePayload(form: PromoForm) {
  return {
    brandId: form.brandId,
    campaignId: form.campaignId,
    namaPromo: form.namaPromo.trim(),
    promoType: form.promoType,
    tanggalMulai: form.tanggalMulai,
    tanggalSelesai: form.tanggalSelesai,
  };
}

async function changeApprovalStatusRequest(
  promoId: string,
  status: PromoStatus,
): Promise<PromoScenario> {
  return readJson<PromoScenario>(
    await fetch(`/api/promos/${promoId}/approval`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

function approvalActionsFor(promo: PromoScenario): ApprovalAction[] {
  switch (promo.status) {
    case PromoStatus.Draft:
    case PromoStatus.Rejected:
      return [
        {
          label: "Submit for Review",
          status: PromoStatus.Review,
          variant: "primary",
        },
      ];
    case PromoStatus.Review:
      return [
        { label: "Approve", status: PromoStatus.Approved, variant: "primary" },
        { label: "Reject", status: PromoStatus.Rejected, variant: "danger" },
      ];
    default:
      return [];
  }
}

function approvalSubmitKey(promoId: string, status: PromoStatus): string {
  return `${promoId}:${status}`;
}

function formatBenefit(rule: Rule): string {
  if (rule.benefitType === BenefitType.DiscountPercent) {
    return `${rule.discountPercent ?? 0}% discount`;
  }
  return rule.gift ?? "Free gift";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PromoScenariosView({
  initialBrandId,
  initialCampaignId,
  initialEditPromoId,
}: PromoScenariosViewProps) {
  const toast = useToast();
  const { activeBrandId } = useActiveBrand();
  const fieldPrefix = useId();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [promos, setPromos] = useState<PromoScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<SubmitIntent | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [autoOpenedEdit, setAutoOpenedEdit] = useState(false);
  const [cloneSubmitting, setCloneSubmitting] = useState<string | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState<string | null>(
    null,
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesTarget, setRulesTarget] = useState<PromoScenario | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE_FORM);
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});
  const [ruleSubmitting, setRuleSubmitting] = useState<RuleSubmitState | null>(
    null,
  );
  const [productsOpen, setProductsOpen] = useState(false);
  const [productsTarget, setProductsTarget] =
    useState<PromoScenario | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorTarget, setSimulatorTarget] =
    useState<PromoScenario | null>(null);
  const [productSelection, setProductSelection] =
    useState<ProductSelectionPayload | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkProductIds, setBulkProductIds] = useState("");
  const [bulkReport, setBulkReport] = useState<BulkAddPayload["result"] | null>(
    null,
  );
  const [productSubmitting, setProductSubmitting] =
    useState<ProductSubmitState | null>(null);

  const activeApiBrandId = useMemo(
    () => resolveBrandId(brands, activeBrandId),
    [activeBrandId, brands],
  );

  const initialApiBrandId = useMemo(
    () =>
      initialBrandId
        ? resolveBrandId(brands, initialBrandId)
        : activeApiBrandId,
    [activeApiBrandId, brands, initialBrandId],
  );

  const brandNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brands) map.set(brand.id, brand.displayName);
    return map;
  }, [brands]);

  const campaignNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) map.set(campaign.id, campaign.nama);
    return map;
  }, [campaigns]);

  const brandOptions = useMemo(
    () => brands.map((brand) => ({ label: brand.displayName, value: brand.id })),
    [brands],
  );

  const campaignOptions = useMemo(
    () =>
      campaigns
        .filter((campaign) => campaign.brandId === form.brandId)
        .map((campaign) => ({ label: campaign.nama, value: campaign.id })),
    [campaigns, form.brandId],
  );

  const firstCampaignForBrand = useCallback(
    (brandId: string) =>
      campaigns.find((campaign) => campaign.brandId === brandId)?.id ?? "",
    [campaigns],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const loadedBrands = await readJson<Brand[]>(
        await fetch("/api/brands", { cache: "no-store" }),
      );
      const brandId = initialBrandId
        ? resolveBrandId(loadedBrands, initialBrandId)
        : resolveBrandId(loadedBrands, activeBrandId);
      const params = new URLSearchParams();
      if (brandId) params.set("brandId", brandId);
      const [loadedCampaigns, loadedPromos] = await Promise.all([
        readJson<Campaign[]>(
          await fetch(`/api/campaigns?${params.toString()}`, {
            cache: "no-store",
          }),
        ),
        readJson<PromoScenario[]>(
          await fetch(`/api/promos?${params.toString()}`, {
            cache: "no-store",
          }),
        ),
      ]);
      setBrands(loadedBrands);
      setCampaigns(loadedCampaigns);
      setPromos(loadedPromos);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "Gagal memuat Promo.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, initialBrandId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const buildCreateForm = useCallback((): PromoForm => {
    const today = new Date().toISOString().slice(0, 10);
    const brandId = initialApiBrandId || activeApiBrandId;
    const campaignId =
      initialCampaignId &&
      campaigns.some(
        (campaign) =>
          campaign.id === initialCampaignId && campaign.brandId === brandId,
      )
        ? initialCampaignId
        : firstCampaignForBrand(brandId);

    return {
      ...EMPTY_FORM,
      brandId,
      campaignId,
      tanggalMulai: today,
      tanggalSelesai: today,
      inlineCampaignStart: today,
      inlineCampaignEnd: today,
    };
  }, [
    activeApiBrandId,
    campaigns,
    firstCampaignForBrand,
    initialApiBrandId,
    initialCampaignId,
  ]);

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingId(null);
    setForm(buildCreateForm());
    setFieldErrors({});
    setFormOpen(true);
  }, [buildCreateForm]);

  const openEdit = useCallback((promo: PromoScenario) => {
    setFormMode("edit");
    setEditingId(promo.id);
    setForm(formFromPromo(promo));
    setFieldErrors({});
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (!loading && initialCampaignId && !initialEditPromoId && !autoOpened) {
      setAutoOpened(true);
      openCreate();
    }
  }, [autoOpened, initialCampaignId, initialEditPromoId, loading, openCreate]);

  useEffect(() => {
    if (loading || !initialEditPromoId || autoOpenedEdit) return;
    const promo = promos.find((candidate) => candidate.id === initialEditPromoId);
    if (promo) {
      setAutoOpenedEdit(true);
      openEdit(promo);
    }
  }, [autoOpenedEdit, initialEditPromoId, loading, openEdit, promos]);

  const openRules = useCallback((promo: PromoScenario) => {
    setRulesTarget(promo);
    setRuleForm(EMPTY_RULE_FORM);
    setRuleErrors({});
    setRulesOpen(true);
  }, []);

  const loadProductSelection = useCallback(
    async (promoId: string, keyword = "") => {
      const params = new URLSearchParams();
      if (keyword.trim() !== "") params.set("keyword", keyword.trim());
      const selection = await readJson<ProductSelectionPayload>(
        await fetch(`/api/promos/${promoId}/products?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      setProductSelection(selection);
      setSelectedProductIds([]);
    },
    [],
  );

  const openProducts = useCallback(
    async (promo: PromoScenario) => {
      setProductsTarget(promo);
      setProductSelection(null);
      setProductSearch("");
      setSelectedProductIds([]);
      setBulkProductIds("");
      setBulkReport(null);
      setProductsOpen(true);
      try {
        await loadProductSelection(promo.id);
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal memuat Product Selection.",
        );
      }
    },
    [loadProductSelection, toast],
  );

  const updateField = useCallback(
    (key: keyof PromoForm, value: string) => {
      setForm((current) => {
        const next = { ...current, [key]: value };
        if (key === "brandId") {
          next.campaignId = firstCampaignForBrand(value);
        }
        if (key === "campaignMode" && value === "inline") {
          next.inlineCampaignStart = current.tanggalMulai;
          next.inlineCampaignEnd = current.tanggalSelesai;
        }
        return next;
      });
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [firstCampaignForBrand],
  );

  const submitForm = useCallback(
    async (intent: SubmitIntent) => {
      setSubmitting(intent);
      setFieldErrors({});
      const isEdit = formMode === "edit" && editingId !== null;
      const payload =
        !isEdit && form.campaignMode === "inline"
          ? {
              ...basePayload(form),
              campaignId: undefined,
              inlineCampaign: {
                brandId: form.brandId,
                nama: form.inlineCampaignName.trim(),
                tanggalMulai: form.inlineCampaignStart,
                tanggalSelesai: form.inlineCampaignEnd,
              },
            }
          : basePayload(form);

      try {
        const saved = await readJson<PromoScenario>(
          await fetch(isEdit ? `/api/promos/${editingId}` : "/api/promos", {
            method: isEdit ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          }),
        );
        let finalPromo = saved;
        if (
          intent === "submit" &&
          (saved.status === PromoStatus.Draft ||
            saved.status === PromoStatus.Rejected)
        ) {
          finalPromo = await changeApprovalStatusRequest(
            saved.id,
            PromoStatus.Review,
          );
        }

        toast.success(
          intent === "submit"
            ? `Promo "${finalPromo.namaPromo}" dikirim untuk review.`
            : `Draft "${finalPromo.namaPromo}" disimpan.`,
        );
        setFormOpen(false);
        await loadData();
      } catch (error) {
        if (error instanceof ApiError && error.status === 422 && error.body.fields) {
          setFieldErrors(error.body.fields);
          if (error.body.message) toast.error(error.body.message);
        } else {
          toast.error(
            error instanceof ApiError ? error.message : "Gagal menyimpan Promo.",
          );
        }
      } finally {
        setSubmitting(null);
      }
    },
    [editingId, form, formMode, loadData, toast],
  );

  const updateRuleField = useCallback((key: keyof RuleForm, value: string) => {
    setRuleForm((current) =>
      key === "benefitType"
        ? { ...current, benefitType: value as BenefitType }
        : { ...current, [key]: value },
    );
    setRuleErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const syncPromo = useCallback((promo: PromoScenario) => {
    setPromos((current) =>
      current.map((candidate) => (candidate.id === promo.id ? promo : candidate)),
    );
    setRulesTarget((current) => (current?.id === promo.id ? promo : current));
    setProductsTarget((current) => (current?.id === promo.id ? promo : current));
    setSimulatorTarget((current) => (current?.id === promo.id ? promo : current));
  }, []);

  const openSimulator = useCallback((promo: PromoScenario) => {
    setSimulatorTarget(promo);
    setSimulatorOpen(true);
  }, []);

  const clonePromo = useCallback(
    async (promo: PromoScenario) => {
      setCloneSubmitting(promo.id);
      try {
        const cloned = await readJson<PromoScenario>(
          await fetch(`/api/promos/${promo.id}/clone`, { method: "POST" }),
        );
        setPromos((current) => [cloned, ...current]);
        toast.success(`Draft "${cloned.namaPromo}" dibuat.`);
        openEdit(cloned);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal clone Promo.",
        );
      } finally {
        setCloneSubmitting(null);
      }
    },
    [openEdit, toast],
  );

  const changeApprovalStatus = useCallback(
    async (promo: PromoScenario, status: PromoStatus) => {
      const submitKey = approvalSubmitKey(promo.id, status);
      setApprovalSubmitting(submitKey);
      try {
        const saved = await changeApprovalStatusRequest(promo.id, status);
        syncPromo(saved);
        toast.success(`Status "${saved.namaPromo}" menjadi ${saved.status}.`);
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Gagal mengubah status approval.",
        );
      } finally {
        setApprovalSubmitting(null);
      }
    },
    [syncPromo, toast],
  );

  const submitRule = useCallback(async () => {
    if (!rulesTarget) return;
    setRuleSubmitting("saving");
    setRuleErrors({});

    try {
      const saved = await readJson<PromoScenario>(
        await fetch(`/api/promos/${rulesTarget.id}/rules`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ruleForm),
        }),
      );
      syncPromo(saved);
      setRuleForm(EMPTY_RULE_FORM);
      toast.success(`Rule ditambahkan ke "${saved.namaPromo}".`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.body.fields) {
        setRuleErrors(error.body.fields);
        if (error.body.message) toast.error(error.body.message);
      } else {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal menambahkan Rule.",
        );
      }
    } finally {
      setRuleSubmitting(null);
    }
  }, [ruleForm, rulesTarget, syncPromo, toast]);

  const deleteRule = useCallback(
    async (ruleId: string) => {
      if (!rulesTarget) return;
      setRuleSubmitting(`deleting:${ruleId}`);

      try {
        const saved = await readJson<PromoScenario>(
          await fetch(`/api/promos/${rulesTarget.id}/rules/${ruleId}`, {
            method: "DELETE",
          }),
        );
        syncPromo(saved);
        toast.success("Rule dihapus.");
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal menghapus Rule.",
        );
      } finally {
        setRuleSubmitting(null);
      }
    },
    [rulesTarget, syncPromo, toast],
  );

  const ruleColumns = useMemo<TableColumn<Rule>[]>(
    () => [
      {
        key: "minQuantity",
        header: "Minimum Qty",
        numeric: true,
        render: (rule) => rule.minQuantity,
      },
      {
        key: "benefit",
        header: "Benefit",
        render: (rule) => formatBenefit(rule),
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (rule) => (
          <Button
            size="sm"
            variant="ghost"
            disabled={ruleSubmitting !== null}
            onClick={() => void deleteRule(rule.id)}
          >
            {ruleSubmitting === `deleting:${rule.id}` ? "Menghapus..." : "Hapus"}
          </Button>
        ),
      },
    ],
    [deleteRule, ruleSubmitting],
  );

  const refreshProducts = useCallback(async () => {
    if (!productsTarget) return;
    try {
      await loadProductSelection(productsTarget.id, productSearch);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Gagal memuat Product Selection.",
      );
    }
  }, [loadProductSelection, productSearch, productsTarget, toast]);

  const toggleCandidate = useCallback((productId: string, checked: boolean) => {
    setSelectedProductIds((current) =>
      checked
        ? current.includes(productId)
          ? current
          : [...current, productId]
        : current.filter((id) => id !== productId),
    );
  }, []);

  const addSelectedProducts = useCallback(async () => {
    if (!productsTarget || selectedProductIds.length === 0) return;
    setProductSubmitting("adding");
    setBulkReport(null);
    try {
      const saved = await readJson<PromoScenario>(
        await fetch(`/api/promos/${productsTarget.id}/products`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds: selectedProductIds }),
        }),
      );
      syncPromo(saved);
      await loadProductSelection(saved.id, productSearch);
      toast.success(`${selectedProductIds.length} produk ditambahkan.`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Gagal menambahkan produk.",
      );
    } finally {
      setProductSubmitting(null);
    }
  }, [
    loadProductSelection,
    productSearch,
    productsTarget,
    selectedProductIds,
    syncPromo,
    toast,
  ]);

  const submitBulkProducts = useCallback(async () => {
    if (!productsTarget) return;
    setProductSubmitting("bulk");
    try {
      const payload = await readJson<BulkAddPayload>(
        await fetch(`/api/promos/${productsTarget.id}/products/bulk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds: bulkProductIds }),
        }),
      );
      syncPromo(payload.promo);
      setBulkReport(payload.result);
      setBulkProductIds("");
      await loadProductSelection(payload.promo.id, productSearch);
      toast.success(`${payload.result.added.length} produk ditambahkan.`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Gagal bulk add produk.",
      );
    } finally {
      setProductSubmitting(null);
    }
  }, [
    bulkProductIds,
    loadProductSelection,
    productSearch,
    productsTarget,
    syncPromo,
    toast,
  ]);

  const removeSelectedProduct = useCallback(
    async (productId: string) => {
      if (!productsTarget) return;
      setProductSubmitting(`removing:${productId}`);
      try {
        const saved = await readJson<PromoScenario>(
          await fetch(
            `/api/promos/${productsTarget.id}/products/${encodeURIComponent(
              productId,
            )}`,
            { method: "DELETE" },
          ),
        );
        syncPromo(saved);
        await loadProductSelection(saved.id, productSearch);
        toast.success("Produk dihapus dari promo.");
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "Gagal menghapus produk.",
        );
      } finally {
        setProductSubmitting(null);
      }
    },
    [loadProductSelection, productSearch, productsTarget, syncPromo, toast],
  );

  const selectedProductIdSet = useMemo(
    () =>
      new Set(
        (productSelection?.selected ?? []).map((product) => product.productId),
      ),
    [productSelection],
  );

  const availableProducts = useMemo(
    () =>
      (productSelection?.selectable ?? []).filter(
        (product) => !selectedProductIdSet.has(product.productId),
      ),
    [productSelection, selectedProductIdSet],
  );

  const selectedProductColumns = useMemo<TableColumn<ProductSelectionItem>[]>(
    () => [
      {
        key: "productId",
        header: "Product ID",
        render: (product) => product.productId,
      },
      {
        key: "namaProduk",
        header: "Nama Produk",
        render: (product) => product.namaProduk,
      },
      {
        key: "hpp",
        header: "HPP",
        numeric: true,
        render: (product) => formatMoney(product.hpp),
      },
      {
        key: "hargaJual",
        header: "Harga Jual",
        numeric: true,
        render: (product) => formatMoney(product.hargaJual),
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (product) => (
          <Button
            size="sm"
            variant="ghost"
            disabled={productSubmitting !== null}
            onClick={() => void removeSelectedProduct(product.productId)}
          >
            {productSubmitting === `removing:${product.productId}`
              ? "Menghapus..."
              : "Hapus"}
          </Button>
        ),
      },
    ],
    [productSubmitting, removeSelectedProduct],
  );

  const candidateProductColumns = useMemo<TableColumn<Product>[]>(
    () => [
      {
        key: "select",
        header: "",
        width: "44px",
        render: (product) => (
          <input
            type="checkbox"
            aria-label={`Pilih ${product.productId}`}
            checked={selectedProductIds.includes(product.productId)}
            disabled={productSubmitting !== null}
            onChange={(event) =>
              toggleCandidate(product.productId, event.target.checked)
            }
          />
        ),
      },
      {
        key: "productId",
        header: "Product ID",
        render: (product) => product.productId,
      },
      {
        key: "namaProduk",
        header: "Nama Produk",
        render: (product) => product.namaProduk,
      },
      {
        key: "hpp",
        header: "HPP",
        numeric: true,
        render: (product) => formatMoney(product.hpp),
      },
      {
        key: "hargaJual",
        header: "Harga Jual",
        numeric: true,
        render: (product) => formatMoney(product.hargaJual),
      },
    ],
    [productSubmitting, selectedProductIds, toggleCandidate],
  );

  const columns = useMemo<TableColumn<PromoScenario>[]>(
    () => [
      {
        key: "brand",
        header: "Brand",
        render: (promo) => brandNameById.get(promo.brandId) ?? promo.brandId,
      },
      {
        key: "campaign",
        header: "Campaign",
        render: (promo) => campaignNameById.get(promo.campaignId) ?? promo.campaignId,
      },
      {
        key: "namaPromo",
        header: "Promo",
        render: (promo) => promo.namaPromo,
      },
      {
        key: "promoType",
        header: "Promo Type",
        render: (promo) => promo.promoType,
      },
      {
        key: "date",
        header: "Tanggal",
        render: (promo) =>
          `${formatDate(promo.tanggalMulai)} - ${formatDate(
            promo.tanggalSelesai,
          )}`,
      },
      {
        key: "products",
        header: "Produk",
        numeric: true,
        render: (promo) => promo.productRefs.length,
      },
      {
        key: "rules",
        header: "Rules",
        numeric: true,
        render: (promo) => promo.rules.length,
      },
      {
        key: "status",
        header: "Status",
        render: (promo) => <StatusBadge status={promo.status} />,
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (promo) => (
          <Stack direction="horizontal" gap="xs" justify="flex-end">
            <Button size="sm" variant="secondary" onClick={() => openEdit(promo)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={cloneSubmitting === promo.id}
              onClick={() => void clonePromo(promo)}
            >
              {cloneSubmitting === promo.id ? "Cloning..." : "Clone"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openProducts(promo)}
            >
              Products
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openRules(promo)}>
              Rules
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openSimulator(promo)}
            >
              Simulator
            </Button>
            {approvalActionsFor(promo).map((action) => {
              const submitKey = approvalSubmitKey(promo.id, action.status);
              return (
                <Button
                  key={action.status}
                  size="sm"
                  variant={action.variant}
                  disabled={approvalSubmitting !== null}
                  onClick={() => void changeApprovalStatus(promo, action.status)}
                >
                  {approvalSubmitting === submitKey
                    ? "Memproses..."
                    : action.label}
                </Button>
              );
            })}
          </Stack>
        ),
      },
    ],
    [
      brandNameById,
      approvalSubmitting,
      campaignNameById,
      changeApprovalStatus,
      clonePromo,
      cloneSubmitting,
      openEdit,
      openProducts,
      openRules,
      openSimulator,
    ],
  );

  const brandField = `${fieldPrefix}-brand`;
  const campaignModeField = `${fieldPrefix}-campaign-mode`;
  const campaignField = `${fieldPrefix}-campaign`;
  const inlineCampaignField = `${fieldPrefix}-inline-campaign`;
  const inlineStartField = `${fieldPrefix}-inline-start`;
  const inlineEndField = `${fieldPrefix}-inline-end`;
  const promoNameField = `${fieldPrefix}-promo-name`;
  const promoTypeField = `${fieldPrefix}-promo-type`;
  const startField = `${fieldPrefix}-start`;
  const endField = `${fieldPrefix}-end`;
  const minQtyField = `${fieldPrefix}-rule-min`;
  const benefitTypeField = `${fieldPrefix}-rule-benefit`;
  const discountField = `${fieldPrefix}-rule-discount`;
  const giftField = `${fieldPrefix}-rule-gift`;
  const productSearchField = `${fieldPrefix}-product-search`;
  const bulkProductsField = `${fieldPrefix}-bulk-products`;

  return (
    <Stack gap="lg">
      <Stack direction="horizontal" justify="space-between" align="center" wrap>
        <h1 className="pms-page__title">Promo Scenarios</h1>
        <Button onClick={openCreate} disabled={!activeApiBrandId}>
          Add Promo
        </Button>
      </Stack>

      <Card padding="none">
        {loading ? (
          <div style={{ padding: "var(--pms-space-md)" }}>
            <SkeletonTable rows={5} columns={8} />
          </div>
        ) : loadError ? (
          <EmptyState
            title="Gagal memuat Promo"
            description={loadError}
            actionLabel="Refresh"
            onAction={() => void loadData()}
          />
        ) : promos.length === 0 ? (
          <EmptyState
            variant="no-promos"
            actionLabel="Add Promo"
            onAction={openCreate}
          />
        ) : (
          <Table
            columns={columns}
            data={promos}
            rowKey={(promo) => promo.id}
            caption="Daftar Promo Scenario"
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={formMode === "create" ? "Add Promo" : "Edit Promo"}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={submitting !== null}
              onClick={() => setFormOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="secondary"
              disabled={submitting !== null}
              onClick={() => void submitForm("draft")}
            >
              {submitting === "draft" ? "Menyimpan..." : "Save Draft"}
            </Button>
            <Button
              disabled={submitting !== null}
              onClick={() => void submitForm("submit")}
            >
              {submitting === "submit" ? "Menyimpan..." : "Submit"}
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
            <Field
              htmlFor={brandField}
              label="Brand"
              required
              error={fieldErrors.brandId}
            >
              <Select
                id={brandField}
                options={brandOptions}
                value={form.brandId}
                disabled={formMode === "edit"}
                invalid={Boolean(fieldErrors.brandId)}
                onChange={(event) => updateField("brandId", event.target.value)}
              />
            </Field>
            <Field
              htmlFor={campaignModeField}
              label="Campaign"
              required
              error={fieldErrors.campaignId}
            >
              <Select
                id={campaignModeField}
                options={CAMPAIGN_MODE_OPTIONS}
                value={form.campaignMode}
                disabled={formMode === "edit"}
                onChange={(event) =>
                  updateField("campaignMode", event.target.value)
                }
              />
            </Field>
          </Grid>

          {form.campaignMode === "existing" || formMode === "edit" ? (
            <Field
              htmlFor={campaignField}
              label="Existing Campaign"
              required
              error={fieldErrors.campaignId}
            >
              <Select
                id={campaignField}
                options={campaignOptions}
                placeholder="Pilih Campaign"
                value={form.campaignId}
                invalid={Boolean(fieldErrors.campaignId)}
                onChange={(event) =>
                  updateField("campaignId", event.target.value)
                }
              />
            </Field>
          ) : (
            <Stack gap="md">
              <Field
                htmlFor={inlineCampaignField}
                label="Nama Campaign"
                required
                error={fieldErrors.nama}
              >
                <Input
                  id={inlineCampaignField}
                  value={form.inlineCampaignName}
                  invalid={Boolean(fieldErrors.nama)}
                  onChange={(event) =>
                    updateField("inlineCampaignName", event.target.value)
                  }
                />
              </Field>
              <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
                <Field
                  htmlFor={inlineStartField}
                  label="Tanggal Mulai Campaign"
                  required
                  error={fieldErrors.tanggalMulai}
                >
                  <Input
                    id={inlineStartField}
                    type="date"
                    value={form.inlineCampaignStart}
                    invalid={Boolean(fieldErrors.tanggalMulai)}
                    onChange={(event) =>
                      updateField("inlineCampaignStart", event.target.value)
                    }
                  />
                </Field>
                <Field
                  htmlFor={inlineEndField}
                  label="Tanggal Selesai Campaign"
                  required
                  error={fieldErrors.tanggalSelesai}
                >
                  <Input
                    id={inlineEndField}
                    type="date"
                    value={form.inlineCampaignEnd}
                    invalid={Boolean(fieldErrors.tanggalSelesai)}
                    onChange={(event) =>
                      updateField("inlineCampaignEnd", event.target.value)
                    }
                  />
                </Field>
              </Grid>
            </Stack>
          )}

          <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
            <Field
              htmlFor={promoNameField}
              label="Promo Name"
              required
              error={fieldErrors.namaPromo}
            >
              <Input
                id={promoNameField}
                value={form.namaPromo}
                invalid={Boolean(fieldErrors.namaPromo)}
                onChange={(event) =>
                  updateField("namaPromo", event.target.value)
                }
              />
            </Field>
            <Field
              htmlFor={promoTypeField}
              label="Promo Type"
              required
              error={fieldErrors.promoType}
            >
              <Select
                id={promoTypeField}
                options={PROMO_TYPE_OPTIONS}
                value={form.promoType}
                invalid={Boolean(fieldErrors.promoType)}
                onChange={(event) => updateField("promoType", event.target.value)}
              />
            </Field>
          </Grid>

          <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
            <Field
              htmlFor={startField}
              label="Tanggal Mulai Promo"
              required
              error={fieldErrors.tanggalMulai}
            >
              <Input
                id={startField}
                type="date"
                value={form.tanggalMulai}
                invalid={Boolean(fieldErrors.tanggalMulai)}
                onChange={(event) =>
                  updateField("tanggalMulai", event.target.value)
                }
              />
            </Field>
            <Field
              htmlFor={endField}
              label="Tanggal Selesai Promo"
              required
              error={fieldErrors.tanggalSelesai}
            >
              <Input
                id={endField}
                type="date"
                value={form.tanggalSelesai}
                invalid={Boolean(fieldErrors.tanggalSelesai)}
                onChange={(event) =>
                  updateField("tanggalSelesai", event.target.value)
                }
              />
            </Field>
          </Grid>

          {formMode === "edit" && editingId !== null ? (
            <FeedbackThread promoId={editingId} />
          ) : null}
        </Stack>
      </Modal>

      <Modal
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        title={`Simulator${simulatorTarget ? `: ${simulatorTarget.namaPromo}` : ""}`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSimulatorOpen(false)}>
            Tutup
          </Button>
        }
      >
        {simulatorTarget ? (
          <PromoSimulatorPanel
            promo={simulatorTarget}
            brandName={
              brandNameById.get(simulatorTarget.brandId) ?? simulatorTarget.brandId
            }
          />
        ) : null}
      </Modal>

      <Modal
        open={productsOpen}
        onClose={() => !productSubmitting && setProductsOpen(false)}
        title={`Products${productsTarget ? `: ${productsTarget.namaPromo}` : ""}`}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={productSubmitting !== null}
              onClick={() => setProductsOpen(false)}
            >
              Tutup
            </Button>
            <Button
              variant="secondary"
              disabled={
                productSubmitting !== null || selectedProductIds.length === 0
              }
              onClick={() => void addSelectedProducts()}
            >
              {productSubmitting === "adding" ? "Menambahkan..." : "Add Selected"}
            </Button>
            <Button
              disabled={productSubmitting !== null || bulkProductIds.trim() === ""}
              onClick={() => void submitBulkProducts()}
            >
              {productSubmitting === "bulk" ? "Memproses..." : "Bulk Add"}
            </Button>
          </>
        }
      >
        <Stack gap="lg">
          <Card padding="none">
            <Table
              columns={selectedProductColumns}
              data={productSelection?.selected ?? []}
              rowKey={(product) => product.productId}
              caption="Selected Products"
              emptyContent="Belum ada produk terpilih."
            />
          </Card>

          <Stack direction="horizontal" gap="sm" align="end" wrap>
            <Field htmlFor={productSearchField} label="Search Product">
              <Input
                id={productSearchField}
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={productSubmitting !== null}
              onClick={() => void refreshProducts()}
            >
              Search
            </Button>
          </Stack>

          <Card padding="none">
            <Table
              columns={candidateProductColumns}
              data={availableProducts}
              rowKey={(product) => product.id}
              caption="Selectable Products"
              emptyContent="Tidak ada produk selectable."
            />
          </Card>

          <Field htmlFor={bulkProductsField} label="Bulk Paste IDs">
            <Textarea
              id={bulkProductsField}
              rows={4}
              value={bulkProductIds}
              onChange={(event) => setBulkProductIds(event.target.value)}
            />
          </Field>

          {bulkReport ? (
            <Stack direction="horizontal" gap="sm" wrap>
              <StatusBadge status={`Added ${bulkReport.added.length}`} tone="success" />
              <StatusBadge
                status={`Duplicate ${bulkReport.skippedDuplicate.length}`}
                tone="neutral"
              />
              <StatusBadge
                status={`Other Brand ${bulkReport.skippedOtherBrand.length}`}
                tone="warning"
              />
              <StatusBadge
                status={`Unmatched ${bulkReport.unmatched.length}`}
                tone="danger"
              />
            </Stack>
          ) : null}
        </Stack>
      </Modal>

      <Modal
        open={rulesOpen}
        onClose={() => !ruleSubmitting && setRulesOpen(false)}
        title={`Rules${rulesTarget ? `: ${rulesTarget.namaPromo}` : ""}`}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={ruleSubmitting !== null}
              onClick={() => setRulesOpen(false)}
            >
              Tutup
            </Button>
            <Button
              disabled={ruleSubmitting !== null}
              onClick={() => void submitRule()}
            >
              {ruleSubmitting === "saving" ? "Menyimpan..." : "Tambah Rule"}
            </Button>
          </>
        }
      >
        <Stack gap="lg">
          <Table
            columns={ruleColumns}
            data={rulesTarget?.rules ?? []}
            rowKey={(rule) => rule.id}
            caption="Daftar Rule Promo"
            emptyContent="Belum ada Rule."
          />

          <Stack gap="md">
            <Grid columns="repeat(2, minmax(0, 1fr))" gap="md">
              <Field
                htmlFor={minQtyField}
                label="Minimum Qty"
                required
                error={ruleErrors.minQuantity}
              >
                <Input
                  id={minQtyField}
                  type="number"
                  min={1}
                  value={ruleForm.minQuantity}
                  invalid={Boolean(ruleErrors.minQuantity)}
                  onChange={(event) =>
                    updateRuleField("minQuantity", event.target.value)
                  }
                />
              </Field>
              <Field
                htmlFor={benefitTypeField}
                label="Benefit"
                required
                error={ruleErrors.benefitType}
              >
                <Select
                  id={benefitTypeField}
                  options={BENEFIT_TYPE_OPTIONS}
                  value={ruleForm.benefitType}
                  invalid={Boolean(ruleErrors.benefitType)}
                  onChange={(event) =>
                    updateRuleField("benefitType", event.target.value)
                  }
                />
              </Field>
            </Grid>

            {ruleForm.benefitType === BenefitType.DiscountPercent ? (
              <Field
                htmlFor={discountField}
                label="Discount Percent"
                required
                error={ruleErrors.discountPercent}
              >
                <Input
                  id={discountField}
                  type="number"
                  min={0}
                  max={100}
                  value={ruleForm.discountPercent}
                  invalid={Boolean(ruleErrors.discountPercent)}
                  onChange={(event) =>
                    updateRuleField("discountPercent", event.target.value)
                  }
                />
              </Field>
            ) : (
              <Field
                htmlFor={giftField}
                label="Free Gift"
                required
                error={ruleErrors.gift}
              >
                <Input
                  id={giftField}
                  value={ruleForm.gift}
                  invalid={Boolean(ruleErrors.gift)}
                  onChange={(event) =>
                    updateRuleField("gift", event.target.value)
                  }
                />
              </Field>
            )}
          </Stack>
        </Stack>
      </Modal>
    </Stack>
  );
}
