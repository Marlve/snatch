import { existsSync } from "node:fs";
import { join } from "node:path";

// Returns `name`, or `name (1)`, `name (2)`, ... : the first one whose file doesn't exist in
// `dir` and isn't claimed by a running download. `claimed` holds lower-case file names with
// their extension, because a running download's file doesn't exist on disk until it finishes.
export function uniqueName(dir: string, name: string, ext: string, claimed: Set<string>): string {
  const isFree = (candidate: string) => {
    const file = `${candidate}.${ext}`;
    return !claimed.has(file.toLowerCase()) && !existsSync(join(dir, file));
  };
  if (isFree(name)) return name;
  for (let n = 1; ; n++) {
    const candidate = `${name} (${n})`;
    if (isFree(candidate)) return candidate;
  }
}
