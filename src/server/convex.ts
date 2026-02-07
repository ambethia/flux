import { ConvexClient } from "convex/browser";

let _client: ConvexClient | undefined;

export function getConvexClient(): ConvexClient {
  if (!_client) {
    const url = process.env.CONVEX_URL;
    if (!url) {
      throw new Error("CONVEX_URL environment variable is not set.");
    }
    _client = new ConvexClient(url);
  }
  return _client;
}
