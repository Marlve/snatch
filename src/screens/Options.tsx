import { useState } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { Choices } from "../components/Choices.js";
import { FieldRow } from "../components/FieldRow.js";
import { Title } from "../components/Title.js";
import type { VideoInfo } from "../downloader/info.js";
import {
  ILLEGAL_HINT,
  MAX_NAME_LENGTH,
  isIllegalChar,
  sanitizeFilename,
} from "../options/filename.js";
import { availableFormats, qualitiesFor, type Format, type Selection } from "../options/formats.js";
import { estimateBytes, formatBytes } from "../options/size.js";
import { loadPresets, presetLabel } from "../presets/store.js";
import { COLORS } from "../theme.js";

type Focus = "preset" | "format" | "quality" | "name" | "download";

type OptionsProps = {
  info: VideoInfo;
  onConfirm: (selection: Selection) => void;
  // True while the exit prompt is open, so its keypress isn't handled here.
  paused: boolean;
};

const HINTS: Record<Focus, string> = {
  preset: "←→ choose · Enter download now · ↓ next · Esc change link",
  format: "←→ change · Enter or ↓ next · Esc change link",
  quality: "←→ change · ↑ back · Enter or ↓ next · Esc change link",
  name: "type to rename · ↑ back · Enter or ↓ next · Esc change link",
  download: "Enter download · ↑ back · Esc change link",
};

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

