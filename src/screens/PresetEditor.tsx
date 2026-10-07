import { basename, dirname } from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useWindowSize } from "ink";
import { Choices } from "../components/Choices.js";
import { FieldRow } from "../components/FieldRow.js";
import { Marker } from "../components/Marker.js";
import { EMPTY, TextField, editText, textOf } from "../components/TextField.js";
import {
  USUAL_FOLDERS,
  existingFolder,
  knownFolders,
  scanFolders,
  searchFolders,
  type KnownFolder,
} from "../presets/folders.js";
import { MAX_NAME_LENGTH, defaultLabel, type Preset, type PresetKind } from "../presets/store.js";
import { COLORS } from "../theme.js";

type Focus = "type" | "folder" | "search" | "results" | "name" | "save";

type PresetEditorProps = {
  // The preset being edited, or null for a new one.
  initial: Preset | null;
  // Saves the preset; returns an error message, or null when it worked.
  onSave: (kind: PresetKind, folder: string, name: string) => string | null;
  onCancel: () => void;
  paused: boolean;
};

const KINDS: PresetKind[] = ["video", "audio"];
const FOLDER_ITEMS = [...USUAL_FOLDERS.map((f) => f.label), "Custom…"];
const CUSTOM = 3;
const MAX_RESULTS = 6;
// Rows the page uses besides the search results, so a short terminal shows fewer results.
const ROWS_WITHOUT_RESULTS = 18;

const HINTS: Record<Focus, string> = {
  type: "←→ change · Enter or ↓ next · Esc cancel",
  folder: "←→ change · Enter or ↓ next · ↑ back · Esc cancel",
  search: "type to search · ←→ move · Enter confirm · ↑ back · Esc cancel",
  results: "↑↓ choose · Enter pick · Esc cancel",
  name: "type to rename · ←→ move · Enter or ↓ next · ↑ back · Esc cancel",
  save: "Enter save · ↑ back · Esc cancel",
};

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

