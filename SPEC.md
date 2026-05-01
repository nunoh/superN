# superN


## Why

- one firefox extension to replace some of the multiple i use
- fewer third parties reading my tabs and history
- less shortcuts to set when doing clean installs
- more minimal

## Shipped

| feature                | replaces                                                                     | notes                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| time-block             | [LeechBlock NG](https://addons.mozilla.org/en-US/firefox/addon/leechblock-ng/) | per-site daily minute budget, daily window block, hard / soft (10s-delayed override) modes  |
| pin / unpin tab        | [Pin Unpin Tab](https://addons.mozilla.org/en-US/firefox/addon/pinunpin-tab/)  | toggle on the active tab                                                                     |
| move tab hotkeys       | [Move Tab Hotkeys](https://addons.mozilla.org/en-US/firefox/addon/move-tab-hotkeys/) | move active tab left / right                                                                |
| most recent tab        | [Most Recent Tab](https://addons.mozilla.org/en-US/firefox/addon/most-recent-tab/) | per-window alternation; also jump to second-most-recent                                     |
| snooze tab             | [Snooze Tabs](https://addons.mozilla.org/en-US/firefox/addon/snooze-tabs-we/)  | right-click tab → snooze tab → "Later today (6pm)" or "Tomorrow (9am)"; survives restart    |
| web search navigator   | [Web Search Navigator](https://addons.mozilla.org/en-US/firefox/addon/web-search-navigator/) | `j` / `k` to step through Google results, `/` to focus the search box; google.com, google.es, google.pt |
| video speed controller | [Video Speed Controller](https://addons.mozilla.org/en-US/firefox/addon/videospeed/) | overlay + page-level shortcuts on any HTML5 video. `S`/`D` slower/faster, `R` reset, `Z`/`X` seek 10s, `G` toggle preferred speed, `V` hide overlay; speed fightback against sites that reset the rate |

Default keybindings (Mac):

| action                  | binding             |
| ----------------------- | ------------------- |
| open settings           | `Ctrl+Shift+N`      |
| pin / unpin tab         | `Ctrl+Shift+P`      |
| move tab left           | `Ctrl+Shift+Left`   |
| move tab right          | `Ctrl+Shift+Right`  |
| most recent tab         | `Cmd+Shift+1`       |
| second most recent tab  | `Cmd+Shift+2`       |
| reload extension (dev)  | `Ctrl+Shift+R`      |

Rebind via `about:addons` → ⚙ → *Manage Extension Shortcuts*.

## Inbox

| ext                    | does                                      | difficulty                                       |                                                                              | perms                                |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------ |
| Transpose              | audio pitch shift on html5 media          | 🟡 medium — Web Audio pitch-shift node           | [link](https://addons.mozilla.org/en-US/firefox/addon/transpose/)            | tabs, all sites                      |

### out of scope?
- Tampermonkey 🟠 — can be removed after
