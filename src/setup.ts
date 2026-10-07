import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Creates a Start Menu shortcut that opens snatch in a terminal window. The shortcut stores
// absolute paths to node and to this install, so it works without npm's bin folder on PATH.
export function createShortcut(): Promise<string> {
  const entry = fileURLToPath(new URL("./index.js", import.meta.url));
  const programs = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs");
  const shortcut = join(programs, "Snatch.lnk");
  mkdirSync(programs, { recursive: true });

  // "|| pause" keeps the window open when snatch exits with an error, so the message can be read.
  const args = `/d /c ""${process.execPath}" "${entry}" || pause"`;
  const script = [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SNATCH_LNK)",
    "$s.TargetPath = $env:ComSpec",
    "$s.Arguments = $env:SNATCH_ARGS",
    "$s.WorkingDirectory = $env:USERPROFILE",
    "$s.Description = 'Snatch'",
    "$s.Save()",
  ].join("; ");

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { env: { ...process.env, SNATCH_LNK: shortcut, SNATCH_ARGS: args }, windowsHide: true },
      (err, _stdout, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve(shortcut)),
    );
  });
}

// True when snatch is running from npx's temporary cache, which npm may delete later.
export function runsFromNpxCache(): boolean {
  return fileURLToPath(import.meta.url).includes("_npx");
}
