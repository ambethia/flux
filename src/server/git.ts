import { $ } from "bun";

export async function resolveRepoRoot(): Promise<string> {
  try {
    const result = (await $`git rev-parse --show-toplevel`.text()).trim();
    if (!result) {
      throw new Error("Not a git repository");
    }
    return result;
  } catch {
    throw new Error(
      "Error: Not in a git repository. Flux requires git for project resolution and change tracking.",
    );
  }
}

export async function inferProjectSlug(): Promise<string> {
  try {
    const remote = (await $`git remote get-url origin`.text()).trim();
    // Parse various git remote formats:
    // - https://github.com/user/repo.git
    // - git@github.com:user/repo.git
    // - git@gitlab.com:user/repo
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Fall through to directory name
  }

  // Fallback: use directory name
  const repoRoot = await resolveRepoRoot();
  return repoRoot.split("/").pop() || "flux";
}
