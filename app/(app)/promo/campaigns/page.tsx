import { ToastProvider } from "@ui/components";
import { CampaignsView } from "./CampaignsView";

export default function CampaignsPage() {
  return (
    <ToastProvider>
      <CampaignsView />
    </ToastProvider>
  );
}
