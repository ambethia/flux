import { LabelsList } from "../components/LabelsList";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function LabelsPage() {
  useDocumentTitle("Labels");
  return <LabelsList />;
}
