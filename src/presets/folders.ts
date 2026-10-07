import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { OUTPUT_DIR } from "../downloader/download.js";

export type KnownFolder = { label: "Downloads" | "Music" | "Videos"; path: string };

// The usual places, used until (or unless) Windows answers.
export const USUAL_FOLDERS: KnownFolder[] = [
  { label: "Downloads", path: OUTPUT_DIR },
  { label: "Music", path: join(homedir(), "Music") },
  { label: "Videos", path: join(homedir(), "Videos") },
];

// Windows can move Music and Videos (OneDrive does), so ask it where they really are.
// Falls back to the usual places if that fails.
export function knownFolders(): Promise<KnownFolder[]> {
  const script = "[Environment]::GetFolderPath('MyMusic'); [Environment]::GetFolderPath('MyVideos')";
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        const [music, videos] = stdout.split(/\r?\n/).map((l) => l.trim());
        if (err || !music || !videos) return resolve(USUAL_FOLDERS);
        resolve([USUAL_FOLDERS[0], { label: "Music", path: music }, { label: "Videos", path: videos }]);
      },
    );
  });
}

// Folders the search never looks inside: hidden ones, caches, and system folders.
const SKIP = new Set(["node_modules", "AppData", "$RECYCLE.BIN", "System Volume Information"]);
const MAX_DEPTH = 8;

// Every folder under the user's home folder, as full paths.
export async function scanFolders(root: string = homedir()): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const subs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name));
    for (const e of subs) found.push(join(dir, e.name));
    if (depth < MAX_DEPTH) await Promise.all(subs.map((e) => walk(join(dir, e.name), depth + 1)));
  }
  await walk(root, 1);
  return found;
}

const depthOf = (p: string) => p.split(/[\\/]/).length;

// Folders whose name contains the query: names that start with it first, then shallower ones.
export function searchFolders(all: string[], query: string, limit: number): string[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  return all
    .filter((p) => basename(p).toLowerCase().includes(q))
    .sort((a, b) => {
      const starts = Number(basename(b).toLowerCase().startsWith(q)) - Number(basename(a).toLowerCase().startsWith(q));
      return starts || depthOf(a) - depthOf(b) || a.localeCompare(b);
    })
    .slice(0, limit);
}

// A typed or pasted full path, if it names a folder that exists.
export async function existingFolder(text: string): Promise<string | null> {
  const path = text.trim().replace(/^"(.*)"$/, "$1");
  if (!/^[a-z]:[\\/]/i.test(path) && !path.startsWith("\\\\")) return null;
  try {
    return (await stat(path)).isDirectory() ? path : null;
  } catch {
    return null;
  }
}
