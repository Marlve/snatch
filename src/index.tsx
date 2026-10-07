#!/usr/bin/env node
import { render } from "ink";
import { App } from "./App.js";
import { createShortcut, runsFromNpxCache } from "./setup.js";
import { askToInstall, findMissingTools, installWithWinget, missingToolsMessage, refreshPath } from "./tools.js";

// `snatch setup` adds a Start Menu shortcut and exits.
if (process.argv[2] === "setup") {
  try {
    console.log(`Shortcut created: ${await createShortcut()}`);
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
    installWithWinget(missing);
    refreshPath();
    missing = await findMissingTools();
  }
  if (missing.length > 0) {
    console.error(missingToolsMessage(missing));
    process.exitCode = 1;
  } else {
    // `snatch <link>` opens with that link already being checked. An argument starting with "-"
    // is an option, not a link, and is ignored.
    const arg = process.argv[2];
    const startLink = arg && !arg.startsWith("-") ? arg : undefined;

    render(<App startLink={startLink} />, { exitOnCtrlC: false, alternateScreen: true });
  }
}
