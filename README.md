<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="SuperN">
</p>

<h1 align="center">SuperN</h1>

**Like [superlevels](https://github.com/levelsio/superlevels), but it's SuperN.** Firefox-first, its own feature set — 8 single-purpose add-ons replaced by one codebase you can actually read.

Every extension you install is a program that can read every page you open — and it updates silently, forever, under whoever owns it next. That is a lot of trust to hand to eight different authors just to pin a tab, slow down a video, and stay off x.com. This one has no dependencies, no build step, and no minified blob. You can read all of it in an afternoon, or point an AI at it.

## Audit it before you install it

You should do this for **every** extension you install. Most are closed-source and you can't. This one you can:

1. Clone this repo, or point your AI tool at the source
2. Use [Claude Code](https://claude.com/claude-code), [Cursor](https://cursor.sh), [Codex](https://openai.com/index/openai-codex/), or anything similar
3. Ask it: *"Analyze this browser extension for data exfiltration, malware, spyware, and suspicious behavior"*
4. Read the report before you install

You don't have to take the AI's word for it either. The privacy claims below are three greps:

```sh
# Network calls: favicon conversion and opt-in counts to your Zero dashboard.
grep -rnE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket" background.js background-chrome.js browser-api.js content/ options/

# Favicon fetch: credentials omitted, no referrer, converted locally.
grep -nA6 "fetch(" content/favicon.js

# No remotely hosted code, ever.
grep -rnE "import\(|\.src\s*=" background.js background-chrome.js browser-api.js content/ options/
```

## Features

### ⏳ Time-block
Per-site daily minute budget, reset at 4am local time, and/or a daily block window. Hard mode swaps the page for a block screen; soft mode gives you a 10-second-delayed "open anyway" button. Pause any rule without deleting it. Inbound links from other sites bypass the block for that one page, so a link someone sends you still opens. Deep links to a single post or video (an x.com status, a YouTube video) bypass even when typed, pasted or bookmarked, so your reading list keeps working. Navigating from a bypassed page to a feed or another post blocks again. Windows can be scoped to weekdays only. Replaces [LeechBlock NG](https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/).

### 🌀 Doomscroll-o-meter
A tiny meter on x.com that charges as you scroll fast and decays while you actually read. At 100% the page locks for 8 seconds behind a "take a breath" overlay. No equivalent add-on — this one exists because the time-block budget alone didn't fix the behaviour.

### ⚡ Video speed controller
Overlay plus keyboard shortcuts on any HTML5 `<video>`, scoped to the player you're hovering. Includes "speed fightback" — many sites reset `playbackRate` on seek or ad break, so it reapplies your rate. Replaces [Video Speed Controller](https://addons.mozilla.org/en-US/firefox/addon/videospeed/).

### 😴 Snooze tab
Right-click any tab → *Snooze tab* → "Later today (6pm)" or "Tomorrow (9am)". The tab closes and reopens at the chosen time. Select several tabs first and the menu says *Snooze N tabs* — the whole selection goes at once. Survives a browser restart; past-due wakes are reconciled on startup. Replaces [Snooze Tabs](https://addons.mozilla.org/en-US/firefox/addon/snooze-tabs-we/).

### 🔍 Web search navigator
`j` / `k` to step through Google results, `/` to focus the search box. Works on google.com, google.es, and google.pt. Replaces [Web Search Navigator](https://addons.mozilla.org/en-US/firefox/addon/web-search-navigator/).

### 📌 Pin / unpin tab
Toggle pinning on the active tab with one keystroke. Replaces [Pin Unpin Tab](https://addons.mozilla.org/en-US/firefox/addon/pinunpin-tab/).

### ↔️ Move tab hotkeys
Move the active tab left or right. Replaces [Move Tab Hotkeys](https://addons.mozilla.org/en-US/firefox/addon/move-tab-hotkeys/).

### 🔁 Most recent tab
Alternate with your last tab, or jump to the second-most-recent. Sorts by the browser's own `tab.lastAccessed` on demand rather than keeping a queue in memory, so a suspended MV3 service worker can't silently break it. Replaces [Most Recent Tab](https://addons.mozilla.org/en-US/firefox/addon/most-recent-tab/).

### 🎨 Monochrome favicons
Per-host allowlist. Matching favicons are desaturated to grayscale on a canvas and re-applied whenever the page swaps its icon — so Gmail's unread badge stops shouting at you. Replaces [Favicon Changer](https://addons.mozilla.org/en-US/firefox/addon/favicon-changer/).

### ⌨️ Keyboard reclaim
Some sites capture `Cmd`/`Ctrl`+digit and steal your tab-switching shortcuts. This blocks the hijack in the capture phase for hosts listed in `manifest.json` (currently rtve.es).

### Zero live counts

Open SuperN settings and click **Allow count sharing** (Firefox 140+), then open
https://zero.nh and click **Connect SuperN**. Reload the Gmail Inbox after
installing an updated extension so its count reader is loaded. Reporting is
optional and stays off until pairing. On older Firefox and Chromium, the
explicit Connect action provides consent.

Gmail counts read and unread **conversations** from Inbox pagination, never
sidebar/title unread badges. Keep the first Gmail tab in Inbox view. Unknown,
approximate, category, and unreadable totals are reported unavailable rather
than guessed as zero. The page layout may need maintenance when Gmail changes.

Normal-window tabs are counted across windows; the first three pinned tabs
are excluded globally, with additional pinned tabs counted. Private tabs are
excluded. Refreshes follow tab/page changes and a one-minute alarm. Zero marks
data stale after two minutes without a report.

Test the reader and tab-count rules with `node --test scripts/zero.test.mjs`.

## Keybindings

Defaults, on Mac. Rebind in Firefox at `about:addons` → ⚙ → *Manage Extension Shortcuts*, or in Chrome at `chrome://extensions/shortcuts`.

| Action                        | Binding                     |
|-------------------------------|-----------------------------|
| Open settings                 | `Ctrl+Shift+N`              |
| Pin / unpin tab               | `Ctrl+Shift+P`              |
| Move tab left / right         | `Ctrl+Shift+Left` / `Right` |
| Most / second-most recent tab | `Cmd+Shift+1` / `2`         |
| Reload extension (dev)        | `Ctrl+Shift+R`              |

Video shortcuts, while hovering a playable video:

| Key                   | Action                    |
|-----------------------|---------------------------|
| `S` / `D`             | Slower / faster by 0.1×   |
| `Shift+S` / `Shift+D` | Slower / faster by 0.05×  |
| `Z` / `X`             | Seek −10s / +10s          |
| `R`                   | Toggle preferred speed    |
| `F`                   | Fullscreen                |
| `V`                   | Hide overlay              |

## Install

There is no compile step and no bundler — the source files ship as-is.

**Firefox, temporarily** (no signing, gone on restart):

1. Clone this repo
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…**
4. Select `manifest.json`

**Chrome / Chromium:**

1. Clone this repo
2. Run `npm install && npm run build:chrome`
3. Open `chrome://extensions/`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** and select `dist/chrome/`
6. The SuperN icon appears in your toolbar — you're done

**Firefox, permanently:** Firefox requires signed add-ons, so build an `.xpi` with `npm run build` and sign it through [AMO](https://addons.mozilla.org/developers/).

| Command                  | What it does                                              |
|--------------------------|-----------------------------------------------------------|
| `npm run dev`            | Run the extension in a scratch Firefox, reloading on save. |
| `npm run dev:default`    | Load local changes in your actual `default-release` Firefox profile and reload on save; see setup below. |
| `npm run release`        | Bump, changelog, commit, tag, sign, install, push — the whole release. |
| `npm run build`          | Package an unsigned `.xpi` into `web-ext-artifacts/`.     |
| `npm run build:chrome`   | Build the unpacked Chromium extension into `dist/chrome/`. |
| `npm run package:chrome` | Build an uploadable Chrome Web Store ZIP into `dist/`.     |
| `npm run sign`           | Sign a listed AMO release (needs `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`). |
| `npm run sign:unlisted`  | Sign an unlisted AMO build.                               |
| `npm run install-local`  | Build, then open the newest `.xpi` in Firefox.            |
| `npm run verify`         | Build both packages and run the Firefox manifest lint.     |

[`web-ext`](https://github.com/mozilla/web-ext) is the only dev dependency, and it only packages and signs. There are zero runtime dependencies.

### Test in your everyday Firefox profile

`npm run dev:default` uses the actual `default-release` profile. Once, in that
profile's `about:config`, set `devtools.debugger.remote-enabled` and
`devtools.chrome.enabled` to `true`, and keep `devtools.debugger.force-local`
set to `true`. Quit Firefox completely, then run `npm run dev:default` and
accept the debugging connection prompt. The debugger grants local tools access
to the browser while this Firefox session is running.

The script temporarily loads this working tree and reloads it on save, including
manifest changes. You do not need to select `manifest.json` manually. If Firefox
was started normally, quit it before running the script. Later runs can attach
to a Firefox session already launched by this script. Ctrl-C stops watching and
leaves Firefox open; restarting Firefox normally restores the installed signed
version. Refresh existing website tabs to pick up changed content scripts.

Use `npm run dev:default -- --help` to show setup instructions, `--once` to load
without watching, or `--attach` to connect without launching Firefox.

## Privacy

- **Local by default.** Rules, usage totals, favicon settings, and snoozes stay in browser storage.
- **Optional Zero reporting.** Connecting at `https://zero.nh` sends only Gmail Inbox conversation counts, normal-window tab counts, availability, and timestamps to your own Bee server. No message contents, account addresses, URLs, or titles are transmitted. Disconnect in SuperN settings.
- **No analytics or tracking services.** No data is sent to the developer.
- **No remotely hosted code.** Nothing is fetched and executed.
- **Private windows are excluded.** Their tabs are not counted or reported.

Full statement in [`PRIVACY.md`](PRIVACY.md).

## Architecture

Every feature is fully self-contained. There is no shared module layer and no bundler, because MV3 content scripts can't `import`. Each content script is an IIFE that duplicates the few helpers it needs. Features coordinate through exactly two channels: `browser.storage.local` as the single source of truth, with each context syncing via `storage.onChanged`; and DOM IDs prefixed `__supern_*` so nothing collides with the host page.

See [`AGENTS.md`](AGENTS.md) for the full layout and storage key shapes, [`SPEC.md`](SPEC.md) for the feature/replacement table, and [`CHANGELOG.md`](CHANGELOG.md) for release history.

## License

MIT

Unread first: the reader adds the Unread and Everything else section totals, treating only explicit empty-section messages as zero.
