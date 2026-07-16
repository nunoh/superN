# Changelog

## Unreleased

- Video speed controller: `Shift+S` / `Shift+D` now adjust speed in 0.05x increments; plain `S` / `D` use 0.1x steps.
- Release hardening: serialized time-block accounting, one-time external-link
  bypasses, private-window data protection, resilient snoozes, bounded favicon
  conversion, and an uploadable Chrome package.

## 2026-05-30 (v0.9)

### ✨ Features
- Time-block windows can be limited to weekdays — a **wkdys** toggle per site (and in the add form) makes the block-window apply Mon–Fri only. The daily minute budget still counts every day, so weekends keep the limit but drop the outside-hours block.

### 🔧 Improvements
- Video-speed overlay is more legible — dark rounded pill behind the rate readout instead of bare text.

## 2026-05-12 (v0.8.1)

### 🔧 Improvements
- Time-block daily budgets now reset at 4am local time instead of midnight, so late-night browsing before 4am counts toward the previous day
- Extension icon updated to the blocky SuperN mark.

### 🏗️ Under the hood
- Release packaging now builds a stable `supern.xpi` and includes helpers to locate or install the latest local XPI.

## 2026-05-02 (v0.7)

### ✨ Features
- Monochrome favicons — per-host allowlist in settings. Matching pages have their favicon desaturated to grayscale (canvas re-encode to data URI). MutationObserver re-applies when the page swaps the icon (e.g. Gmail repaints with the unread badge). Host match covers exact host or any subdomain. Already-open tabs reload when a new host is added

### 🔧 Improvements
- Time-block lets through inbound links — tabs that committed via a link click (or form submit) bypass both the budget and the window block for that navigation. Detected via `webNavigation` transition type, so referrer-stripping sites and chat apps still work. Typing the URL, opening from a bookmark, or reloading still blocks

## 2026-05-01 (v0.6)

### ✨ Features
- Doomscroll-o-meter on `x.com` — small horizontal bar next to the time-block timer that charges as you scroll fast and decays while you read. Color shifts green → yellow → red; hits 100% and the page locks for 8 seconds behind a "take a breath" overlay before resuming with a partial cooldown

## 2026-05-01 (v0.5.1)

### 🔧 Improvements
- Brand name capitalisation: extension now displays as "SuperN" (manifest name, toolbar tooltip, settings page title and heading, command descriptions). Internal identifiers (extension id, CSS classes, storage keys) unchanged

## 2026-05-01 (v0.5)

### ✨ Features
- Reclaim browser keyboard shortcuts on sites that hijack them — blocks `Cmd/Ctrl/Alt+*` and unmodified `1`–`9` from reaching the page in the capture phase, so the browser handles them normally. First site: `rtve.es` (replaces a standalone Tampermonkey script). Add more sites by extending the `matches` list in `manifest.json`

## 2026-05-01 (v0.4)

### ✨ Features
- Video speed controller — on any HTML5 video, `S`/`D` slow/speed up by 0.1, `R` reset to 1×, `Z`/`X` seek ±10s, `G` toggle preferred speed, `V` hide / show the overlay. Per-video overlay shows current rate. Speed fightback re-applies the chosen rate when sites reset it. Configurable preferred speed in settings (default 2.0×). Skips hover-preview thumbnails (videos wrapped in `<a>`)

### 🔧 Improvements
- Settings page section headings now have icons (clock, moon, fast-forward, keyboard)

### 🏗️ Under the hood
- `npm run cloc` script for line counts
- New content script registered for `<all_urls>` with `all_frames: true` so videos inside iframes are reachable

## 2026-05-01 (v0.3)

### ✨ Features
- Pin / unpin the active tab — `Ctrl+Shift+P` (Mac: `Ctrl+Shift+P`)
- Move active tab left / right — `Ctrl+Shift+←` / `Ctrl+Shift+→`
- Jump to most recent tab — `Cmd+Shift+1` (alternates with the previous tab)
- Jump to second-most-recent tab — `Cmd+Shift+2`
- Snooze tab — right-click any tab → "Snooze tab" → "Later today (6pm)" or "Tomorrow (9am)". Survives Firefox restart; pending snoozes are listed in settings with a cancel button
- Web search navigator — on Google search pages (google.com, google.es, google.pt), `j` / `k` step through results, `/` focuses the search box, native Enter opens the focused result. Skips ads and hidden elements

### 🔧 Improvements
- Settings page lists every keyboard shortcut with its live binding
- Settings page polish: Sentence-case section titles, consistent spacing and dividers between sections

### 🏗️ Under the hood
- Per-window recent-tab tracking via `tabs.onActivated`; survives until extension reload, seeds with active tabs on startup
- Snooze persistence via `browser.alarms` + `storage.local`; reconciles past-due wakes on extension startup

## 2026-05-01 (v0.2)

### ✨ Features
- Time-window blocking — pick a daily window when a site is blocked (wraps past midnight if end is before start)
- Hard / soft enforcement modes — soft shows a 10-second-delayed "open anyway" override, scoped to the current tab
- Settings shortcut: `Alt+Shift+N` (Mac: `Ctrl+Shift+N`) opens the options page

### 🔧 Improvements
- Daily minute budget is now optional — sites can be window-only, budget-only, or both
- Options page lists active keyboard shortcuts with live bindings
- Reasoned block screen — tells you whether you're outside allowed hours or out of daily time

### 🐛 Fixes
- Time and minute inputs no longer lose focus mid-keystroke — only the "used today" cells tick live now, the rest of the row stays put

### 🏗️ Under the hood
- Dev-reload hotkey: `Alt+Shift+R` (Mac: `Ctrl+Shift+R`) reloads the extension and refreshes any open blocked tab so content scripts re-inject
- Block-entry schema extended with optional `blockWindow` and `mode` fields; existing entries keep working unchanged
