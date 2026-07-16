# SuperN

## Why

- One Firefox extension to replace some of the multiple I use
- Fewer third parties reading my tabs and history
- Fewer shortcuts to set when doing clean installs
- More minimal

## Shipped

| Feature                | Replaces                                                                     | Notes                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Time-block             | [LeechBlock NG](https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/) | Per-site daily minute budget reset at 4am local time, daily window block, hard / soft (10s-delayed override) modes. Inbound links from other sites bypass the block for that tab |
| Pin / unpin tab        | [Pin Unpin Tab](https://addons.mozilla.org/en-US/firefox/addon/pinunpin-tab/)  | Toggle on the active tab                                                                     |
| Move tab hotkeys       | [Move Tab Hotkeys](https://addons.mozilla.org/en-US/firefox/addon/move-tab-hotkeys/) | Move active tab left / right                                                                 |
| Most recent tab        | [Most Recent Tab](https://addons.mozilla.org/en-US/firefox/addon/most-recent-tab/) | Per-window alternation; also jump to second-most-recent                                      |
| Snooze tab             | [Snooze Tabs](https://addons.mozilla.org/en-US/firefox/addon/snooze-tabs-we/)  | Right-click tab → Snooze tab → "Later today (6pm)" or "Tomorrow (9am)"; survives restart     |
| Web search navigator   | [Web Search Navigator](https://addons.mozilla.org/en-US/firefox/addon/web-search-navigator/) | `j` / `k` to step through Google results, `/` to focus the search box; google.com, google.es, google.pt |
| Video speed controller | [Video Speed Controller](https://addons.mozilla.org/en-US/firefox/addon/videospeed/) | Overlay + page-level shortcuts on any HTML5 video. `S` / `D` slower / faster by 0.1, `Shift+S` / `Shift+D` by 0.05, `Z` / `X` seek 10s, `R` toggle preferred speed, `V` hide overlay, `F` fullscreen (also overlay button); speed fightback against sites that reset the rate |
| Doomscroll-o-meter     | —                                                                            | Tiny meter next to the timer on x.com. Charges as you scroll fast, decays while you read; green → yellow → red. Hits 100% → page locks for 8s with a "take a breath" overlay |
| Monochrome favicons    | [Favicon Changer](https://addons.mozilla.org/en-US/firefox/addon/favicon-changer/) | Per-host allowlist; favicons get desaturated to grayscale via canvas. Re-applies when the page swaps the icon (e.g. Gmail unread badge). Host or any subdomain |

Default keybindings (Mac):

| Action                  | Binding             |
| ----------------------- | ------------------- |
| Open settings           | `Ctrl+Shift+N`      |
| Pin / unpin tab         | `Ctrl+Shift+P`      |
| Move tab left           | `Ctrl+Shift+Left`   |
| Move tab right          | `Ctrl+Shift+Right`  |
| Most recent tab         | `Cmd+Shift+1`       |
| Second most recent tab  | `Cmd+Shift+2`       |
| Reload extension (dev)  | `Ctrl+Shift+R`      |

Rebind via `about:addons` → ⚙ → *Manage Extension Shortcuts*.
