import { useCallback, useState } from "react";
import type { VideoInfo } from "../downloader/info.js";
import { checkLink } from "../downloader/validate.js";

export type IncomingItem = {
  link: string;
  state: { kind: "checking" } | { kind: "ready"; info: VideoInfo } | { kind: "invalid"; message: string };
};

// Links sent from the browser while this window is open. Each is checked on arrival, so its
// title is ready by the time it is opened.
export function useIncoming() {
  const [items, setItems] = useState<IncomingItem[]>([]);

  const add = useCallback((link: string) => {
    setItems((list) => (list.some((i) => i.link === link) ? list : [...list, { link, state: { kind: "checking" } }]));
    void checkLink(link).then((result) => {
      const state: IncomingItem["state"] = result.valid
        ? { kind: "ready", info: result.info }
        : { kind: "invalid", message: result.message };
      setItems((list) => list.map((i) => (i.link === link ? { ...i, state } : i)));
    });
  }, []);

  const remove = useCallback((link: string) => {
    setItems((list) => list.filter((i) => i.link !== link));
  }, []);

  return { items, add, remove };
}
