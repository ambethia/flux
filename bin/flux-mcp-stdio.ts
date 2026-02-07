import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { allTools } from "../src/server/tools/schema";

const FLUX_URL = process.env.FLUX_URL ?? "http://localhost:8042";

const mcp = new McpServer({ name: "flux", version: "0.1.0" });

for (const tool of allTools) {
  mcp.tool(tool.name, tool.description, tool.schema, async (args) => {
    const res = await fetch(`${FLUX_URL}/api/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: tool.name, args }),
    });
    if (!res.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Flux server error: ${res.status} ${res.statusText}`,
          },
        ],
        isError: true,
      };
    }
    return res.json();
  });
}

const transport = new StdioServerTransport();
await mcp.connect(transport);
