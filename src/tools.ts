import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { IS_MAC } from "./platform.js";

export type Tool = { command: string; versionArg: string; wingetId: string; brewName: string };

export const TOOLS: Tool[] = [
  { command: "yt-dlp", versionArg: "--version", wingetId: "yt-dlp.yt-dlp", brewName: "yt-dlp" },
  { command: "ffmpeg", versionArg: "-version", wingetId: "yt-dlp.FFmpeg", brewName: "ffmpeg" },
];

const INSTALLER = IS_MAC ? "Homebrew" : "winget";

function isInstalled({ command, versionArg }: Tool): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, [versionArg], { stdio: "ignore", windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(true));
  });
}

export async function findMissingTools(): Promise<Tool[]> {
  const found = await Promise.all(TOOLS.map(isInstalled));
  return TOOLS.filter((_, i) => !found[i]);
}

// The commands that install these tools, one per line.
export function installCommands(tools: Tool[]): string[] {
  return IS_MAC
    ? [`brew install ${tools.map((t) => t.brewName).join(" ")}`]
    : tools.map((t) => `winget install ${t.wingetId}`);
}

export function missingToolsMessage(missing: Tool[]): string {
  return [
    `snatch needs yt-dlp and ffmpeg on your PATH. Missing: ${missing.map((t) => t.command).join(", ")}.`,
    IS_MAC ? "Install with Homebrew (https://brew.sh):" : "Install with:",
    ...installCommands(missing).map((c) => `  ${c}`),
    ...(IS_MAC ? [] : ["Then open a new terminal, because PATH is only read when a terminal starts."]),
  ].join("\n");
}

// Asks before installing anything. Enter means yes.
export async function askToInstall(missing: Tool[]): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`snatch needs ${missing.map((t) => t.command).join(" and ")}. Install with ${INSTALLER} now? (Y/n) `);
    return answer.trim() === "" || /^y/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export function installMissing(missing: Tool[]): void {
  if (IS_MAC) {
    if (spawnSync("brew", ["--version"], { stdio: "ignore" }).error) {
      console.log("Homebrew isn't installed. Get it from https://brew.sh, then run snatch again.");
      return;
    }
    console.log(`Installing ${missing.map((t) => t.command).join(" and ")}...`);
    const result = spawnSync("brew", ["install", ...missing.map((t) => t.brewName)], { stdio: "inherit" });
    if (result.error || result.status !== 0) console.log("Could not install them.");
    return;
  }
  for (const tool of missing) {
    console.log(`Installing ${tool.command}...`);
    const args = ["install", "--id", tool.wingetId, "--exact", "--silent", "--accept-source-agreements", "--accept-package-agreements"];
    const result = spawnSync("winget", args, { stdio: "inherit" });
    if (result.error || result.status !== 0) console.log(`Could not install ${tool.command}.`);
  }
}

// winget changes PATH for new terminals only; this reads the current value from Windows
// so snatch can find the tools it just installed without restarting. Homebrew installs
// into a folder that is already on PATH (brew itself had to be found), so a Mac needs nothing.
export function refreshPath(): void {
  if (IS_MAC) return;
  try {
    const path = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    if (path) process.env.PATH = path;
  } catch {
    // Keep the old PATH; the caller's second check then reports what is missing.
  }
}
