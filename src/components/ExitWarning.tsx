import { Box, Text } from "ink";
import type { DownloadEntry } from "../downloader/useDownloads.js";

const MAX_SHOWN = 5;

type ExitWarningProps = {
  // The downloads that are still running.
  running: DownloadEntry[];
  width: number;
};

// Shown in place of the screen when Esc is pressed while downloads are still running.
export function ExitWarning({ running, width }: ExitWarningProps) {
  const count = running.length;
  return (
    <Box
      width={width}
      flexDirection="column"
      borderStyle="round"
      borderColor="#ffffff"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="#ffffff">
        {count === 1 ? "A download is still running" : `${count} downloads are still running`}
      </Text>
      <Text dimColor>Quitting now stops them.</Text>
      <Box marginTop={1} flexDirection="column">
        {running.slice(0, MAX_SHOWN).map((d) => (
          <Box key={d.id} justifyContent="space-between">
            <Box flexShrink={1}>
              <Text wrap="truncate-end">{d.file}</Text>
            </Box>
            <Box flexShrink={0} marginLeft={2}>
              <Text dimColor>{`${Math.round(d.update.percent * 100)}%`}</Text>
            </Box>
          </Box>
        ))}
        {count > MAX_SHOWN && <Text dimColor>{`+${count - MAX_SHOWN} more`}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text color="#ffffff">Esc again to quit and stop them · any other key to stay</Text>
      </Box>
    </Box>
  );
}
