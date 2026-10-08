import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_DIR } from "../config.js";
import { IS_MAC } from "../platform.js";
import { run } from "../setup.js";

const HOST_NAME = "com.snatch.host";
// Only these extensions may talk to the helper. Chrome and Edge list origins; the ID is fixed
// by the public key in extension/manifest.json. Firefox lists the add-on ID from the
// manifest's browser_specific_settings.
const EXTENSION_IDS = ["bjmififkddkaejbefkgnhgoohbnlocde"];
const FIREFOX_IDS = ["snatch@marlve.github.io"];

// Lets Chrome, Edge and Firefox start the helper for the extension: a launcher that runs node
// on main.js, a manifest naming it, and the per-user registry keys that point each browser at
// the manifest. No admin rights. Windows only for now.
export async function registerNativeHost(): Promise<boolean> {
  if (IS_MAC) return false;
  const dir = join(CONFIG_DIR, "native-host");
  const launcher = join(dir, "snatch-host.cmd");
  const main = fileURLToPath(new URL("./main.js", import.meta.url));
  const base = { name: HOST_NAME, description: "Snatch helper for the browser extension", path: launcher, type: "stdio" };
  // Firefox rejects the whole manifest if it has Chrome's allowed_origins, so each family gets its own.
  const chromeManifest = join(dir, `${HOST_NAME}.json`);
  const firefoxManifest = join(dir, `${HOST_NAME}.firefox.json`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "${main}"\r\n`);
  writeFileSync(
    chromeManifest,
    JSON.stringify({ ...base, allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`) }, null, 2),
  );
  writeFileSync(firefoxManifest, JSON.stringify({ ...base, allowed_extensions: FIREFOX_IDS }, null, 2));
  const targets: [string, string][] = [
    ["Google\\Chrome", chromeManifest],
    ["Microsoft\\Edge", chromeManifest],
    ["Mozilla", firefoxManifest],
  ];
  for (const [browser, manifest] of targets) {
    await run("reg", ["add", `HKCU\\Software\\${browser}\\NativeMessagingHosts\\${HOST_NAME}`, "/ve", "/d", manifest, "/f"]);
  }
  return true;
}
