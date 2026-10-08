import { api } from "./api.js";
import { getInfo, openInSnatch } from "./host.js";
import { classify } from "./media.js";

// The worker is stopped after ~30 s idle, so found links live in storage.session, not memory.
const key = (tabId) => `tab:${tabId}`;

const MIN_MEDIA_BYTES = 200_000;

// Updates are read-modify-write; running them one at a time stops two responses arriving
// together from overwriting each other.
let queue = Promise.resolve();
const enqueue = (task) => (queue = queue.then(task).catch(console.error));

function header(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
}

// Whole-file size: the total in "bytes 0-99/12345" for partial responses, else Content-Length.
function fileSize(headers) {
  const total = Number(header(headers, "content-range").split("/")[1]);
  const length = Number(header(headers, "content-length"));
  return total > 0 ? total : length > 0 ? length : null;
}

api.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const kind = classify(details.url, header(details.responseHeaders, "content-type"));
    if (!kind) return;
    // Interface sounds and tiny clips are not what anyone is watching; playlists are small by nature.
    const size = fileSize(details.responseHeaders);
    if ((kind === "Video" || kind === "Audio") && size !== null && size < MIN_MEDIA_BYTES) return;
    enqueue(async () => {
      const k = key(details.tabId);
      const found = (await api.storage.session.get(k))[k] ?? [];
      if (found.some((item) => item.url === details.url)) return;
      found.push({ url: details.url, kind, size });
      await api.storage.session.set({ [k]: found });
      prefetch(details.tabId);
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] },
  ["responseHeaders"],
);

// yt-dlp takes several seconds to describe a page, so start as soon as the page has loaded media
// and the popup finds the answer waiting. Only pages that load media qualify: asking yt-dlp
// about every page visited would fetch each one a second time.
async function prefetch(tabId) {
  try {
    const { url } = await api.tabs.get(tabId);
    if (isWeb(url)) await getInfo(url);
  } catch {
    // The tab closed meanwhile; nothing to warm up.
  }
}

// A new page in the tab starts a fresh list.
api.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    enqueue(async () => {
      await api.storage.session.remove(key(details.tabId));
    });
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
);

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "snatch",
    title: "Download with Snatch",
    contexts: ["link", "video", "audio", "page"],
  });
});

const isWeb = (url) => /^https?:\/\//i.test(url ?? "");

function notify(message) {
  api.notifications.create({ type: "basic", iconUrl: "icons/icon-128.png", title: "Snatch", message });
}

// Right-click has no popup to show the outcome, so say it in a notification.
async function send(link) {
  const result = await openInSnatch(link);
  notify(!result.ok ? result.message : result.how === "running" ? "Sent to your open Snatch window." : "Opening Snatch…");
}

// What to send: a clicked link, else the clicked media's own address, else the newest media
// link seen on the tab (video elements often use a blob: address), else the page itself.
api.contextMenus.onClicked.addListener(async (info, tab) => {
  let link = [info.linkUrl, info.srcUrl].find(isWeb);
  if (!link) {
    const found = (await api.storage.session.get(key(tab.id)))[key(tab.id)] ?? [];
    link = found.at(-1)?.url ?? info.pageUrl;
  }
  send(link);
});

api.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => api.storage.session.remove(key(tabId)));
});

// The popup asks for a link's details, or to send it to Snatch.
api.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message.type === "info") getInfo(message.url).then(reply);
  else if (message.type === "open") openInSnatch(message.url).then(reply);
  return true;
});
