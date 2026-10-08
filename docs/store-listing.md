# Store listing: Snatch Link Finder

Material for the Chrome Web Store (and Edge Add-ons) and Mozilla Add-ons (addons.mozilla.org, which Zen and Firefox install from). Build the upload zips with `npm run package:extension`; they land in `build/`.

Assets in [`docs/store/`](store): `screenshot-1.png` to `screenshot-3.png` (1280x800) and `promo-tile-440x280.png`. The screenshots are the real popup rendered with sample data: the video card is a real YouTube video, and the media list in screenshot 3 uses made-up addresses.

Privacy policy URL: https://github.com/Marlve/snatch/blob/main/docs/privacy-policy.md

## Text

**Name:** Snatch Link Finder

**Short description** (Chrome limit 132 characters):
Send the video you're watching to Snatch, a keyboard-driven terminal downloader. Needs the free Snatch app.

**Category:** Productivity (Chrome) / Download Management (Mozilla)

**Description:**
Snatch Link Finder sends the video or audio on the page you're viewing to Snatch, a free terminal downloader built on yt-dlp and FFmpeg.

- Open a page with a video and click the icon to see its title and thumbnail. Pages are checked in the background, so the answer is usually ready when you click.
- Press Send to Snatch, or right-click and choose Download with Snatch. If a Snatch window is open, the link joins its Incoming list; otherwise Snatch opens with the link ready.
- For pages Snatch can't read directly, the popup lists the media files the page loaded.

Requires the Snatch app (Windows, Node 20+). Install it with `npm install -g @marlve/snatch`, then run `snatch setup` once to connect your browser. Setup steps and source: https://github.com/Marlve/snatch

Nothing is sent to the developer. The extension only talks to the Snatch app on your own computer. Download only what you're allowed to save.

## Single purpose (Chrome)

Send the video or audio on the current page to the Snatch app on the user's own computer.

## Permission justifications

| Permission | Why |
| --- | --- |
| `nativeMessaging` | The only way the extension talks to the Snatch helper on the user's computer, to look up a page and to hand a link to the Snatch app. |
| Host access to all sites (`<all_urls>`) | Pages with video can be on any site, and the background check needs to read the address of the tab being viewed and observe its media requests. No page content is read or changed. |
| `webRequest` | Reads response headers (address, type, size) of a page's media files, to list them for pages Snatch can't read and to tell that a page has media. Nothing is blocked or modified. |
| `activeTab` | Lets the popup read the current tab's address when it is opened, even when site access hasn't been granted. |
| `storage` | Keeps the found media and looked-up titles per tab in session storage, so they survive the background worker stopping. Cleared when the browser closes. |
| `contextMenus` | Adds the right-click item "Download with Snatch". |
| `notifications` | Shows the result of a right-click send ("Sent to your open Snatch window" or the error), since that path has no popup. |

No remote code is used. No data is collected by the developer.

## Data disclosures

- **Collected or sent to the developer or a third party:** nothing. The tab address and media addresses go only to the helper on the user's own computer.
- **Firefox:** the build declares `data_collection_permissions: { required: ["none"] }` and `strict_min_version` 140.0, because new Mozilla add-ons must declare data collection. This is your declaration to make: if you disagree that "none" is accurate, change it in `scripts/package-extension.mjs`.
- **Chrome Privacy practices tab:** the form asks which user data the extension "collects". The extension handles website addresses (browsing activity) but only on the user's device. Read the form's current definition of "collect" and answer accordingly; I could not confirm which box Google expects for local-only handling.

## Notes for the reviewer (paste into the test instructions box)

The extension needs the free Snatch app to do anything, because the downloading is done by that app and not in the browser. To test:

1. Install Node 20+ and run `npm install -g @marlve/snatch` (Windows).
2. Run `snatch setup`. This registers the helper for the extension; it needs no admin rights.
3. Open a page with a video, for example https://www.youtube.com/watch?v=jNQXAC9IVRw, and click the extension icon. The title and thumbnail appear after a few seconds. Press Send to Snatch; a Snatch window opens with the link.

Without step 2, the popup says to run `snatch setup`.

## Submitting

Do these in order.

1. **Publish the npm release first** (1.1.0 or later), so that `npm install -g @marlve/snatch` and `snatch setup` give store users the helper.
2. **Mozilla Add-ons** (no code change needed):
   - Sign in at addons.mozilla.org with a free account and choose Submit a New Add-on.
   - Upload `build/snatch-firefox-<version>.zip`, listed on the site.
   - Paste the text above, add the three screenshots, and set the privacy policy URL.
   - Zen users then install it from the add-on page, and it stays across restarts.
3. **Chrome Web Store:**
   - Register a developer account (a one-time fee; check the current amount in the dashboard).
   - Upload `build/snatch-chrome-<version>.zip` as a new item, fill in the store listing and Privacy practices tabs from this page, and submit. The broad host access means a slower review.
   - The store assigns a new extension ID (shown in the dashboard). **Add it to `EXTENSION_IDS` in `src/host/register.ts`**, keeping the existing development ID, bump the version, and publish a new npm release. Users then run `snatch setup` again. Until that release is out, the store version can't talk to the helper.
4. **Edge Add-ons** (optional, free): upload the same Chrome zip. It also gets its own ID, which goes into `EXTENSION_IDS` the same way.
5. **Later updates:** raise `version` in `extension/manifest.json`, run `npm run package:extension`, and upload the new zips. Stores reject an upload whose version isn't higher.

## Open points

- The `key` field is removed from both store builds on purpose; I could not find official guidance on how the Chrome store treats it.
- The name "Snatch Link Finder" is unchanged; decide on the final store name before the first upload.
- macOS has no helper yet, so the listing says Windows only.
