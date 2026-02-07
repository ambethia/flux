import { startServer } from "./server";
import { ensureProject } from "./server/setup";

async function main() {
  const projectId = await ensureProject();
  globalThis.projectId = projectId;

  const server = startServer();
  console.log(`Flux running at http://localhost:${server.port}`);
}

void main();
