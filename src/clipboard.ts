import { spawn } from "node:child_process";

const TIMEOUT_MS = 3000;
const SCRIPT = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Get-Clipboard -Raw";

// The clipboard's text, trimmed, or null when it holds no text or can't be read.
// Node has no clipboard API, so this asks PowerShell (about half a second per call).
export function readClipboard(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
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
