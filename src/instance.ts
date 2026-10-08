import { unlinkSync } from "node:fs";
import { connect, createServer } from "node:net";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

// One Snatch window per user receives links from the browser helper. A pipe on Windows, a
// socket file on macOS. Connecting to it also shows whether a window is running.
const user = userInfo().username.replace(/[^\w.-]/g, "_");
const ADDRESS = process.platform === "win32" ? `\\\\.\\pipe\\snatch-${user}` : join(tmpdir(), `snatch-${user}.sock`);

const LINK = /^https?:\/\/\S+$/i;
const TIMEOUT_MS = 1500;
const MAX_BYTES = 8192;

// Gives the link to the Snatch window that is already open. False when there is none.
export function sendToRunning(link: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(ADDRESS);
    const timer = setTimeout(() => socket.destroy(), TIMEOUT_MS);
    let accepted = false;
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${link}\n`));
    socket.on("data", (reply: string) => {
      accepted = reply.startsWith("ok");
      socket.end();
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      clearTimeout(timer);
      resolve(accepted);
    });
  });
}

function isListening(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(ADDRESS);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

// Calls onLink for each http(s) link the helper sends. Does nothing when a window is
// already listening. Returns a function that stops listening.
export function listenForLinks(onLink: (link: string) => void): () => void {
  const server = createServer((socket) => {
    let text = "";
    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("data", (chunk: string) => {
      text += chunk;
      if (text.length > MAX_BYTES) return socket.destroy();
      const end = text.indexOf("\n");
      if (end < 0) return;
      const link = text.slice(0, end).trim();
      if (LINK.test(link)) {
        onLink(link);
        socket.end("ok\n");
      } else {
        socket.end("no\n");
      }
    });
  });
  // Never keeps the process alive once the screen is gone.
  server.unref();

  let retried = false;
  server.on("error", async (err: NodeJS.ErrnoException) => {
    if (err.code !== "EADDRINUSE") return;
    // On macOS a crashed window leaves its socket file behind; a refused connection means
    // nobody is listening, so the file can go. On Windows the pipe vanishes with its owner.
    if (retried || process.platform === "win32" || (await isListening())) return;
    retried = true;
    try {
      unlinkSync(ADDRESS);
    } catch {
      return;
    }
    server.listen(ADDRESS);
  });
  server.listen(ADDRESS);

  return () => {
    server.close();
  };
}
