// Builds the store uploads from extension/: one zip for Chrome and Edge, one for Firefox and Zen.
// The files are the same; only the manifest differs. Run with `npm run package:extension`.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "extension");
const out = join(root, "build");
const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));

// `key` pins the ID for development builds; a store assigns its own ID, so neither upload has it.
const { key, ...common } = manifest;

const builds = {
  // Chrome ignores the Firefox-only settings and warns about them, so they are left out.
  chrome() {
    const { scripts, ...background } = common.background;
    const { browser_specific_settings, ...rest } = common;
    return { ...rest, background };
  },
  // Firefox uses background.scripts. New add-ons must declare what data they collect (none: the page
  // address only goes to the helper on the user's own computer), and Mozilla pairs that with 140+.
  firefox() {
    const { service_worker, ...background } = common.background;
    const gecko = {
      ...common.browser_specific_settings.gecko,
      strict_min_version: "140.0",
      data_collection_permissions: { required: ["none"] },
    };
    return { ...common, background, browser_specific_settings: { gecko } };
  },
};

const files = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();

// A minimal zip writer (deflate, fixed 1980 timestamp), so the result doesn't depend on which
// `tar` or PowerShell version is installed. Entry names use "/" and manifest.json is at the root.
function zip(dir) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files(dir)) {
    const name = Buffer.from(file.split(sep).join("/"));
    const data = readFileSync(join(dir, file));
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0x21, 12); // 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    local.copy(entry, 6, 4, 30); // version needed .. name length are laid out the same
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

rmSync(out, { recursive: true, force: true });
for (const [name, makeManifest] of Object.entries(builds)) {
  const dir = join(out, name);
  cpSync(source, dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(makeManifest(), null, 2) + "\n");
  const path = join(out, `snatch-${name}-${manifest.version}.zip`);
  mkdirSync(out, { recursive: true });
  writeFileSync(path, zip(dir));
  console.log(path);
}
