import { useContext, useEffect, useState } from "react";
import { Box, Text, useWindowSize } from "ink";
import { ReservedRows } from "../layout.js";
import { COLORS } from "../theme.js";

type Variant = {
  // Smallest terminal this variant is used in; the first variant that fits wins.
  minRows: number;
  minColumns: number;
  // Every row of a variant must be the same width, or centring shifts the rows apart.
  lines: string[];
  // Blue ramp with a shimmer, one entry per line; without it the whole variant is plain blue.
  shades?: string[];
  margin: number;
};

// minRows is sized for the tallest screen: Options is 21 rows with the full banner and 18
// with the compact one, plus the exit-prompt row and a spare for a wrapped title or file name.
const VARIANTS: Variant[] = [
  {
    minRows: 23,
    minColumns: 60,
    lines: [
      "  ██████  ██    ██    ████    ████████    ██████  ██    ██",
      "██        ████  ██  ██    ██     ██     ██        ██    ██",
      "  ████    ████████  ████████     ██     ██        ████████",
      "      ██  ██  ████  ██    ██     ██     ██        ██    ██",
      "██████    ██    ██  ██    ██     ██       ██████  ██    ██",
    ],
    shades: [COLORS.highlight, "#86a9dd", "#6b8ec2", "#4f719f", "#37557d"],
    margin: 1,
  },
  {
    minRows: 19,
    minColumns: 26,
    lines: ["█▀▀ █▄ █ ▄▀█ ▀█▀ █▀▀ █ █", "▀▀█ █ ▀█ █▀█  █  █▄▄ █▀█"],
    margin: 1,
  },
  { minRows: 0, minColumns: 0, lines: ["S N A T C H"], margin: 0 },
];

const TICK_MS = 50;
const SWEEP_TICKS = 42;
const CYCLE_TICKS = SWEEP_TICKS + 150;
const BAND = 8;
const SLANT = 2;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// The shimmer's brightest colour: a pale blue, so the glow stays blue instead of going white.
const GLOW = channels("#dbe8fc");

// Blends a "#rrggbb" colour toward the glow colour; amount 0 is the colour, 1 is the glow.
function lighten(hex: string, amount: number): string {
  const mixed = channels(hex).map((c, i) => Math.round(c + (GLOW[i] - c) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Splits a row into runs of one colour so Ink gets a few Text nodes, not one per column.
function shimmerRuns(line: string, base: string, row: number, centre: number) {
  const runs: { text: string; color: string }[] = [];
  [...line].forEach((ch, x) => {
    const distance = Math.abs(x + row * SLANT - centre);
    // Quarter steps keep neighbouring cells in the same run.
    const boost = Math.round(Math.max(0, 1 - distance / BAND) * 4) / 4;
    const last = runs[runs.length - 1];
    // A space has no colour of its own, so it joins the run before it.
    const color = ch === " " && last ? last.color : lighten(base, boost);
    if (last && last.color === color) last.text += ch;
    else runs.push({ text: ch, color });
  });
  return runs;
}

export function Title() {
  const { columns, rows: windowRows } = useWindowSize();
  const rows = windowRows - useContext(ReservedRows);
  const variant = VARIANTS.find((v) => rows >= v.minRows && columns >= v.minColumns) ?? VARIANTS[2];
  const shades = variant.shades;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!shades) return;
    const timer = setInterval(() => setTick((t) => (t + 1) % CYCLE_TICKS), TICK_MS);
    return () => clearInterval(timer);
  }, [shades]);

  // Starts off the left edge and ends off the right edge; after that it rests there.
  const centre = tick * 2 - BAND;

  return (
    <Box flexDirection="column" alignItems="center" marginBottom={variant.margin}>
      {variant.lines.map((line, i) => (
        <Text key={line} bold color={shades?.[i] ?? COLORS.highlight}>
          {shades
            ? shimmerRuns(line, shades[i], i, centre).map((run, j) => (
                <Text key={j} color={run.color}>
                  {run.text}
                </Text>
              ))
            : line}
        </Text>
      ))}
    </Box>
  );
}
