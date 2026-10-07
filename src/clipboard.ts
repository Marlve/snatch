import { spawn } from "node:child_process";
import { IS_MAC } from "./platform.js";

const TIMEOUT_MS = 3000;
const POWERSHELL_SCRIPT = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard -Raw";

// Node has no clipboard API, so this asks the system: PowerShell on Windows (about half a
// second per call), pbpaste on macOS.
const [COMMAND, ARGS]: [string, string[]] = IS_MAC
  ? ["pbpaste", []]
  : ["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SCRIPT]];

// The clipboard's text, trimmed, or null when it holds no text or can't be read.
export function readClipboard(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(COMMAND, ARGS, {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      // pbpaste picks its text encoding from the locale; links must come out as UTF-8.
      env: IS_MAC ? { ...process.env, LANG: "en_US.UTF-8" } : process.env,
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    // A link is short; anything huge is not worth keeping.
    child.stdout.on("data", (chunk: string) => {
      if (out.length < 4096) out += chunk;
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      const text = out.trim();
      resolve(text === "" ? null : text);
    });
  });
}
