import { ToastProvider } from "@ui/components";
import { CostConfigurationView } from "./CostConfigurationView";

export default function CostConfigurationPage() {
  return (
    <ToastProvider>
      <CostConfigurationView />
    </ToastProvider>
  );
}