export function PresetEditor({ initial, onSave, onCancel, paused }: PresetEditorProps) {
  const { columns, rows } = useWindowSize();
  const [focus, setFocus] = useState<Focus>("type");
  const [kindIndex, setKindIndex] = useState(initial ? KINDS.indexOf(initial.kind) : 0);
  const [known, setKnown] = useState<KnownFolder[]>(USUAL_FOLDERS);
  const [folderIndex, setFolderIndex] = useState(() => {
    if (!initial) return 0;
    const i = USUAL_FOLDERS.findIndex((f) => f.path.toLowerCase() === initial.folder.toLowerCase());
    return i === -1 ? CUSTOM : i;
  });
  // The custom folder: typed into the search box, then picked from the results or confirmed as a path.
  const [query, setQuery] = useState(EMPTY);
  const [chosen, setChosen] = useState<string | null>(
    initial && !USUAL_FOLDERS.some((f) => f.path.toLowerCase() === initial.folder.toLowerCase()) ? initial.folder : null,
  );
  const [allFolders, setAllFolders] = useState<string[] | null>(null);
  const [resultIndex, setResultIndex] = useState(0);
  const [name, setName] = useState(textOf(initial?.name ?? ""));
  const [message, setMessage] = useState<string | null>(null);
  const scanStarted = useRef(false);

  // Ask Windows where Music and Videos really are (they can be moved).
  useEffect(() => {
    let live = true;
    void knownFolders().then((folders) => {
      if (!live) return;
      setKnown(folders);
      // An edited preset that points at the real Music or Videos folder is not a custom one.
      const i = initial ? folders.findIndex((f) => f.path.toLowerCase() === initial.folder.toLowerCase()) : -1;
      if (i !== -1) {
        setFolderIndex(i);
        setChosen(null);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const custom = folderIndex === CUSTOM;
  // The scan starts the first time Custom is shown, not when the page opens.
  useEffect(() => {
    if (!custom || scanStarted.current) return;
    scanStarted.current = true;
    void scanFolders().then(setAllFolders);
  }, [custom]);

  const maxResults = Math.max(1, Math.min(MAX_RESULTS, rows - ROWS_WITHOUT_RESULTS));
  const results = useMemo(
    () => (allFolders ? searchFolders(allFolders, query.text, maxResults) : []),
    [allFolders, query.text, maxResults],
  );
  const folder = custom ? chosen : known[folderIndex].path;

  // Enter in the search box: a typed path that exists, else the top result.
  async function confirmCustom() {
    const typed = await existingFolder(query.text);
    const pick = typed ?? results[0] ?? null;
    if (pick === null) {
      setMessage(query.text.trim() === "" ? "Type a folder name" : "No folder found");
      return;
    }
    setChosen(pick);
    setFocus("name");
  }

  useInput(
    (input, key) => {
      if (key.escape) return onCancel();
      const horizontal = key.rightArrow ? 1 : key.leftArrow ? -1 : 0;

      if (focus === "type") {
        if (horizontal) setKindIndex((i) => clamp(i + horizontal, KINDS.length - 1));
        else if (key.return || key.downArrow) setFocus("folder");
      } else if (focus === "folder") {
        if (horizontal) {
          setFolderIndex((i) => clamp(i + horizontal, CUSTOM));
          setMessage(null);
        } else if (key.upArrow) setFocus("type");
        else if (key.downArrow || key.return) setFocus(custom ? "search" : "name");
      } else if (focus === "search") {
        if (key.upArrow) setFocus("folder");
        else if (key.downArrow) setFocus(results.length > 0 ? "results" : "name");
        else if (key.return) void confirmCustom();
        else {
          const next = editText(query, input, key);
          if (next !== query) {
            setQuery(next);
            if (next.text !== query.text) {
              setChosen(null);
              setResultIndex(0);
              setMessage(null);
            }
          }
        }
      } else if (focus === "results") {
        if (key.upArrow) {
          if (resultIndex === 0) setFocus("search");
          else setResultIndex(resultIndex - 1);
        } else if (key.downArrow) {
          if (resultIndex >= results.length - 1) setFocus("name");
          else setResultIndex(resultIndex + 1);
        } else if (key.return) {
          setChosen(results[resultIndex]);
          setFocus("name");
        }
      } else if (focus === "name") {
        if (key.upArrow) setFocus(custom ? "search" : "folder");
        else if (key.downArrow || key.return) setFocus("save");
        else setName((n) => editText(n, input, key, MAX_NAME_LENGTH));
      } else if (key.upArrow) setFocus("name");
      else if (key.return) {
        if (folder === null) return setMessage("Choose a folder first");
        setMessage(onSave(KINDS[kindIndex], folder, name.text));
      }
    },
    { isActive: !paused },
  );

  const width = Math.min(72, columns - 2);
  const folderFocused = focus === "folder" || focus === "search" || focus === "results";

  return (
    <Box flexDirection="column" width={width}>
      <Box marginBottom={1}>
        <Text bold color="#ffffff">
          {initial ? "Edit preset" : "New preset"}
        </Text>
      </Box>
      <FieldRow label="Type" focused={focus === "type"} pills>
        <Choices items={["Video", "Audio"]} selected={kindIndex} focused={focus === "type"} />
      </FieldRow>
      <Box marginTop={1} flexDirection="column">
        <FieldRow label="Folder" focused={folderFocused} pills>
          <Choices items={FOLDER_ITEMS} selected={folderIndex} focused={folderFocused} />
        </FieldRow>
        {/* 12 = the marker (2) + the label column (10): plain text lines up with the pills' text. */}
        <Box marginLeft={12} flexDirection="column">
          {!custom && (
            <Text dimColor wrap="truncate-middle">
              {known[folderIndex].path}
            </Text>
          )}
          {custom && (
            <>
              <TextField
                value={query}
                focused={focus === "search"}
                placeholder="Type a folder name"
              />
              {/* The results and the status line below them always take the same number of rows,
                  however many folders match, so the page doesn't jump while you type. */}
              <Box flexDirection="column" height={maxResults}>
                {results.map((path, i) => {
                  const picked = focus === "results" && i === resultIndex;
                  return (
                    <Box key={path}>
                      <Marker on={picked} />
                      <Box flexShrink={0}>
                        <Text bold={picked} color={picked ? COLORS.highlight : undefined}>
                          {basename(path)}
                        </Text>
                      </Box>
                      <Box flexShrink={1} marginLeft={2}>
                        <Text dimColor wrap="truncate-start">
                          {dirname(path)}
                        </Text>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box height={1}>
                {chosen !== null ? (
                  <Text wrap="truncate-middle">{`✓ ${chosen}`}</Text>
                ) : query.text === "" ? null : allFolders === null ? (
                  <Text dimColor>Searching…</Text>
                ) : results.length === 0 ? (
                  <Text dimColor>No folder matches</Text>
                ) : null}
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <FieldRow label="Name" focused={focus === "name"}>
          <TextField
            value={name}
            focused={focus === "name"}
            placeholder={defaultLabel({ kind: KINDS[kindIndex], folder: folder ?? "…" })}
          />
        </FieldRow>
      </Box>
      <Box marginTop={1} marginLeft={11}>
        {focus === "save" ? (
          <Text bold color="#000000" backgroundColor={COLORS.highlight}>
            {" Save "}
          </Text>
        ) : (
          <Text>{" Save "}</Text>
        )}
      </Box>
      <Box marginTop={1} height={1}>
        {message !== null && <Text color={COLORS.error}>{message}</Text>}
      </Box>
      <Text>
        {HINTS[focus].split(/([←→↑↓]+)/).map((part, i) => (
          <Text key={i} color={i % 2 === 1 ? "#ffffff" : undefined} dimColor={i % 2 === 0}>
            {part}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
