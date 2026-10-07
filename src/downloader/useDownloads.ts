import { statSync } from "node:fs";
import { join } from "node:path";
import { useRef, useState } from "react";
import { recordEnd, recordStart } from "../history/store.js";
import type { Selection } from "../options/formats.js";
import { OUTPUT_DIR, startDownload } from "./download.js";
import { uniqueName } from "./names.js";
import type { DownloadUpdate } from "./types.js";

export type DownloadEntry = {
  // Lets a progress update find its own entry when several downloads run at once.
  id: number;
  // The file it will write, with extension, e.g. "My video (1).mp4".
  file: string;
  update: DownloadUpdate;
};

// What the history needs to know about the video; the rest comes from the selection.
export type DownloadMeta = { site: string | null; estimatedBytes: number | null };

const STARTING: DownloadUpdate = { phase: "downloading", percent: 0, speed: "" };

export const isRunning = (d: DownloadEntry) =>
  d.update.phase === "downloading" || d.update.phase === "processing";

function sizeOnDisk(folder: string, file: string): number | null {
  try {
    return statSync(join(folder, file)).size;
  } catch {
    return null;
  }
}

// The list of downloads for the whole app. It lives above the screens, so a download keeps
// going, and keeps reporting, whichever screen is showing.
export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const nextId = useRef(1);
  // Files that running downloads will write, so two downloads never pick the same name.
  const claimed = useRef(new Set<string>());

  function start(url: string, selection: Selection, meta: DownloadMeta) {
    const id = nextId.current++;
    const ext = selection.format.id;
    const folder = selection.folder ?? OUTPUT_DIR;
    const filename = uniqueName(folder, selection.filename, ext, claimed.current);
    const file = `${filename}.${ext}`;
    claimed.current.add(file.toLowerCase());
    setDownloads((list) => [...list, { id, file, update: STARTING }]);
    const historyId = recordStart({ site: meta.site, file, bytes: meta.estimatedBytes, folder });

    startDownload(url, { ...selection, filename }, (update) => {
      setDownloads((list) => list.map((d) => (d.id === id ? { ...d, update } : d)));
      // A finished file exists on disk, and a failed one can reuse its name.
      if (update.phase === "done" || update.phase === "failed") claimed.current.delete(file.toLowerCase());
      if (update.phase === "done") recordEnd(historyId, "done", sizeOnDisk(folder, file) ?? meta.estimatedBytes);
      else if (update.phase === "failed") recordEnd(historyId, "failed", null);
    }, folder);
  }

  // Finished and failed downloads are dropped; running ones stay.
  function clearFinished() {
    setDownloads((list) => list.filter(isRunning));
  }

  return { downloads, start, clearFinished };
}
