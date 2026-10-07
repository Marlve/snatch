import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HistoryEntry } from "./store.js";

// Opens File Explorer with the file selected, without opening the file itself.
// Returns false when the file isn't there any more.
export function revealFile(entry: HistoryEntry): boolean {
  const path = join(entry.folder, entry.file);
  if (!existsSync(path)) return false;
  // Verbatim, with the path quoted by hand: Node would quote the whole "/select,..." argument,
  // which Explorer doesn't understand. File names can't contain a quote on Windows.
  const child = spawn("explorer.exe", [`/select,"${path}"`], {
    stdio: "ignore",
    detached: true,
    windowsVerbatimArguments: true,
  });
  // Explorer exits with code 1 even when it worked, so only a failure to start matters.
  child.on("error", () => {});
  child.unref();
  return true;
}
