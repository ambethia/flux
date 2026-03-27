/**
 * Shared helper for calling the Flux HTTP tool API from the CLI.
 *
 * Resolves the project ID (from env or auto-discovery), constructs the tools
 * URL, and POSTs a tool call. Parses the JSON response and throws on errors.
 *
 * This avoids the MCP stdio bridge entirely — the CLI calls the HTTP API
 * directly, which is faster and has no external process dependency.
 */

const HTTP_TIMEOUT_MS = 15_000;

type FluxProject = {
  id: string;
  slug: string;
  path: string | null;
};

export type ToolPayload = Record<string, unknown>;

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText} from ${url}: ${body.trim() || "<empty body>"}`,
    );
  }
  return (await response.json()) as T;
}

function normalizePathSync(path: string): string {
  // Use Node's fs.realpathSync where available (Bun supports it)
  try {
    const { realpathSync } = require("node:fs");
    return realpathSync(path);
  } catch {
    return path;
  }
}

export async function resolveProject(fluxUrl: string): Promise<FluxProject> {
  const projects = await fetchJsonOrThrow<FluxProject[]>(
    `${fluxUrl}/api/projects`,
  );

  const explicitId = process.env.FLUX_PROJECT_ID;
  if (explicitId) {
    const found = projects.find((p) => p.id === explicitId);
    if (!found) {
      throw new Error(
        `FLUX_PROJECT_ID=${explicitId} not found. Available projects:\n${projects.map((p) => `  ${p.id} (${p.slug})`).join("\n")}`,
      );
    }
    return found;
  }

  const cwd = normalizePathSync(process.cwd());
  const cwdProject = projects.find(
    (p) => p.path && normalizePathSync(p.path) === cwd,
  );
  if (cwdProject) return cwdProject;

  if (projects.length === 1) return projects[0] as FluxProject;

  throw new Error(
    `Cannot infer Flux project for cwd ${cwd}. Set FLUX_PROJECT_ID to one of:\n${projects.map((p) => `  ${p.id} (${p.slug})`).join("\n")}`,
  );
}

/** Call a Flux MCP tool via HTTP and return the parsed payload. Throws on error. */
export async function callTool(
  fluxUrl: string,
  projectId: string,
  tool: string,
  args: ToolPayload = {},
): Promise<ToolPayload> {
  const toolsUrl = `${fluxUrl}/api/projects/${projectId}/tools`;

  const result = await fetchJsonOrThrow<{
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>(toolsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });

  const textBlock = result.content?.find((c) => c.type === "text");
  if (!textBlock) {
    throw new Error(`${tool}: response contained no text content`);
  }

  let payload: ToolPayload;
  try {
    payload = JSON.parse(textBlock.text) as ToolPayload;
  } catch {
    throw new Error(`${tool}: response was not valid JSON: ${textBlock.text.slice(0, 200)}`);
  }

  if (result.isError || typeof payload.error === "string") {
    throw new Error(`${tool} failed: ${payload.error ?? textBlock.text}`);
  }

  return payload;
}

/** Resolve the project and return a pre-bound callTool function. */
export async function getApiClient(fluxUrl: string) {
  const project = await resolveProject(fluxUrl);
  return {
    project,
    call: (tool: string, args?: ToolPayload) =>
      callTool(fluxUrl, project.id, tool, args),
  };
}
