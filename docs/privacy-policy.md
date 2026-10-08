# Privacy policy: Snatch Link Finder

Last updated: 8 October 2026

Snatch Link Finder is a browser extension that sends the video you are watching to the Snatch app on your own computer. It has no servers, no accounts and no analytics. The developer receives no data from it.

## What the extension reads

- **The address of the tab you are looking at**, so it can ask Snatch what video is there.
- **The addresses, types and sizes of media files a page loads** (video, audio and playlists), so it can list them for pages that can't be read directly.

## Where that data goes

- It goes only to **the Snatch helper on your own computer**, over the browser's native messaging channel. The helper runs [yt-dlp](https://github.com/yt-dlp/yt-dlp) to read the page, so the website you are visiting is contacted from your computer, the same as if you had pasted the link into Snatch.
- When you press **Send to Snatch**, the link goes to the Snatch app on your computer, which downloads the video to your own disk.
- The popup shows a thumbnail, which your browser loads from the website that hosts it.
- Nothing is sent to the developer or to any third party by the extension.

## What is stored

- The extension keeps the media files found on each tab, and the title and thumbnail it looked up for each page, in the browser's **session storage**. The browser deletes this when it closes. It is never written to disk by the extension and never leaves your computer.
- The Snatch app keeps its own download history and settings on your computer. That is separate from this extension and described in the [Snatch README](https://github.com/Marlve/snatch#readme).

## Permissions

The extension asks for access to all websites, web request observation, native messaging, storage, the active tab, context menus and notifications. Each is used only for the purposes above. The reasons are listed in [store-listing.md](store-listing.md).

## Changes

If this policy changes, the new version will be published here with a new date.

## Contact

Questions: open an issue at https://github.com/Marlve/snatch/issues
