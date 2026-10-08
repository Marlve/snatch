import { Box, Text } from "ink";
import type { IncomingItem } from "../incoming/useIncoming.js";
import { COLORS } from "../theme.js";
import { Marker } from "./Marker.js";
import { Spinner } from "./Spinner.js";

export const VISIBLE_INCOMING = 4;

type Props = {
  items: IncomingItem[];
  // Which row has the marker; null when the list doesn't have focus.
  selected: number | null;
  width: number;
};

// Links waiting to be opened. Scrolls so the selected row stays in view.
export function IncomingList({ items, selected, width }: Props) {
  const start = Math.max(0, Math.min((selected ?? 0) - (VISIBLE_INCOMING - 1), items.length - VISIBLE_INCOMING));
  const shown = items.slice(start, start + VISIBLE_INCOMING);
  const hidden = items.length - shown.length;

  return (
    <Box flexDirection="column" width={width} marginTop={1}>
      <Text dimColor>{`Incoming (${items.length})`}</Text>
      {shown.map((item, i) => {
        const focused = selected === start + i;
        const color = focused ? COLORS.highlight : undefined;
        return (
          <Box key={item.link}>
            <Marker on={focused} />
            {item.state.kind === "checking" && (
              <Text color={color} dimColor={!focused} wrap="truncate-end">
                <Spinner /> {item.link}
              </Text>
            )}
            {item.state.kind === "ready" && (
              <Text color={color} wrap="truncate-end">
                {item.state.info.title}
              </Text>
            )}
            {item.state.kind === "invalid" && (
              <Text color={COLORS.error} wrap="truncate-end">
                {`✗ ${item.state.message}`}
              </Text>
            )}
          </Box>
        );
      })}
      {hidden > 0 && <Text dimColor>{`  +${hidden} more`}</Text>}
    </Box>
  );
}
