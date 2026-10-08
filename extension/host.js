// The connection to Snatch's helper program (registered by `snatch setup`). It is held here,
// not in the popup, so it outlives the popup; a live native port also keeps this worker running.

import { api } from "./api.js";

const HOST = "com.snatch.host";
const NOT_INSTALLED = "Run `snatch setup` once, then try again.";

let port = null;
let nextId = 1;
const waiting = new Map();

// With nothing left to ask, let go of the helper so it exits instead of running all day.
const IDLE_MS = 20_000;
let idle;
function restSoon() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (waiting.size > 0) return;
    port?.disconnect();
    port = null;
  }, IDLE_MS);
}

function onMessage(message) {
  waiting.get(message.id)?.(message);
  waiting.delete(message.id);
  restSoon();
}

function connect() {
  if (port) return port;
  const next = api.runtime.connectNative(HOST);
  next.onMessage.addListener(onMessage);
  next.onDisconnect.addListener(() => {
    // A missing registration shows up here, not as an exception when connecting.
    const reason = (next.error ?? api.runtime.lastError)?.message ?? "";
    const message = /not found|forbidden|no such native|permission/i.test(reason) ? NOT_INSTALLED : "The Snatch helper stopped.";
    port = null;
    for (const resolve of waiting.values()) resolve({ ok: false, message, helper: true });
    waiting.clear();
  });
  port = next;
  return next;
}

function ask(request) {
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    connect().postMessage({ ...request, id });
  });
}

// The real title and thumbnail for a link, from yt-dlp. Answers are kept for the browser
// session, so reopening the popup is instant; helper failures are not kept.
export function getInfo(url) {
  if (!lookups.has(url)) lookups.set(url, lookUp(url).finally(() => lookups.delete(url)));
  return lookups.get(url);
}

// One lookup per page at a time, so the background check and the popup share it.
const lookups = new Map();

async function lookUp(url) {
  const key = `info:${url}`;
  const cached = (await api.storage.session.get(key))[key];
  if (cached) return cached;
  const reply = await ask({ type: "info", url });
  if (!reply.helper) await api.storage.session.set({ [key]: reply });
  return reply;
}

// Gets the link into Snatch: a window that is already open takes it, else one is started.
// Resolves to { ok, how: "running" | "new" } or { ok: false, message }.
export const openInSnatch = (url) => ask({ type: "open", url });
