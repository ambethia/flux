import { ProjectList } from "../components/ProjectList";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function ProjectsPage() {
  useDocumentTitle("Projects");
  return <ProjectList />;
}
