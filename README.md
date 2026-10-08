# snatch

Download video or audio from almost any site, from your terminal. Keyboard only, for Windows and macOS.

Inspired by [yoinks](https://github.com/pablostanley/yoinks). Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org).

<p align="center">
  <img src="https://raw.githubusercontent.com/Marlve/snatch/main/docs/screenshots/home.png" alt="snatch home screen with a clipboard suggestion" width="720">
</p>

## Install

You need Node 20+.

```sh
npm install -g @marlve/snatch
```

Or run it once without installing:

```sh
npx @marlve/snatch
```

To update, install the latest version again. If you use the browser extension, run `snatch setup` afterwards too, because a release can change how the browser helper is registered:

```sh
npm install -g @marlve/snatch@latest
snatch setup
```

snatch needs yt-dlp and FFmpeg. On launch it checks for both, and if one is missing it offers to install it with winget on Windows or [Homebrew](https://brew.sh) on a Mac. To install them yourself:

```sh
winget install yt-dlp.yt-dlp yt-dlp.FFmpeg   # Windows
brew install yt-dlp ffmpeg                   # macOS
```

## Usage

```sh
snatch                # paste a link on the home screen
snatch <link>         # check the link and go straight to the options
snatch setup          # add a Start Menu shortcut (Windows) or Snatch.app in ~/Applications (macOS),
                      # and connect the browser extension (Windows)
```

Run `snatch setup` from a global install, not from `npx`, so the shortcut points at a copy that stays.

- If your clipboard holds a link, it shows as a suggestion in the empty box. Press `Tab` to use it.
- **Video** saves as MP4, **audio** as M4A. Both use the site's own streams, so nothing is re-encoded.
- **Presets** (Settings) are one-click downloads: a type, a folder and an optional name. Up to 5.
- **History** lists your last 50 downloads and can show a file in Explorer or Finder.
- Everything else saves to your Downloads folder.
- `Esc` goes back. On the home screen, `Esc` twice quits.

## Browser extension

The extension in [`extension/`](extension) sends the video you're watching to snatch. It works on Windows with Chrome, Edge and Zen. Firefox uses the same mechanism but is untested.

1. Install snatch and run `snatch setup` (see above). This registers a small helper that the browser starts on its own, with no window.
2. Load the extension from the `extension` folder of a clone of this repo:
   - Chrome or Edge: open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick the folder.
   - Zen or Firefox: open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on** and pick `manifest.json`. Temporary add-ons are removed when the browser closes. Then open `about:addons`, select the extension and, under **Permissions**, allow access to all websites, which is what lets it check pages in the background.
3. Open a page with a video and click the snatch icon. It shows the video's thumbnail and title. Each page you look at is checked in the background a moment after it loads, so the answer is usually ready by the time you click. If it isn't, the popup checks then, which takes a few seconds.
4. Press **Send to Snatch**, or right-click and choose **Download with Snatch**.

If a snatch window is already open, the link lands in its **Incoming** list on the home screen, and no new window appears. Press `↓` to reach the list, `Enter` to open a link, `x` to remove it. A link stays in the list until you download it or remove it, so `Esc` from the Options screen keeps it. If no window is open, one starts with the link already checked. You still pick the format on the Options screen.

For pages yt-dlp can't read, the popup lists the media files the page loaded instead. Nothing leaves your computer: the helper only runs yt-dlp, which fetches the page from your machine. See the [privacy policy](docs/privacy-policy.md).

## Screenshots

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Marlve/snatch/main/docs/screenshots/options.png" alt="Options: preset, format, quality, file name and size estimate"><br><sub>Options</sub></td>
    <td><img src="https://raw.githubusercontent.com/Marlve/snatch/main/docs/screenshots/downloading.png" alt="A download in progress under the home screen"><br><sub>Download in progress</sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/Marlve/snatch/main/docs/screenshots/history.png" alt="History of finished and failed downloads"><br><sub>History</sub></td>
    <td><img src="https://raw.githubusercontent.com/Marlve/snatch/main/docs/screenshots/settings.png" alt="Settings with saved presets"><br><sub>Settings</sub></td>
  </tr>
</table>

## Development

```sh
npm install
npm run dev -- <link>   # run from source
npm run typecheck
npm run build           # compile to dist/
npm run package:extension   # zip the extension for the Chrome and Firefox stores into build/
```

## Notes

- Windows and macOS only. macOS support is new, so please open an issue if something misbehaves. The first time you open `Snatch.app`, macOS asks once to let it control Terminal.
- The browser extension and its helper are Windows only for now. `snatch setup` writes a few per-user registry entries for them and needs no admin rights.
- DRM-protected sites (Spotify and similar) are refused by yt-dlp on purpose.

## Fair use

snatch is meant for personal use, like keeping an offline copy of something you're allowed to watch. Be kind to creators, don't redistribute what you download, and remember that what you save is up to you.

## License

[MIT](LICENSE)
