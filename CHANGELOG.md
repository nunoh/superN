# Changelog

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
