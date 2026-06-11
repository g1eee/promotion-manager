import { ToastProvider } from "@ui/components";
import { ProductMasterView } from "./ProductMasterView";

export default function ProductMasterPage() {
  return (
    <ToastProvider>
      <ProductMasterView />
    </ToastProvider>
  );
}
