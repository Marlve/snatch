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
  const manifest = join(dir, `${HOST_NAME}.json`);
  const main = fileURLToPath(new URL("./main.js", import.meta.url));

  mkdirSync(dir, { recursive: true });
  writeFileSync(launcher, `@echo off\r\n"${process.execPath}" "${main}"\r\n`);
  writeFileSync(
    manifest,
    JSON.stringify(
      {
        name: HOST_NAME,
        description: "Snatch helper for the browser extension",
        path: launcher,
        type: "stdio",
        allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`),
        allowed_extensions: FIREFOX_IDS,
      },
      null,
      2,
    ),
  );
  for (const browser of ["Google\\Chrome", "Microsoft\\Edge", "Mozilla"]) {
    await run("reg", ["add", `HKCU\\Software\\${browser}\\NativeMessagingHosts\\${HOST_NAME}`, "/ve", "/d", manifest, "/f"]);
  }
  return true;
}