export function Options({ info, onConfirm, paused }: OptionsProps) {
  const { columns } = useWindowSize();
  const [formatIndex, setFormatIndex] = useState(0);
  const [qualityIndex, setQualityIndex] = useState(0);
  // Starts as the video's title; the "Save as" input edits it.
  const defaultName = sanitizeFilename(info.title);
  // Text and cursor change together, so a fast burst of keys never edits at a stale position.
  const [edit, setEdit] = useState({ text: defaultName, cursor: defaultName.length });
  const name = edit.text;
  const [badChar, setBadChar] = useState(false);

  const formats = availableFormats(info);
  const format = formats[formatIndex];
  // Only the presets this link can satisfy: a video preset needs a video, an audio one needs an m4a stream.
  const [savedPresets] = useState(loadPresets);
  const presets = savedPresets.filter((p) => formats.some((f) => f.kind === p.kind));
  // With a preset available the page opens on it, so one Enter downloads.
  const [focus, setFocus] = useState<Focus>(presets.length > 0 ? "preset" : "format");
  const [presetIndex, setPresetIndex] = useState(0);
  const qualities = qualitiesFor(format, info);
  const hasQualities = qualities.length > 0;
  const quality = hasQualities ? qualities[qualityIndex] : null;
  // Audio formats have no quality row to stop on.
  const order: Focus[] = [
    ...(presets.length > 0 ? (["preset"] as const) : []),
    "format",
    ...(hasQualities ? (["quality"] as const) : []),
    "name",
    "download",
  ];

  // A preset is a one-click download: its format at the best quality, in its folder.
  function startPreset() {
    const preset = presets[presetIndex];
    const presetFormat = formats.find((f) => f.kind === preset.kind)!;
    onConfirm({
      format: presetFormat,
      quality: qualitiesFor(presetFormat, info)[0] ?? null,
      filename: sanitizeFilename(name.trim() === "" ? defaultName : name),
      folder: preset.folder,
    });
  }

  function step(delta: number) {
    setBadChar(false);
    setFocus((f) => order[clamp(order.indexOf(f) + delta, order.length - 1)]);
  }

  useInput(
    (input, key) => {
      const horizontal = key.rightArrow ? 1 : key.leftArrow ? -1 : 0;

      if (key.upArrow) step(-1);
      else if (key.downArrow) step(1);
      else if (focus === "name") {
        if (key.return) step(1);
        else if (horizontal) {
          setEdit((e) => ({ ...e, cursor: clamp(e.cursor + horizontal, e.text.length) }));
        } else if (key.backspace || key.delete) {
          setBadChar(false);
          setEdit((e) =>
            e.cursor === 0
              ? e
              : { text: e.text.slice(0, e.cursor - 1) + e.text.slice(e.cursor), cursor: e.cursor - 1 },
          );
        } else if (input && !key.ctrl && !key.meta && !key.escape && !key.tab) {
          const typed = [...input].filter((c) => !isIllegalChar(c)).join("");
          setBadChar(typed.length !== input.length);
          if (typed) {
            setEdit((e) => {
              const text = (e.text.slice(0, e.cursor) + typed + e.text.slice(e.cursor)).slice(
                0,
                MAX_NAME_LENGTH,
              );
              return { text, cursor: Math.min(e.cursor + typed.length, text.length) };
            });
          }
        }
      } else if (focus === "preset") {
        if (horizontal) setPresetIndex((i) => clamp(i + horizontal, presets.length - 1));
        else if (key.return) startPreset();
      } else if (focus === "download") {
        // A name cleared out entirely falls back to the title.
        if (key.return) {
          onConfirm({
            format,
            quality,
            filename: sanitizeFilename(name.trim() === "" ? defaultName : name),
          });
        }
      } else if (key.return) step(1);
      else if (horizontal && focus === "format") {
        setFormatIndex((i) => clamp(i + horizontal, formats.length - 1));
      } else if (horizontal && focus === "quality") {
        setQualityIndex((i) => clamp(i + horizontal, qualities.length - 1));
      }
    },
    { isActive: !paused },
  );

  const formWidth = Math.min(72, columns - 2);
  const editing = focus === "name";
  // While typing, non-breaking spaces make a long name wrap at the box edge like a
  // text field. Otherwise it wraps at word gaps, which reads better.
  const shownName = editing ? name.replaceAll(" ", " ") : name;
  const meta = [info.site, info.uploader, info.duration === null ? null : formatDuration(info.duration)]
    .filter(Boolean)
    .join(" · ");
  const bytes = estimateBytes(info, format, quality);

  return (
    <Box flexDirection="column" alignItems="center">
      <Title />
      <Box
        width={formWidth}
        flexDirection="column"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        <Text bold color="#ffffff">
          {info.title}
        </Text>
        {meta !== "" && <Text dimColor>{meta}</Text>}
      </Box>
      <Box marginTop={1} width={formWidth} flexDirection="column">
        <FieldRow label="Preset" focused={focus === "preset"} pills={presets.length > 0}>
          {presets.length > 0 ? (
            // Nothing is "selected" until the row has focus: Enter acts on the highlighted one at once.
            <Choices
              items={presets.map(presetLabel)}
              selected={focus === "preset" ? presetIndex : -1}
              focused={focus === "preset"}
            />
          ) : (
            <Text dimColor>No presets for this link · add one in Settings</Text>
          )}
        </FieldRow>
        <FieldRow label="Format" focused={focus === "format"} pills>
          <Choices
            items={formats.map((f) => `${f.label} · ${f.kind}`)}
            selected={formatIndex}
            focused={focus === "format"}
          />
        </FieldRow>
        <FieldRow label="Quality" focused={focus === "quality"} pills={hasQualities}>
          {hasQualities ? (
            <Choices items={qualities} selected={qualityIndex} focused={focus === "quality"} />
          ) : (
            <Text dimColor>{format.qualityNote}</Text>
          )}
        </FieldRow>
        <FieldRow label="Save as" focused={editing}>
          <Text>
            {name === "" ? (
              <>
                {/* The cursor sits on the first letter, so the default name doesn't shift. */}
                {editing && <Text inverse>{defaultName[0] ?? " "}</Text>}
                <Text dimColor>{editing ? defaultName.slice(1) : defaultName}</Text>
              </>
            ) : editing ? (
              <>
                {shownName.slice(0, edit.cursor)}
                <Text inverse>{shownName[edit.cursor] ?? " "}</Text>
                {shownName.slice(edit.cursor + 1)}
              </>
            ) : (
              name
            )}
            <Text dimColor>.{format.id}</Text>
          </Text>
        </FieldRow>
        {/* The button is a pill like the choices: its text lines up with the values above
            (2 for the marker + 10 for the label), so its background starts one column earlier. */}
        <Box marginTop={1} marginLeft={11}>
          {focus === "download" ? (
            <Text bold color="#000000" backgroundColor={COLORS.highlight}>
              {" Download "}
            </Text>
          ) : (
            <Text>{" Download "}</Text>
          )}
          <Text dimColor>{bytes === null ? "  size unknown" : `  ≈ ${formatBytes(bytes)}`}</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        {badChar ? (
          <Text color={COLORS.error}>{`✗ A file name can't contain ${ILLEGAL_HINT}`}</Text>
        ) : (
          <Text>
            {(focus === "format" && presets.length > 0
              ? "←→ change · Enter or ↓ next · ↑ presets · Esc change link"
              : HINTS[focus]
            ).split(/([←→↑↓]+)/).map((part, i) => (
              <Text key={i} color={i % 2 === 1 ? "#ffffff" : undefined} dimColor={i % 2 === 0}>
                {part}
              </Text>
            ))}
          </Text>
        )}
      </Box>
    </Box>
  );
}
