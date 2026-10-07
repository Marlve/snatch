import { Box, Text } from "ink";
import type { DownloadUpdate } from "../downloader/types.js";
import type { DownloadEntry } from "../downloader/useDownloads.js";
import { COLORS } from "../theme.js";
import { ProgressBar } from "./ProgressBar.js";

// The most bars shown at once; the rest are counted. Ink can't scroll.
const MAX_SHOWN = 3;

// The text written on the bar. The speed is dropped when the bar is too narrow to hold it.
function barLabel({ phase, percent, speed }: DownloadUpdate, barWidth: number): string {
  if (phase === "done") return "✓ Done";
  if (phase === "processing") return "processing…";
  const label = `${Math.round(percent * 100)}%${speed ? ` · ${speed}` : ""}`;
  return label.length + 2 <= barWidth ? label : `${Math.round(percent * 100)}%`;
}

// Rows the list takes, so the app can keep the screen out of its way. 0 when it is empty.
export function listRows(downloads: DownloadEntry[]): number {
  if (downloads.length === 0) return 0;
  const hidden = downloads.length > MAX_SHOWN ? 1 : 0;
  // One blank row above the list, then a row per bar.
  return 1 + Math.min(downloads.length, MAX_SHOWN) + hidden;
}

type DownloadListProps = {
  downloads: DownloadEntry[];
  width: number;
};

// One row per download: file name, bar, and a short status. A finished or failed row
// stays until the app drops it on the next page change.
export function DownloadList({ downloads, width }: DownloadListProps) {
  if (downloads.length === 0) return null;
  const nameWidth = width < 60 ? 20 : 26;
  // The bar takes everything the name doesn't, so both edges of the list line up.
  const barWidth = Math.max(6, width - nameWidth);

  return (
    <Box marginTop={1} width={width} flexDirection="column">
      {downloads.slice(0, MAX_SHOWN).map((d) => {
        const { phase, percent, error } = d.update;
        return (
          <Box key={d.id}>
            <Box width={nameWidth} flexShrink={0} paddingRight={1}>
              <Text wrap="truncate-end">{d.file}</Text>
            </Box>
            {phase === "failed" ? (
              <Text color={COLORS.error} wrap="truncate-end">
                {`✗ ${error ?? "Download failed"}`}
              </Text>
            ) : (
              <ProgressBar
                percent={percent}
                working={phase === "processing"}
                width={barWidth}
                label={barLabel(d.update, barWidth)}
              />
            )}
          </Box>
        );
      })}
      {downloads.length > MAX_SHOWN && (
        <Text dimColor>{`+${downloads.length - MAX_SHOWN} more`}</Text>
      )}
    </Box>
  );
}
