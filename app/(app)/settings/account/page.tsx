import { ToastProvider } from "@ui/components";
import { AccountSettingsView } from "./AccountSettingsView";

export default function AccountSettingsPage() {
  return (
    <ToastProvider>
      <AccountSettingsView />
    </ToastProvider>
  );
}
