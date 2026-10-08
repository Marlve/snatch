import { api } from "./api.js";

const view = document.getElementById("view");
const send = (message) => api.runtime.sendMessage(message);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clock(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function formatBytes(n) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  for (; n >= 1024 && i < units.length - 1; i++) n /= 1024;
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

// The Send to Snatch button for one link. The helper either hands the link to a Snatch window
// that is already open or starts one, so this can take a few seconds when Snatch is launching.
function sendControl(url) {
  const box = el("div", "control");

  function idle(error) {
    box.replaceChildren();
    if (error) box.append(el("div", "error", error));
    const button = el("button", "", error ? "Try again" : "Send to Snatch");
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Sending…";
      const result = await send({ type: "open", url });
      if (!result.ok) return idle(result.message);
      box.replaceChildren(el("div", "done", result.how === "running" ? "✓ Sent to your open Snatch window" : "✓ Opening Snatch…"));
    });
    box.append(button);
  }

  idle();
  return box;
}

function videoCard(url, info) {
  const card = el("div", "card");
  const top = el("div", "card-top");
  if (info.thumbnail) {
    const img = el("img", "thumb");
    img.src = info.thumbnail;
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    top.append(img);
  }
  const text = el("div", "card-text");
  const meta = [info.site, info.duration ? clock(info.duration) : ""].filter(Boolean).join(" · ");
  text.append(el("div", "card-title", info.title), el("div", "dim", meta));
  top.append(text);
  card.append(top, sendControl(url));
  return card;
}

// For pages yt-dlp can't read: the media files the page itself loaded.
function linkRow({ kind, url, size }) {
  let name = url;
  let host = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? host);
  } catch {
    // Keep the whole address as the name.
  }
  const li = el("li");
  const label = el("div", "label");
  label.title = url;
  label.append(el("div", "name", name), el("div", "dim", [kind, host, size ? formatBytes(size) : ""].filter(Boolean).join(" · ")));
  li.append(label, sendControl(url));
  return li;
}

function message(text) {
  view.replaceChildren(el("p", "dim", text));
}

// Without access to all sites the background check can't read a tab's address, so every popup
// open waits on a fresh lookup. Firefox does not grant this by default.
async function warnIfNoSiteAccess() {
  const granted = await api.permissions.contains({ origins: ["<all_urls>"] }).catch(() => true);
  if (granted) return;
  view.after(
    el("p", "dim", "Pages can't be checked ahead of time: allow this extension access to all sites in the browser's add-on settings (Permissions)."),
  );
}

const [tab] = await api.tabs.query({ active: true, currentWindow: true });
if (!tab?.url?.startsWith("http")) {
  message("Open a page with a video.");
} else {
  message("Checking this page…");
  warnIfNoSiteAccess();
  const info = await send({ type: "info", url: tab.url });
  const found = ((await api.storage.session.get(`tab:${tab.id}`))[`tab:${tab.id}`] ?? []).slice().reverse();

  if (info.ok) {
    view.replaceChildren(videoCard(tab.url, info));
  } else if (info.helper) {
    message(info.message);
  } else if (found.length > 0) {
    const list = el("ul");
    list.append(...found.map(linkRow));
    view.replaceChildren(el("p", "dim", "No video recognised here. Media this page loaded:"), list);
  } else {
    // A missing yt-dlp or FFmpeg is worth saying; anything else just means no video here.
    message(/PATH/.test(info.message ?? "") ? info.message : "No video found on this page.");
  }
}
