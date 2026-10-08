import type { EventEmitter } from "node:events";
import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdin, useWindowSize } from "ink";
import { IncomingList } from "../components/IncomingList.js";
import { Spinner } from "../components/Spinner.js";
import { Title } from "../components/Title.js";
import { readClipboard } from "../clipboard.js";
import type { VideoInfo } from "../downloader/info.js";
import { checkLink } from "../downloader/validate.js";
import type { IncomingItem } from "../incoming/useIncoming.js";
import { COLORS } from "../theme.js";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ready"; info: VideoInfo }
  | { kind: "invalid"; message: string };

type HomeProps = {
  // The link to start with, e.g. when coming back from Options to change it.
  initialValue: string;
  onValid: (url: string, info: VideoInfo) => void;
  onHistory: () => void;
  onSettings: () => void;
  // Links sent from the browser: Enter opens one (once checked), x removes it.
  incoming: IncomingItem[];
  onOpenIncoming: (url: string, info: VideoInfo) => void;
  onDismissIncoming: (url: string) => void;
  // Check the starting link at once and continue to Options by itself when it passes.
  autoContinue?: boolean;
  // True while the exit prompt is open, so its keypress isn't typed into the box.
  paused: boolean;
};

const BORDER_COLORS = {
  idle: "gray",
  checking: COLORS.highlight,
  ready: COLORS.highlight,
  invalid: COLORS.error,
} as const;

// Only decides whether to start checking early. yt-dlp still decides what is a valid link.
const LOOKS_LIKE_LINK = /^https?:\/\/\S+\.\S+/i;
const PLACEHOLDER = "Paste a link and press Enter";
// A whole clipboard that is one link; anything else (several lines, plain text) is not suggested.
const CLIPBOARD_LINK = /^https?:\/\/\S+\.\S+$/i;
const CLIPBOARD_POLL_MS = 2000;
const AFTER_PASTE_MS = 100;
const AFTER_TYPING_MS = 700;

