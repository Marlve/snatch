import { Box, Text } from "ink";
import { COLORS } from "../theme.js";

type ChoicesProps = {
  items: string[];
  selected: number;
  // Whether the row holding these choices has the keyboard focus.
  focused: boolean;
};

// Choices side by side. The selected one is a filled pill while its row has focus,
// and bold white once focus has moved on; the others stay dim.
export function Choices({ items, selected, focused }: ChoicesProps) {
  return (
    <>
      {items.map((item, i) => {
        const label = ` ${item} `;
        if (i !== selected) {
          return (
            <Box key={item} marginRight={1}>
              <Text dimColor>{label}</Text>
            </Box>
          );
        }
        return (
          <Box key={item} marginRight={1}>
            {focused ? (
              <Text bold color="#000000" backgroundColor={COLORS.highlight}>
                {label}
              </Text>
            ) : (
              <Text bold color="#ffffff">
                {label}
              </Text>
            )}
          </Box>
        );
      })}
    </>
  );
}
