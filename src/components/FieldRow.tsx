import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { COLORS } from "../theme.js";
import { Marker } from "./Marker.js";

type FieldRowProps = {
  label: string;
  focused: boolean;
  // True when the value is drawn as padded pills: the label column gives up one column so
  // the pill's text lines up with the plain-text rows and only its background sticks out.
  pills?: boolean;
  children: ReactNode;
};

// One labelled row of a form: a marker and bright label when focused, a dim label otherwise.
export function FieldRow({ label, focused, pills = false, children }: FieldRowProps) {
  return (
    <Box>
      <Marker on={focused} />
      <Box width={pills ? 9 : 10} flexShrink={0}>
        <Text bold={focused} dimColor={!focused} color={focused ? COLORS.highlight : undefined}>
          {label}
        </Text>
      </Box>
      <Box flexGrow={1} flexWrap="wrap">
        {children}
      </Box>
    </Box>
  );
}
