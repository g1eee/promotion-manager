import { ToastProvider } from "@ui/components";
import { CampaignDetailView } from "./CampaignDetailView";

interface CampaignDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const { id } = await params;
  return (
    <ToastProvider>
      <CampaignDetailView campaignId={id} />
    </ToastProvider>
  );
}
