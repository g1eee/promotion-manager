import { ToastProvider } from "@ui/components";
import { PromoExecutionView } from "./PromoExecutionView";

export default function PromoExecutionPage() {
  return (
    <ToastProvider>
      <PromoExecutionView />
    </ToastProvider>
  );
}
