browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const stored = await browser.storage.local.get("blocklist");
  if (!stored.blocklist) {
    await browser.storage.local.set({
      blocklist: [{ domain: "x.com", minutes: 60 }],
    });
  }
});

browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});

// ---------------------------------------------------------------------------
// Snooze tab.
// Right-click any tab → "Snooze tab" → choose a wake time. The tab is closed
// and re-opened at the chosen time. State persists across Firefox restarts via
// browser.alarms; on startup we reconcile any past-due wakes.
// ---------------------------------------------------------------------------

const SNOOZED_KEY = "snoozed";
const ALARM_PREFIX = "snooze-";
const SNOOZE_TOMORROW_HOUR = 9;
const SNOOZE_EVENING_HOUR = 18;

function timeAt(hour, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function eveningWakeAt() {
  const evening = timeAt(SNOOZE_EVENING_HOUR);
  // If 6pm has already passed today, push to tomorrow.
  return evening > Date.now() ? evening : timeAt(SNOOZE_EVENING_HOUR, 1);
}

function tomorrowWakeAt() {
  return timeAt(SNOOZE_TOMORROW_HOUR, 1);
}

function isSnoozable(url) {
  if (!url) return false;
  return /^https?:|^ftp:|^file:/i.test(url);
}

(function setupSnoozeMenu() {
  if (!browser.menus || !browser.menus.create) return;
  browser.menus.create({
    id: "snooze-parent",
    title: "Snooze tab",
    contexts: ["tab"],
  });
  browser.menus.create({
    id: "snooze-evening",
    parentId: "snooze-parent",
    title: "Later today (6pm)",
    contexts: ["tab"],
  });
  browser.menus.create({
    id: "snooze-tomorrow",
    parentId: "snooze-parent",
    title: "Tomorrow (9am)",
    contexts: ["tab"],
  });
})();

browser.menus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  let wakeAt;
  if (info.menuItemId === "snooze-evening") wakeAt = eveningWakeAt();
  else if (info.menuItemId === "snooze-tomorrow") wakeAt = tomorrowWakeAt();
  else return;
  if (!isSnoozable(tab.url)) return;
  await snoozeTab(tab, wakeAt);
});

async function snoozeTab(tab, wakeAt) {
  const id =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const entry = {
    id,
    url: tab.url,
    title: tab.title || tab.url,
    wakeAt,
  };
  const { [SNOOZED_KEY]: existing = [] } = await browser.storage.local.get(
    SNOOZED_KEY
  );
  await browser.storage.local.set({
    [SNOOZED_KEY]: [...existing, entry],
  });
  await browser.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
  try {
    await browser.tabs.remove(tab.id);
  } catch (_) {
    // tab may have closed already
  }
}

async function wake(entry) {
  try {
    await browser.tabs.create({ url: entry.url, active: true });
  } catch (_) {
    // fall through — still drop from list
  }
  const { [SNOOZED_KEY]: list = [] } = await browser.storage.local.get(
    SNOOZED_KEY
  );
  await browser.storage.local.set({
    [SNOOZED_KEY]: list.filter((e) => e.id !== entry.id),
  });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  const { [SNOOZED_KEY]: list = [] } = await browser.storage.local.get(
    SNOOZED_KEY
  );
  const entry = list.find((e) => e.id === id);
  if (entry) await wake(entry);
});

// Reconcile snoozed list on startup: re-create alarms for the future, fire
// any past-due ones immediately. Handles Firefox restarts and extension
// reloads.
(async () => {
  const { [SNOOZED_KEY]: list = [] } = await browser.storage.local.get(
    SNOOZED_KEY
  );
  if (list.length === 0) return;
  const now = Date.now();
  for (const entry of list) {
    if (entry.wakeAt <= now) {
      await wake(entry);
    } else {
      browser.alarms.create(ALARM_PREFIX + entry.id, { when: entry.wakeAt });
    }
  }
})();

// ---------------------------------------------------------------------------
// Recent-tab tracking (per-window).
// recents holds {tabId, windowId} most-recent-first. Index 0 in any window's
// view is the currently active tab in that window; index 1 is the previous,
// index 2 the one before that.
// ---------------------------------------------------------------------------

const RECENTS_MAX = 24;
let recents = [];

function pushRecent(tabId, windowId) {
  recents = recents.filter((r) => r.tabId !== tabId);
  recents.unshift({ tabId, windowId });
  if (recents.length > RECENTS_MAX) recents.length = RECENTS_MAX;
}

browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
  pushRecent(tabId, windowId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  recents = recents.filter((r) => r.tabId !== tabId);
});

// Seed recents with each window's currently active tab so shortcuts work
// immediately after extension load (otherwise recents starts empty until the
// user changes tabs).
(async () => {
  try {
    const active = await browser.tabs.query({ active: true });
    for (const t of active) pushRecent(t.id, t.windowId);
  } catch (_) {}
})();

async function gotoRecent(n) {
  let win;
  try {
    win = await browser.windows.getCurrent();
  } catch (_) {
    return;
  }
  const inWin = recents.filter((r) => r.windowId === win.id);
  const target = inWin[n];
  if (!target) return;
  try {
    await browser.tabs.update(target.tabId, { active: true });
  } catch (_) {
    recents = recents.filter((r) => r.tabId !== target.tabId);
  }
}

// ---------------------------------------------------------------------------
// Pin / move tab.
// ---------------------------------------------------------------------------

async function togglePin() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await browser.tabs.update(tab.id, { pinned: !tab.pinned });
}

async function moveTab(dir) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const all = await browser.tabs.query({ currentWindow: true });
  const newIndex = Math.max(0, Math.min(all.length - 1, tab.index + dir));
  if (newIndex === tab.index) return;
  try {
    await browser.tabs.move(tab.id, { index: newIndex });
  } catch (_) {
    // pinned/unpinned boundary or other transient error — ignore
  }
}

// ---------------------------------------------------------------------------
// Dev-reload: hotkey reloads the extension and refreshes any open tab matching
// the blocklist so its content script picks up the new code. We can't reload
// tabs *after* runtime.reload() (this script dies), so we set a flag, reload
// the extension, and the new background instance does the sweep on startup.
// ---------------------------------------------------------------------------

const DEV_RELOAD_PENDING = "__supern_dev_reload_pending";

browser.commands.onCommand.addListener(async (name) => {
  switch (name) {
    case "open-options":
      browser.runtime.openOptionsPage();
      return;
    case "pin-toggle":
      togglePin();
      return;
    case "tab-left":
      moveTab(-1);
      return;
    case "tab-right":
      moveTab(1);
      return;
    case "recent-1":
      gotoRecent(1);
      return;
    case "recent-2":
      gotoRecent(2);
      return;
    case "dev-reload":
      await browser.storage.local.set({ [DEV_RELOAD_PENDING]: true });
      browser.runtime.reload();
      return;
  }
});

(async () => {
  const { [DEV_RELOAD_PENDING]: pending } = await browser.storage.local.get(
    DEV_RELOAD_PENDING
  );
  if (!pending) return;
  await browser.storage.local.remove(DEV_RELOAD_PENDING);
  const { blocklist = [] } = await browser.storage.local.get("blocklist");
  if (blocklist.length === 0) return;
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    let host;
    try {
      host = new URL(tab.url).hostname;
    } catch (_) {
      continue;
    }
    const matches = blocklist.some(
      (e) => host === e.domain || host.endsWith("." + e.domain)
    );
    if (matches) browser.tabs.reload(tab.id);
  }
})();
