import { ToastProvider } from "@ui/components";
import { PromoTemplatesView } from "./PromoTemplatesView";

export default function PromoTemplatesPage() {
  return (
    <ToastProvider>
      <PromoTemplatesView />
    </ToastProvider>
  );
}
