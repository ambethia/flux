import { SettingsForm } from "../components/SettingsForm";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function SettingsPage() {
  useDocumentTitle("Settings");
  return <SettingsForm />;
}
