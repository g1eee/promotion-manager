import { ToastProvider } from "@ui/components";
import { BrandManagementView } from "./BrandManagementView";

/**
 * Settings → Brand Management route (Task 5.3, Req 19).
 *
 * Renders the Brand listing with create/edit/archive/delete actions. The
 * {@link ToastProvider} is scoped here so the view can surface success and
 * error notifications (duplicate Brand ID, reference-protected delete) without
 * requiring the shared app shell to provide one.
 */
export default function BrandManagementPage() {
  return (
    <ToastProvider>
      <BrandManagementView />
    </ToastProvider>
  );
}
