# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

SuperN is a personal **Firefox** extension (Manifest V3, `browser.*` WebExtension
APIs, Gecko-only) that replaces a handful of single-purpose add-ons with one
minimal codebase. See `SPEC.md` for the feature/replacement table and default
keybindings; `CHANGELOG.md` tracks releases.

## Commands

There is no compile step, linter, or test suite — source files ship as-is.
`web-ext` only packages and signs. All commands run via npm:

- `npm run build` — package an unsigned `.xpi` into `web-ext-artifacts/`.
- `npm run sign` — sign via AMO (needs `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`, channel `unlisted`).
- `npm run install-local` — build, then open the newest `.xpi` in Firefox.
- `npm run release` — sign, then open the signed `.xpi` in Firefox.
- `npm run cloc` — line count of the shipping source.

For iterating on code, prefer the in-browser **dev-reload** hotkey
(`Ctrl+Shift+R` on Mac) over rebuilding: it calls `runtime.reload()` and
re-injects content scripts into open blocklisted tabs (see `background.js`).

## Architecture

Each feature is **fully self-contained** — there is no shared module layer and
no bundler, because MV3 content scripts can't `import`. Every content script is
an IIFE that duplicates the small helpers it needs (e.g. `hostMatches`,
`usageDayStr` appear in several files). Don't try to DRY these into a shared
file; matching the existing per-file duplication is the convention here.

The two coordination channels between otherwise-independent features are:

1. **`browser.storage.local`** — the single source of truth for all state.
   Every context (background, content scripts, options page) reads/writes it and
   listens via `browser.storage.onChanged` to stay in sync. Key shapes:
   - `blocklist` — `[{ domain, minutes?, blockWindow?: {start,end,weekdaysOnly?}, mode?: "hard"|"soft" }]`
     (`weekdaysOnly` scopes only the window to Mon–Fri; the `minutes` budget still applies every day)
   - `usage` / `resetDate` — per-domain seconds used today; reset at **4am local** (`usageDayStr`)
   - `snoozed` — `[{ id, url, title, wakeAt }]`, mirrored by `browser.alarms` named `snooze-<id>`
   - `monoFavicons` — host allowlist for grayscale favicons
   - `preferredSpeed` — video-speed "preferred rate" toggle target
   - `__supern_loaded_at` / `__supern_dev_reload_pending` — background-page lifecycle stamps

2. **DOM IDs/classes**, all prefixed `__supern_*` to avoid clashing with host
   pages (e.g. `#__supern_timer__`, `#__supern_doom__`, `.__supern_speed__`).
   The doomscroll meter positions itself relative to the timer overlay by
   reading `#__supern_timer__`'s bounding box.

### Where each feature lives

- `background.js` — the only persistent context. Sections (clearly commented):
  link-click bypass (via `webNavigation` transition types, since `referrer` is
  unreliable), snooze (menus + alarms, reconciled on startup), recent-tab jump
  (sorts by native `tab.lastAccessed` on demand — never keeps an in-memory queue,
  since the MV3 event page can be suspended), pin/move, and dev-reload.
- `content/timer.js` — the LeechBlock-style time-block. Ticks usage only while
  the tab is focused+visible, persists every ~5s, renders the countdown overlay,
  and swaps the whole page for a block screen (hard, or soft with a 10s-delayed
  "open anyway" button). Multi-tab safe via `storage.onChanged`.
- `content/video-speed.js` — overlay + page-level `S/D/Z/X/R/V` shortcuts on any
  `<video>`; includes "speed fightback" reapplying the rate when sites reset it.
- `content/doomscroll.js` — x.com scroll-speed meter that locks the page at 100%.
- `content/google-search.js` — `j/k` result navigation + `/` to focus search.
- `content/favicon.js` — canvas-grayscales favicons for allowlisted hosts.
- `content/keyboard-reclaim.js` — blocks specific sites (rtve.es) from hijacking
  `Cmd/Ctrl+digit` tab-switch shortcuts in the capture phase.
- `options/` — the settings page (also the action popup target); edits the
  storage keys above. Live-updates "used today" cells in place rather than
  re-rendering rows, to avoid clobbering a focused input mid-edit.

Content-script registration (match patterns, `run_at`, `all_frames`) and command
keybindings live in `manifest.json` — adding a feature means adding both the file
and its `content_scripts` / `commands` entry there.

## Conventions

- **No runtime dependencies.** `web-ext` is the only devDependency. Keep it that way.
- Vanilla JS, no transpile. Use `browser.*` (Promise-based), not `chrome.*`.
- Fail silently on transient WebExtension errors (`try { … } catch (_) {}`) —
  tabs close, pages navigate, the event page suspends; these are expected.
- Block screens / overlays are built with `document.createElement`, never
  `innerHTML` with page data.
- Git: Conventional Commits, no `Co-Authored-By` trailer (see global CLAUDE.md).
