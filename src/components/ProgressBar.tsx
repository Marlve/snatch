import { useEffect, useState } from "react";
import { Text } from "ink";

type ProgressBarProps = {
  // 0 to 1
  percent: number;
  // True while the work has no percentages: a block sweeps the unfilled part.
  working?: boolean;
  width: number;
  // Written in the middle of the bar: black over the filled part, white over the rest.
  label?: string;
};

type Cell = { ch: string; fg: string; bg?: string };

const WHITE = "#ffffff";
const BLACK = "#000000";

export function ProgressBar({ percent, working = false, width, label = "" }: ProgressBarProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => setFrame((f) => f + 1), 150);
    return () => clearInterval(timer);
  }, [working]);

  const filled = Math.round(percent * width);
  const rest = width - filled;
  const sweepAt = working && rest > 0 ? filled + (frame % rest) : -1;
  const labelStart = Math.floor((width - label.length) / 2);

  const cells: Cell[] = Array.from({ length: width }, (_, i) => {
    const letter = label[i - labelStart];
    if (i < filled || i === sweepAt) {
      // A space on a white background is the same as a full block.
      return { ch: letter && letter !== " " ? letter : " ", fg: BLACK, bg: WHITE };
    }
    return letter ? { ch: letter, fg: WHITE } : { ch: "░", fg: "gray" };
  });

  // One Text per run of cells with the same colours, not one per cell.
  const runs: { text: string; fg: string; bg?: string }[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.ch;
    else runs.push({ text: cell.ch, fg: cell.fg, bg: cell.bg });
  }

  return (
    <Text>
      {runs.map((run, i) => (
        <Text key={i} color={run.fg} backgroundColor={run.bg}>
          {run.text}
        </Text>
      ))}
    </Text>
  );
}
