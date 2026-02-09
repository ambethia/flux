import { startServer } from "./server";
import { loadProjects } from "./server/setup";

async function main() {
  await loadProjects();
  const server = await startServer();
  console.log(`Flux running at http://localhost:${server.port}`);
}

void main();
