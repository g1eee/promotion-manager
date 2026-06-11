import { ToastProvider } from "@ui/components";
import { PromoHistoryView } from "./PromoHistoryView";

export default function PromoHistoryPage() {
  return (
    <ToastProvider>
      <PromoHistoryView />
    </ToastProvider>
  );
}
