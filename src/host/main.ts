// The browser extension's helper. Chrome starts it (no window) and talks to it over stdin and
// stdout, see stdio.ts. It answers "info" with the real title and thumbnail, and "open" by
// getting the link into the Snatch app. Nothing may print to stdout here.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { killAll } from "../downloader/processes.js";
import { checkLink } from "../downloader/validate.js";
import { sendToRunning } from "../instance.js";
import { refreshPath } from "../tools.js";
import { readMessages, send } from "./stdio.js";

type Request = { type: "info" | "open"; id: number; url: string };

// No whitespace or quotes: the link is placed inside quotes when a window is started.
const LINK = /^https?:\/\/[^\s"]+$/i;
const SNATCH = fileURLToPath(new URL("../index.js", import.meta.url));
const START_SCRIPT =
  "Start-Process -FilePath $env:SNATCH_NODE -WorkingDirectory $env:USERPROFILE " +
  `-ArgumentList ('"' + $env:SNATCH_ENTRY + '"'), '--wait', ('"' + $env:SNATCH_LINK + '"')`;
const STARTUP_WAIT_MS = 15_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// When a Snatch window was last started by this helper, so a second click soon after waits
// for it instead of opening another.
let launchedAt = 0;

async function info({ id, url }: Request): Promise<void> {
  const result = await checkLink(url);
  if (!result.valid) return send({ type: "info", id, ok: false, message: result.message });
  const { title, thumbnail, site, uploader, duration } = result.info;
  send({ type: "info", id, ok: true, title, thumbnail, site, uploader, duration });
}

// A Snatch window that is already open takes the link into its Incoming list. Otherwise one is
// started, with the link checked and waiting for Enter. The helper itself has no window, so
// handing over to an open one shows nothing at all.
async function open({ id, url }: Request): Promise<void> {
  if (await sendToRunning(url)) return send({ type: "open", id, ok: true, how: "running" });

  if (Date.now() - launchedAt < STARTUP_WAIT_MS) {
    for (let i = 0; i < STARTUP_WAIT_MS / 500; i++) {
      await sleep(500);
      if (await sendToRunning(url)) return send({ type: "open", id, ok: true, how: "running" });
    }
  }

  launchedAt = Date.now();
  // Start-Process gives the new window its own console; spawning node directly from here would
  // hand it the browser's pipes instead. The PowerShell that runs it is hidden and exits at once.
  // The link travels in the environment, never in the script text.
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", START_SCRIPT], {
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, SNATCH_NODE: process.execPath, SNATCH_ENTRY: SNATCH, SNATCH_LINK: url },
  });
  child.once("error", (err) => send({ type: "open", id, ok: false, message: err.message }));
  child.once("close", (code) =>
    send(code === 0 ? { type: "open", id, ok: true, how: "new" } : { type: "open", id, ok: false, message: "Could not start Snatch." }),
  );
}

// Chrome's environment can predate an install of yt-dlp or FFmpeg; read the current PATH.
refreshPath();

readMessages(
  (message) => {
    const req = message as Request;
    if (typeof req?.url !== "string" || !LINK.test(req.url)) return;
    const run = req.type === "info" ? info(req) : req.type === "open" ? open(req) : undefined;
    run?.catch((err) => send({ type: req.type, id: req.id, ok: false, message: String(err?.message ?? err) }));
  },
  // The browser closed the connection: stop any link check still running.
  () => {
    killAll();
    process.exit(0);
  },
);
