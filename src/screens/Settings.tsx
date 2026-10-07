import { useState } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import {
  MAX_PRESETS,
  loadPresets,
  presetLabel,
  removePreset,
  savePreset,
  type PresetKind,
} from "../presets/store.js";
import { Marker } from "../components/Marker.js";
import { COLORS } from "../theme.js";
import { PresetEditor } from "./PresetEditor.js";

type SettingsProps = {
  onBack: () => void;
  // True while the exit prompt is open, so its keypress isn't handled here.
  paused: boolean;
};

const HINT = "↑↓ select · Enter edit · Delete twice removes · Esc back";

export function Settings({ onBack, paused }: SettingsProps) {
  const { columns } = useWindowSize();
  const [presets, setPresets] = useState(loadPresets);
  const [selected, setSelected] = useState(0);
  // The preset being edited ("new" for a fresh one), or null while the list shows.
  const [editing, setEditing] = useState<string | null>(null);
  // Delete asks for a second press, since there is no undo.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canAdd = presets.length < MAX_PRESETS;
  const rowCount = presets.length + (canAdd ? 1 : 0);
  const width = Math.min(72, columns - 2);

  useInput(
    (_input, key) => {
      const onPreset = selected < presets.length;
      if (key.escape) return onBack();
      if (key.delete || key.backspace) {
        if (!onPreset) return;
        const preset = presets[selected];
        if (pendingDelete !== preset.id) {
          setPendingDelete(preset.id);
          setMessage("Press Delete again to remove this preset");
          return;
        }
        const ok = removePreset(preset.id);
        const next = loadPresets();
        setPresets(next);
        // The list is one shorter now, plus the New row when there is room.
        setSelected((s) => Math.min(s, next.length + (next.length < MAX_PRESETS ? 1 : 0) - 1));
        setPendingDelete(null);
        setMessage(ok ? null : "Couldn't remove the preset (is the disk read-only?)");
        return;
      }
      setPendingDelete(null);
      setMessage(null);
      if (key.upArrow || key.downArrow) {
        setSelected((s) => Math.min(rowCount - 1, Math.max(0, s + (key.downArrow ? 1 : -1))));
      } else if (key.return) {
        setEditing(onPreset ? presets[selected].id : "new");
      }
    },
    { isActive: !paused && editing === null },
  );

  if (editing !== null) {
    return (
      <PresetEditor
        initial={presets.find((p) => p.id === editing) ?? null}
        paused={paused}
        onCancel={() => setEditing(null)}
        onSave={(kind: PresetKind, folder: string, name: string) => {
          const error = savePreset(kind, folder, name, editing === "new" ? undefined : editing);
          if (error === null) {
            setPresets(loadPresets());
            setEditing(null);
          }
          return error;
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" width={width}>
      <Box>
        <Text bold color="#ffffff">
          Settings
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{`Presets ${presets.length}/${MAX_PRESETS} · one click on Options downloads to the folder`}</Text>
      </Box>
      {presets.map((preset, i) => {
        const focused = i === selected;
        return (
          <Box key={preset.id} flexDirection="column">
            <Box>
              <Marker on={focused} />
              <Text bold={focused} color={focused ? COLORS.highlight : undefined}>
                {presetLabel(preset)}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text dimColor wrap="truncate-middle">
                {`${preset.kind === "video" ? "Video" : "Audio"} · ${preset.folder}`}
              </Text>
            </Box>
          </Box>
        );
      })}
      {canAdd && (
        <Box marginTop={presets.length > 0 ? 1 : 0}>
          <Marker on={selected === presets.length} />
          <Text bold={selected === presets.length} color={selected === presets.length ? COLORS.highlight : undefined}>
            + New preset
          </Text>
        </Box>
      )}
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
