import { useContext, useState } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { Marker } from "../components/Marker.js";
import { revealFile } from "../history/reveal.js";
import { loadHistory, type HistoryEntry } from "../history/store.js";
import { ReservedRows } from "../layout.js";
import { formatBytes } from "../options/size.js";
import { COLORS } from "../theme.js";

type HistoryProps = {
  // True while the exit prompt is open, so its keypress isn't handled here.
  paused: boolean;
};

const HINT = "↑↓ select · Enter show in folder · Esc back";

// Rows around the list: heading and its gap, the gap and hint under the list, the message
// line, and the app's exit-prompt row.
const FIXED_ROWS = 6;
const ROWS_PER_ENTRY = 2;

// What Enter says for a row with no file to show.
const NO_FILE: Partial<Record<HistoryEntry["status"], string>> = {
  running: "Still downloading, there's no file yet",
  failed: "No file: the download failed",
  interrupted: "No file: the download didn't finish",
};

function status(e: HistoryEntry): { text: string; color?: string; dim: boolean } {
  const site = e.site ?? "";
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  switch (e.status) {
    case "done":
      return { text: join(e.bytes === null ? "" : formatBytes(e.bytes), site), dim: true };
    case "running":
      return { text: join("downloading…", site), color: "#ffffff", dim: false };
    case "failed":
      return { text: join("✗ failed", site), color: COLORS.error, dim: false };
    default:
      return { text: join("interrupted", site), dim: true };
  }
}

export function History({ paused }: HistoryProps) {
  const { columns, rows } = useWindowSize();
  const reserved = useContext(ReservedRows);
  // Read once: the file only changes when a download starts or ends, and those rows show
  // their state from when the page opened.
  const [entries] = useState(loadHistory);
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  // Ink can't scroll, so show as many entries as fit and slide the window with the selection.
  const perPage = Math.max(1, Math.floor((rows - reserved - FIXED_ROWS) / ROWS_PER_ENTRY));
  const top = Math.max(0, Math.min(selected - Math.floor(perPage / 2), entries.length - perPage));
  const visible = entries.slice(top, top + perPage);
  const width = Math.min(72, columns - 2);

  useInput(
    (_input, key) => {
      if (key.upArrow || key.downArrow) {
        setMessage(null);
        setSelected((s) => Math.min(entries.length - 1, Math.max(0, s + (key.downArrow ? 1 : -1))));
      } else if (key.return && entries.length > 0) {
        const entry = entries[selected];
        if (entry.status === "done") {
          setMessage(revealFile(entry) ? null : "File not found, it may have been moved");
        } else {
          setMessage(NO_FILE[entry.status] ?? null);
        }
      }
    },
    { isActive: !paused },
  );

  return (
    <Box flexDirection="column" width={width}>
      <Box marginBottom={1}>
        <Text bold color="#ffffff">
          History
        </Text>
        <Text dimColor>{entries.length > 0 ? `  ${selected + 1}/${entries.length}` : ""}</Text>
      </Box>
      {entries.length === 0 && <Text dimColor>No downloads yet</Text>}
      {visible.map((entry, i) => {
        const focused = top + i === selected;
        const s = status(entry);
        return (
          <Box key={entry.id} flexDirection="column">
            <Box>
              <Marker on={focused} />
              <Box flexGrow={1} flexShrink={1}>
                <Text bold={focused} color={focused ? COLORS.highlight : undefined} wrap="truncate-end">
                  {entry.file}
                </Text>
              </Box>
              <Box flexShrink={0} marginLeft={2}>
                <Text color={s.color} dimColor={s.dim}>
                  {s.text}
                </Text>
              </Box>
            </Box>
            <Box marginLeft={2}>
              <Text dimColor wrap="truncate-middle">
                {entry.folder}
              </Text>
            </Box>
          </Box>
        );
      })}
      <Box marginTop={1} height={1}>
        {message !== null && <Text color={COLORS.error}>{message}</Text>}
      </Box>
      <Text>
        {HINT.split(/([←→↑↓]+)/).map((part, i) => (
          <Text key={i} color={i % 2 === 1 ? "#ffffff" : undefined} dimColor={i % 2 === 0}>
            {part}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
