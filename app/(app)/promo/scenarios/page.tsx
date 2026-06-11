import { ToastProvider } from "@ui/components";
import { PromoScenariosView } from "./PromoScenariosView";

interface PromoScenariosPageProps {
  readonly searchParams?: Promise<{
    brandId?: string | string[];
    campaignId?: string | string[];
    editPromoId?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PromoScenariosPage({
  searchParams,
}: PromoScenariosPageProps) {
  const params = searchParams ? await searchParams : {};
  return (
    <ToastProvider>
      <PromoScenariosView
        initialBrandId={firstParam(params.brandId)}
        initialCampaignId={firstParam(params.campaignId)}
        initialEditPromoId={firstParam(params.editPromoId)}
      />
    </ToastProvider>
  );
}
