import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { IS_MAC } from "./platform.js";

function run(file: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { env, windowsHide: true }, (err, _stdout, stderr) =>
      err ? reject(new Error(stderr.trim() || err.message)) : resolve(),
    );
  });
}

// The icons ship next to dist/ in the package; without one the shortcut keeps its default icon.
const asset = (name: string) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));

// Creates a shortcut that opens snatch in a terminal window. It stores absolute paths to node
// and to this install, so it works without npm's bin folder on PATH. Returns where it is.
export function createShortcut(): Promise<string> {
  const entry = fileURLToPath(new URL("./index.js", import.meta.url));
  return IS_MAC ? createMacApp(entry) : createWindowsShortcut(entry);
}

async function createWindowsShortcut(entry: string): Promise<string> {
  const programs = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
  const shortcut = join(programs, "Snatch.lnk");
  const icon = existsSync(asset("snatch.ico")) ? asset("snatch.ico") : "";
  mkdirSync(programs, { recursive: true });

  // "|| pause" keeps the window open when snatch exits with an error, so the message can be read.
  const args = `/d /c ""${process.execPath}" "${entry}" || pause"`;
  const script = [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SNATCH_LNK)",
    "$s.TargetPath = $env:ComSpec",
    "$s.Arguments = $env:SNATCH_ARGS",
    "$s.WorkingDirectory = $env:USERPROFILE",
    "$s.Description = 'Snatch'",
    "if ($env:SNATCH_ICON) { $s.IconLocation = $env:SNATCH_ICON }",
    "$s.Save()",
  ].join("; ");

  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    ...process.env,
    SNATCH_LNK: shortcut,
    SNATCH_ARGS: args,
    SNATCH_ICON: icon,
  });
  return shortcut;
}

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;
const appleScriptString = (s: string) => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

// The AppleScript behind Snatch.app: a new Terminal window running snatch. `exec` replaces the
// shell, so the window closes when snatch quits and stays open after an error.
export function macLauncherLines(node: string, entry: string): string[] {
  const command = `exec ${shellQuote(node)} ${shellQuote(entry)}`;
  return ['tell application "Terminal"', "activate", `do script ${appleScriptString(command)}`, "end tell"];
}

// ~/Applications/Snatch.app, made with macOS's own osacompile, so it shows in Launchpad and Spotlight.
// The first launch asks once to let it control Terminal.
async function createMacApp(entry: string): Promise<string> {
  const apps = join(homedir(), "Applications");
  const app = join(apps, "Snatch.app");
  mkdirSync(apps, { recursive: true });
  rmSync(app, { recursive: true, force: true });
  await run("osacompile", ["-o", app, ...macLauncherLines(process.execPath, entry).flatMap((l) => ["-e", l])]);

  if (existsSync(asset("snatch.icns"))) {
    copyFileSync(asset("snatch.icns"), join(app, "Contents", "Resources", "applet.icns"));
    // Changing a file inside the app breaks its signature, so sign it again (ad hoc), then
    // touch it so Finder drops its cached icon. Neither is worth failing the setup over.
    await run("codesign", ["--force", "--deep", "--sign", "-", app]).catch(() => {});
    await run("touch", [app]).catch(() => {});
  }
  return app;
}

// True when snatch is running from npx's temporary cache, which npm may delete later.
export function runsFromNpxCache(): boolean {
  return fileURLToPath(import.meta.url).includes("_npx");
}
