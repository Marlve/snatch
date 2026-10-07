import { Box, Text } from "ink";
import { COLORS } from "../theme.js";

// The "❯ " in front of the focused row; two blank cells otherwise so rows stay aligned.
// flexShrink 0 keeps a long row from squeezing it.
export function Marker({ on }: { on: boolean }) {
  return (
    <Box flexShrink={0}>
      <Text bold color={COLORS.highlight}>
        {on ? "❯ " : "  "}
      </Text>
    </Box>
  );
}
