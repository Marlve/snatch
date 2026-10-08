#!/usr/bin/env node
import { render } from "ink";
import { App } from "./App.js";
import { registerNativeHost } from "./host/register.js";
import { createShortcut, runsFromNpxCache } from "./setup.js";
import { askToInstall, findMissingTools, installMissing, missingToolsMessage, refreshPath } from "./tools.js";

// `snatch setup` adds a Start Menu shortcut and exits.
if (process.argv[2] === "setup") {
  try {
    console.log(`Shortcut created: ${await createShortcut()}`);
    if (await registerNativeHost()) console.log("Connected the browser extension (Chrome, Edge and Firefox).");
    if (runsFromNpxCache()) {
      console.log("Warning: this copy runs from npx's cache, which npm may delete. Run `npm i -g` first, then `snatch setup` again.");
    }
  } catch (err) {
    console.error(`Could not create the shortcut: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
} else {
  // Checked before the alternate screen opens, so the messages stay visible in the terminal.
  let missing = await findMissingTools();
  if (missing.length > 0 && process.stdin.isTTY && (await askToInstall(missing))) {
    installMissing(missing);
    refreshPath();
    missing = await findMissingTools();
  }
  if (missing.length > 0) {
    console.error(missingToolsMessage(missing));
    process.exitCode = 1;
  } else {
    // `snatch <link>` opens with that link already being checked. `--wait` (used by the browser
    // extension) makes it stop on Home for Enter instead of moving on. Other arguments
    // starting with "-" are options, not links, and are ignored.
    const args = process.argv.slice(2);
    const startLink = args.find((a) => !a.startsWith("-"));

    render(<App startLink={startLink} waitForEnter={args.includes("--wait")} />, { exitOnCtrlC: false, alternateScreen: true });
  }
}
