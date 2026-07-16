# SuperN

One small, dependency-free **Firefox and Chromium** extension (Manifest V3) that replaces a
pile of single-purpose add-ons with one auditable codebase — fewer third parties
reading my tabs, fewer shortcuts to reconfigure on a clean install.

Inspired by [levelsio/superlevels](https://github.com/levelsio/superlevels); a
separate, Firefox-first take with its own feature set.

> Personal project, shared in case it's useful. Firefox and Chromium builds
> ship from the same auditable source tree.

## Features

| Feature                    | What it does                                                                                                                                                                                                                                |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Pin / unpin tab**        | Toggle pinning on the active tab.                                                                                                                                                                                                           |
| **Move tab hotkeys**       | Move the active tab left / right.                                                                                                                                                                                                           |
| **Most recent tab**        | Jump to the most recent tab (per-window alternation), or the second-most-recent.                                                                                                                                                            |
| **Snooze tab**             | Right-click a tab → *Snooze tab* → "Later today" or "Tomorrow". Survives a browser restart.                                                                                                                                                 |
| **Web search navigator**   | `j` / `k` to step through Google results, `/` to focus the search box (google.com / .es / .pt).                                                                                                                                             |
| **Video speed controller** | Overlay + page-level shortcuts on any HTML5 `<video>`. Includes "speed fightback" against sites that reset the rate.                                                                                                                        |
| **Time-block**             | Per-site daily minute budget (reset at 4am local) and/or a daily block window, in hard or soft (10s-delayed "open anyway") mode. Inbound links from other sites bypass the block for that tab. Optional weekdays-only scope for the window. |
| **Monochrome favicons**    | Per-host allowlist; matching favicons are desaturated to grayscale, re-applied when the page swaps its icon (e.g. Gmail's unread badge).                                                                                                    |
| **Doomscroll-o-meter**     | A tiny meter on x.com that charges as you scroll fast and decays while you read; at 100% the page locks briefly behind a "take a breath" overlay.                                                                                           |

See [`SPEC.md`](SPEC.md) for the add-ons each feature replaces, and
[`CHANGELOG.md`](CHANGELOG.md) for release history.

## Keybindings

Defaults (Mac). Rebind via `about:addons` → ⚙ → *Manage Extension Shortcuts*.

| Action                        | Binding                     |
|-------------------------------|-----------------------------|
| Open settings                 | `Ctrl+Shift+N`              |
| Pin / unpin tab               | `Ctrl+Shift+P`              |
| Move tab left / right         | `Ctrl+Shift+Left` / `Right` |
| Most / second-most recent tab | `Cmd+Shift+1` / `2`         |
| Reload extension (dev)        | `Ctrl+Shift+R`              |

Video-speed shortcuts (while hovering a playable video):

| Key       | Action                 |
|-----------|------------------------|
| `S` / `D` | Slower / faster by 0.1× |
| `Shift+S` / `Shift+D` | Slower / faster by 0.05× |
| `Z` / `X` | Seek −10s / +10s       |
| `R`       | Toggle preferred speed |
| `F`       | Fullscreen             |
| `V`       | Hide overlay           |

## Install

There is no compile step — source files ship as-is. [`web-ext`](https://github.com/mozilla/web-ext)
(the only dev dependency) just packages and signs.

**Try it temporarily** (no signing): open `about:debugging#/runtime/this-firefox`
→ *Load Temporary Add-on…* → pick `manifest.json`.

**Build a Firefox `.xpi`:**

```sh
npm install        # installs web-ext
npm run build      # → web-ext-artifacts/supern.xpi
```

| Command                 | What it does                                              |
|-------------------------|-----------------------------------------------------------|
| `npm run build`         | Package an unsigned `.xpi` into `web-ext-artifacts/`.     |
| `npm run sign`          | Sign for a listed AMO release (needs `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`). |
| `npm run sign:unlisted` | Sign an unlisted Firefox build via AMO.                   |
| `npm run install-local` | Build, then open the newest `.xpi` in Firefox.            |
| `npm run build:chrome`  | Build the Chrome variant into `dist/chrome/`.             |
| `npm run package:chrome`| Build an uploadable Chrome Web Store ZIP in `dist/`.      |
| `npm run cloc`          | Line count of the shipping source.                        |

## Architecture

Each feature is **fully self-contained**: there is no shared module layer and no
bundler, because MV3 content scripts can't `import`. Every content script is an
IIFE that duplicates the few helpers it needs. The two coordination channels are
`browser.storage.local` (the single source of truth for all state, with every
context syncing via `storage.onChanged`) and DOM IDs/classes prefixed `__supern_*`.

For the full layout — where each feature lives, the storage key shapes, and the
conventions to follow when contributing — see [`AGENTS.md`](AGENTS.md).

## Privacy and permissions

SuperN has no account, analytics, telemetry, remote code, or remote settings
service. Its settings, daily usage totals, and pending snoozes are stored only
in the browser. It requests site access so its user-facing tools can work
there: time blocks, video controls, favicon conversion, and configured
site-specific features. Monochrome favicon conversion downloads the page's
public favicon without credentials and processes it locally. See
[`PRIVACY.md`](PRIVACY.md) for the complete data-handling statement.

## License

MIT
