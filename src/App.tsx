import { useState } from "react";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { DownloadList, listRows } from "./components/DownloadList.js";
import { ExitWarning } from "./components/ExitWarning.js";
import { killAll } from "./downloader/processes.js";
import type { VideoInfo } from "./downloader/info.js";
import { isRunning, useDownloads } from "./downloader/useDownloads.js";
import { ReservedRows } from "./layout.js";
import type { Selection } from "./options/formats.js";
import { estimateBytes } from "./options/size.js";
import { History } from "./screens/History.js";
import { Home } from "./screens/Home.js";
import { Options } from "./screens/Options.js";
import { Settings } from "./screens/Settings.js";

type Screen = { name: "home" } | { name: "history" } | { name: "settings" } | { name: "options"; url: string; info: VideoInfo };

type AppProps = {
  // A link given on the command line (`snatch <link>`): Home checks it and moves on by itself.
  startLink?: string;
};

export function App({ startLink }: AppProps) {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [confirmingExit, setConfirmingExit] = useState(false);
  // The last link sent to Options, so Esc there can bring it back to Home for editing.
  const [link, setLink] = useState(startLink ?? "");
  // Only the first visit to Home follows the command-line link on its own; coming back with Esc waits for Enter.
  const [autoContinue, setAutoContinue] = useState(startLink !== undefined);
  const { downloads, start, clearFinished } = useDownloads();

  const running = downloads.filter(isRunning);
  // With downloads running, the exit prompt is a full panel instead of one line.
  const warning = confirmingExit && running.length > 0;
  const listWidth = Math.min(72, columns - 2);
  const reserved = warning ? 0 : listRows(downloads);

  // Every page change drops the finished downloads from the list; running ones stay.
  function go(next: Screen) {
    clearFinished();
    setAutoContinue(false);
    setScreen(next);
  }

  // The download starts here, not inside a screen, so it doesn't depend on which screen is showing.
  function begin(url: string, info: VideoInfo, selection: Selection) {
    setLink("");
    go({ name: "home" });
    start(url, selection, {
      site: info.site,
      estimatedBytes: estimateBytes(info, selection.format, selection.quality),
    });
  }

  // Ctrl+C is disabled in index.tsx. Esc on Options or History goes back to Home (Settings handles
  // its own Esc, since its editor closes first); elsewhere Esc twice exits.
  useInput((_input, key) => {
    if (!confirmingExit) {
      if (key.escape) {
        if (screen.name === "settings") return;
        if (screen.name === "options" || screen.name === "history") go({ name: "home" });
        else setConfirmingExit(true);
      }
    } else if (key.escape) {
      killAll();
      exit();
    } else {
      setConfirmingExit(false);
    }
  });

  return (
    // Fills the terminal; the screen sits in the middle, the downloads list under it, and the
    // exit prompt gets the bottom row.
    <ReservedRows.Provider value={reserved}>
      <Box flexDirection="column" width={columns} height={rows}>
        <Box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
          {/* Hidden, not unmounted, while the warning shows, so typed text isn't lost. */}
          {/* No shrinking: a too-short terminal would squash the screen, and it stayed squashed after growing back. */}
          <Box
            flexShrink={0}
            flexDirection="column"
            alignItems="center"
            display={warning ? "none" : "flex"}
          >
            {screen.name === "home" && (
              <Home
                initialValue={link}
                autoContinue={autoContinue}
                paused={confirmingExit}
                onHistory={() => go({ name: "history" })}
                onSettings={() => go({ name: "settings" })}
                onValid={(url, info) => {
                  setLink(url);
                  go({ name: "options", url, info });
                }}
              />
            )}
            {screen.name === "options" && (
              <Options
                info={screen.info}
                paused={confirmingExit}
                onConfirm={(selection) => begin(screen.url, screen.info, selection)}
              />
            )}
            {screen.name === "history" && <History paused={confirmingExit} />}
            {screen.name === "settings" && (
              <Settings paused={confirmingExit} onBack={() => go({ name: "home" })} />
            )}
          </Box>
          {warning && <ExitWarning running={running} width={Math.min(64, columns - 2)} />}
        </Box>
        {!warning && (
          <Box justifyContent="center">
            <DownloadList downloads={downloads} width={listWidth} />
          </Box>
        )}
        <Box justifyContent="center" height={1}>
          {confirmingExit && !warning && (
            <Text color="#ffffff">Press Esc again to exit, or any other key to stay.</Text>
          )}
        </Box>
      </Box>
    </ReservedRows.Provider>
  );
}
