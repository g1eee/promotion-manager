import { ToastProvider } from "@ui/components";
import { HistoryView } from "./HistoryView";

export default function HistoryPage() {
  return (
    <ToastProvider>
      <HistoryView />
    </ToastProvider>
  );
}