export function Home({
  initialValue,
  onValid,
  onHistory,
  onSettings,
  incoming,
  onOpenIncoming,
  onDismissIncoming,
  autoContinue = false,
  paused,
}: HomeProps) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const { columns } = useWindowSize();
  const boxWidth = Math.min(72, columns - 2);
  const [blinkOn, setBlinkOn] = useState(true);
  // Down from the input moves through the incoming links (if any) to the History button,
  // Left/Right switch to Settings, Up comes back.
  const [focus, setFocus] = useState<"input" | "incoming" | "history" | "settings">("input");
  const [selected, setSelected] = useState(0);

  // A link can leave the list while it has focus (removed, or opened from elsewhere).
  useEffect(() => {
    if (incoming.length === 0 && focus === "incoming") setFocus("input");
    else if (selected >= incoming.length) setSelected(Math.max(0, incoming.length - 1));
  }, [incoming.length]);

  const url = value.trim();
  // Read by async results, which must ignore a link the user has since changed.
  const latestUrl = useRef(url);
  latestUrl.current = url;
  const startedFor = useRef<string | null>(null);
  // Enter was pressed before the check finished: continue as soon as it passes.
  const continueWhenReady = useRef(autoContinue);
  // A command-line link is checked even if it doesn't look like a full link (e.g. no "https://").
  const forceCheck = useRef(autoContinue);
  // A link carried over from Options is checked as fast as a pasted one.
  const lastEditWasPaste = useRef(initialValue !== "");

  async function check(link: string) {
    startedFor.current = link;
    setStatus({ kind: "checking" });
    const result = await checkLink(link);
    if (latestUrl.current !== link) return;
    if (!result.valid) {
      continueWhenReady.current = false;
      setStatus({ kind: "invalid", message: result.message });
    } else if (continueWhenReady.current) {
      onValid(link, result.info);
    } else {
      setStatus({ kind: "ready", info: result.info });
    }
  }

  // Start checking shortly after a link is pasted or typed, so Enter is often instant.
  useEffect(() => {
    if (!LOOKS_LIKE_LINK.test(url) && !(forceCheck.current && url)) return;
    const timer = setTimeout(
      () => {
        if (startedFor.current !== url) void check(url);
      },
      lastEditWasPaste.current ? AFTER_PASTE_MS : AFTER_TYPING_MS,
    );
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((on) => !on), 530);
    return () => clearInterval(timer);
  }, []);

  // While the box is empty, offer a link found on the clipboard (Tab uses it). The next read
  // starts only after the last one ends, so slow PowerShell starts never pile up.
  const empty = value === "";
  const [suggestion, setSuggestion] = useState<string | null>(null);
  useEffect(() => {
    if (!empty || paused) {
      setSuggestion(null);
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const text = await readClipboard();
      if (!live) return;
      setSuggestion(text !== null && CLIPBOARD_LINK.test(text) ? text : null);
      timer = setTimeout(poll, CLIPBOARD_POLL_MS);
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [empty, paused]);

  function edit(next: (v: string) => string, pasted: boolean) {
    lastEditWasPaste.current = pasted;
    continueWhenReady.current = false;
    startedFor.current = null;
    forceCheck.current = false;
    setValue(next);
    setStatus({ kind: "idle" });
  }

  // Ink reports "\b" (Ctrl+Backspace in Windows Terminal) as a plain backspace, and VS Code
  // sends Ctrl+Backspace as "\x17". The raw key is the only place the difference shows, so
  // flag it before useInput's own listener (prepended to run first) reads the same event.
  // Not in Ink's public types, but it is what useInput itself listens to.
  const { internal_eventEmitter } = useStdin() as unknown as { internal_eventEmitter: EventEmitter };
  const blockDelete = useRef(false);
  useEffect(() => {
    if (paused) return;
    const flag = (raw: unknown) => {
      blockDelete.current = raw === "\b" || raw === "\x17";
    };
    internal_eventEmitter.prependListener("input", flag);
    return () => {
      internal_eventEmitter.removeListener("input", flag);
    };
  }, [paused, internal_eventEmitter]);

  useInput(
    (input, key) => {
      if (focus === "incoming") {
        const item = incoming[selected];
        if (key.upArrow) {
          if (selected > 0) setSelected(selected - 1);
          else setFocus("input");
        } else if (key.downArrow) {
          if (selected < incoming.length - 1) setSelected(selected + 1);
          else setFocus("history");
        } else if (key.return) {
          if (item?.state.kind === "ready") onOpenIncoming(item.link, item.state.info);
        } else if (item && (input === "x" || key.backspace || key.delete)) {
          onDismissIncoming(item.link);
        }
      } else if (focus !== "input") {
        if (key.upArrow) {
          if (incoming.length > 0) {
            setSelected(incoming.length - 1);
            setFocus("incoming");
          } else setFocus("input");
        } else if (key.leftArrow) setFocus("history");
        else if (key.rightArrow) setFocus("settings");
        else if (key.return) (focus === "history" ? onHistory : onSettings)();
      } else if (key.downArrow) {
        if (incoming.length > 0) {
          setSelected(0);
          setFocus("incoming");
        } else setFocus("history");
      } else if (key.tab) {
        // Same as pasting that link: it fills the box and starts the check.
        if (empty && suggestion) edit(() => suggestion, true);
      } else if (blockDelete.current) {
        // The last block (through the previous space), so a pasted link goes in one press.
        edit((v) => v.replace(/\S*\s*$/, ""), false);
      } else if (key.return) {
        if (!url) return;
        if (status.kind === "ready") onValid(url, status.info);
        else {
          continueWhenReady.current = true;
          if (status.kind !== "checking") void check(url);
        }
      } else if (key.backspace || key.delete) {
        edit((v) => v.slice(0, -1), false);
      } else if (input && !key.ctrl && !key.meta && !key.escape) {
        edit((v) => v + input, input.length > 1);
      }
    },
    { isActive: !paused },
  );

  // A non-breaking space when off: a plain trailing space is trimmed on wrap, which
  // would change the line count (and the box height) on every blink at the line edge.
  const cursor = blinkOn && focus === "input" ? "▌" : " ";

  return (
    <Box flexDirection="column" alignItems="center">
      <Title />
      <Text dimColor>Swiper, no snatching! Wait... that's not how that goes.</Text>
      <Box
        marginTop={1}
        width={boxWidth}
        borderStyle="round"
        borderColor={BORDER_COLORS[status.kind]}
        paddingX={1}
      >
        <Text bold color="#ffffff">{"> "}</Text>
        {/* Own box so a long link wraps under the text, not under the ">". */}
        <Box flexGrow={1}>
          {value === "" ? (
            // The cursor sits on the first letter, so the placeholder or suggestion doesn't shift.
            // A long link is cut off rather than wrapped, so the box keeps its height.
            <Text dimColor wrap="truncate-end">
              <Text inverse={cursor === "▌"}>{(suggestion ?? PLACEHOLDER)[0]}</Text>
              {(suggestion ?? PLACEHOLDER).slice(1)}
            </Text>
          ) : (
            <Text>
              {value}
              {cursor}
            </Text>
          )}
        </Box>
      </Box>
      <Box width={boxWidth} justifyContent="center">
        {status.kind === "idle" && (
          <Text dimColor>
            {focus === "input"
              ? `${empty && suggestion ? "Tab to paste from clipboard" : "Enter to continue"} · ↓ ${incoming.length > 0 ? "incoming" : "history"} · Esc to exit`
              : focus === "incoming"
                ? "Enter to open · x to remove · ↑↓ move · Esc to exit"
                : `Enter to open ${focus} · ←→ switch · ↑ back · Esc to exit`}
          </Text>
        )}
        {status.kind === "checking" && (
          <Text color={COLORS.highlight}>
            <Spinner /> Checking link…
          </Text>
        )}
        {status.kind === "ready" && (
          <Text color={COLORS.highlight} wrap="truncate-end">
            {`✓ ${status.info.title} · Enter to continue`}
          </Text>
        )}
        {status.kind === "invalid" && (
          <Text color={COLORS.error} wrap="truncate-end">{`✗ ${status.message}`}</Text>
        )}
      </Box>
      {incoming.length > 0 && (
        <IncomingList items={incoming} selected={focus === "incoming" ? selected : null} width={boxWidth} />
      )}
      <Box marginTop={1}>
        {(["history", "settings"] as const).map((target) => (
          <Box key={target} marginX={1}>
            {focus === target ? (
              <Text bold color="#000000" backgroundColor={COLORS.highlight}>
                {target === "history" ? " History " : " Settings "}
              </Text>
            ) : (
              <Text dimColor>{target === "history" ? " History " : " Settings "}</Text>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
