import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";

export type HistoryStatus = "running" | "done" | "failed" | "interrupted";

export type HistoryEntry = {
  id: string;
  site: string | null;
  // The file name with its extension, e.g. "My video (1).mp4".
  file: string;
  // The estimate while running, the real size once done, null when unknown or failed.
  bytes: number | null;
  folder: string;
  status: HistoryStatus;
};

export const MAX_ENTRIES = 50;
const FILE = join(CONFIG_DIR, "history.json");
const STATUSES: HistoryStatus[] = ["running", "done", "failed", "interrupted"];

// Entries started by this run of the app; a "running" entry not in here is left over from a run that quit.
const active = new Set<string>();

function isEntry(e: unknown): e is HistoryEntry {
  if (typeof e !== "object" || e === null) return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.file === "string" &&
    typeof r.folder === "string" &&
    (r.site === null || typeof r.site === "string") &&
    (r.bytes === null || typeof r.bytes === "number") &&
    STATUSES.includes(r.status as HistoryStatus)
  );
}

// A missing or damaged file is an empty history; the next write replaces it.
function readAll(): HistoryEntry[] {
  try {
    const data: unknown = JSON.parse(readFileSync(FILE, "utf8"));
    return Array.isArray(data) ? data.filter(isEntry) : [];
  } catch {
    return [];
  }
}

// Writes a temp file and renames it, so a crash mid-write can't leave half a file.
// A failed write (read-only disk, no permission) only loses history, never the download.
function writeAll(entries: HistoryEntry[]): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const temp = `${FILE}.tmp`;
    writeFileSync(temp, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    renameSync(temp, FILE);
  } catch {
    // ignored on purpose
  }
}

// Newest first.
export function loadHistory(): HistoryEntry[] {
  return readAll().map((e) =>
    e.status === "running" && !active.has(e.id) ? { ...e, status: "interrupted" } : e,
  );
}

// Called when Download is pressed. Returns the id to finish the entry with later.
export function recordStart(entry: Omit<HistoryEntry, "id" | "status">): string {
  const id = randomUUID();
  active.add(id);
  writeAll([{ ...entry, id, status: "running" }, ...readAll()]);
  return id;
}

export function recordEnd(id: string, status: "done" | "failed", bytes: number | null): void {
  active.delete(id);
  writeAll(readAll().map((e) => (e.id === id ? { ...e, status, bytes } : e)));
}
