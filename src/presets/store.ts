import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { CONFIG_DIR } from "../config.js";

export type PresetKind = "video" | "audio";

// name is what the user typed to rename it; without one the label is made from kind and folder.
export type Preset = { id: string; kind: PresetKind; folder: string; name?: string };

export const MAX_NAME_LENGTH = 24;

export const MAX_PRESETS = 5;
const FILE = join(CONFIG_DIR, "presets.json");

function isPreset(p: unknown): p is Preset {
  if (typeof p !== "object" || p === null) return false;
  const r = p as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.kind === "video" || r.kind === "audio") &&
    typeof r.folder === "string" &&
    r.folder !== "" &&
    (r.name === undefined || typeof r.name === "string")
  );
}

// A missing or damaged file is an empty list; the next save replaces it.
export function loadPresets(): Preset[] {
  try {
    const data: unknown = JSON.parse(readFileSync(FILE, "utf8"));
    return Array.isArray(data) ? data.filter(isPreset).slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

// Writes a temp file and renames it, so a crash mid-write can't leave half a file.
// Returns false when the disk refused, so the page can say the preset wasn't saved.
function save(presets: Preset[]): boolean {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    const temp = `${FILE}.tmp`;
    writeFileSync(temp, JSON.stringify(presets));
    renameSync(temp, FILE);
    return true;
  } catch {
    return false;
  }
}

const same = (a: { kind: PresetKind; folder: string }, b: { kind: PresetKind; folder: string }) =>
  a.kind === b.kind && resolve(a.folder).toLowerCase() === resolve(b.folder).toLowerCase();

export const defaultLabel = (p: { kind: PresetKind; folder: string }) =>
  `${p.kind === "video" ? "Video" : "Audio"} → ${basename(p.folder) || p.folder}`;

export const presetLabel = (p: Preset) => p.name?.trim() || defaultLabel(p);

// `id` set means edit that preset; without it, add a new one. Returns an error message or null.
export function savePreset(kind: PresetKind, folder: string, name: string, id?: string): string | null {
  const all = loadPresets();
  if (all.some((p) => p.id !== id && same(p, { kind, folder }))) return "That preset already exists";
  if (id === undefined && all.length >= MAX_PRESETS) return `You can have up to ${MAX_PRESETS} presets`;
  const label = name.trim().slice(0, MAX_NAME_LENGTH);
  const named = label === "" ? {} : { name: label };
  const next = id === undefined
    ? [...all, { id: randomUUID(), kind, folder, ...named }]
    : all.map((p) => (p.id === id ? { id, kind, folder, ...named } : p));
  return save(next) ? null : "Couldn't save the preset (is the disk read-only?)";
}

export function removePreset(id: string): boolean {
  return save(loadPresets().filter((p) => p.id !== id));
}
