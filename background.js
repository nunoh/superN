const IS_PRIVATE_CONTEXT = Boolean(
  browser.extension && browser.extension.inIncognitoContext
);

// Stamp the moment this background page (re)spawned. Surfaced in the settings
// page so a dev-reload — or a Firefox suspend/respawn — is visibly verifiable.
if (!IS_PRIVATE_CONTEXT) {
  browser.storage.local.set({ __supern_loaded_at: Date.now() });
}

const IS_CHROME_BUILD = !browser.runtime.getManifest().browser_specific_settings;

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (IS_CHROME_BUILD) await setupSnoozeMenu();
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
// Direct-link bypass for time-blocked sites.
// document.referrer is unreliable (Referrer-Policy: no-referrer strips it on
// many sites and chat apps), so we use webNavigation transition types: tabs
// that committed via "link" or "form_submit" get a bypass flag the content
// script reads via message. Typed / bookmarked / reloaded navs do not.
// ---------------------------------------------------------------------------

const LINK_BYPASS_STORE_KEY = "__supern_link_bypass_tabs";
const LINK_TRANSITIONS = new Set(["link", "form_submit"]);
const lastCommittedHost = new Map();

function sessionStore() {
  // Firefox 121+ and Chromium 123+ provide session storage. Keep navigation
  // state there so an MV3 worker restart cannot silently lose a just-recorded
  // bypass, while never writing it to disk.
  return browser.storage.session;
}

async function setLinkBypass(tabId, url) {
  const store = sessionStore();
  const { [LINK_BYPASS_STORE_KEY]: pending = {} } = await store.get(
    LINK_BYPASS_STORE_KEY
  );
  pending[tabId] = { url, expiresAt: Date.now() + 30_000 };
  await store.set({ [LINK_BYPASS_STORE_KEY]: pending });
}

async function clearLinkBypass(tabId) {
  const store = sessionStore();
  const { [LINK_BYPASS_STORE_KEY]: pending = {} } = await store.get(
    LINK_BYPASS_STORE_KEY
  );
  if (!(tabId in pending)) return;
  delete pending[tabId];
  await store.set({ [LINK_BYPASS_STORE_KEY]: pending });
}

async function consumeLinkBypass(tabId, url) {
  const store = sessionStore();
  const { [LINK_BYPASS_STORE_KEY]: pending = {} } = await store.get(
    LINK_BYPASS_STORE_KEY
  );
  const bypass = pending[tabId];
  if (!bypass) return false;
  delete pending[tabId];
  await store.set({ [LINK_BYPASS_STORE_KEY]: pending });
  return bypass.expiresAt > Date.now() && bypass.url === url;
}

(async () => {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || tab.incognito) continue;
      lastCommittedHost.set(tab.id, new URL(tab.url).hostname);
    }
  } catch (_) {}
})();

if (browser.webNavigation && browser.webNavigation.onCommitted) {
  browser.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return;
    try {
      const tab = await browser.tabs.get(details.tabId);
      if (tab.incognito) return;
    } catch (_) {
      return;
    }
    let host;
    try {
      host = new URL(details.url).hostname;
    } catch (_) {
      return;
    }
    const previousHost = lastCommittedHost.get(details.tabId);
    lastCommittedHost.set(details.tabId, host);
    if (
      previousHost &&
      previousHost !== host &&
      LINK_TRANSITIONS.has(details.transitionType)
    ) {
      setLinkBypass(details.tabId, details.url).catch(() => {});
    } else {
      clearLinkBypass(details.tabId).catch(() => {});
    }
  });
}

browser.tabs.onRemoved.addListener((tabId) => {
  lastCommittedHost.delete(tabId);
  clearLinkBypass(tabId).catch(() => {});
});

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg && msg.type === "supern-bypass-check") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null || !sender.tab.url) return false;
    try {
      return await consumeLinkBypass(tabId, sender.tab.url);
    } catch (_) {
      return false;
    }
  }
  if (msg && msg.type === "supern-usage-add") {
    const seconds = Number(msg.seconds);
    const domain = String(msg.domain || "");
    if (!domain || !Number.isFinite(seconds) || seconds <= 0 || seconds > 60) {
      return null;
    }
    return addUsage(domain, seconds);
  }
});

// ---------------------------------------------------------------------------
// Time-block usage accounting. Content scripts report elapsed focused time;
// this single background queue serializes their read-modify-write updates so
// usage from different tabs cannot overwrite each other.
// ---------------------------------------------------------------------------

const RESET_HOUR = 4;
let usageQueue = Promise.resolve();

function usageDayStr() {
  const d = new Date();
  d.setHours(d.getHours() - RESET_HOUR);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function addUsage(domain, seconds) {
  const operation = async () => {
    const { usage = {}, resetDate = "" } = await browser.storage.local.get([
      "usage",
      "resetDate",
    ]);
    const currentUsage = resetDate === usageDayStr() ? usage : {};
    const nextUsage = Object.assign({}, currentUsage);
    nextUsage[domain] = (nextUsage[domain] || 0) + seconds;
    await browser.storage.local.set({ usage: nextUsage, resetDate: usageDayStr() });
    return nextUsage[domain];
  };
  const next = usageQueue.then(operation, operation);
  usageQueue = next.catch(() => {});
  return next;
}

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
const wakingSnoozes = new Set();
let snoozeQueue = Promise.resolve();

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
  try {
    return ["http:", "https:", "ftp:", "file:"].includes(
      new URL(url).protocol
    );
  } catch (_) {
    return false;
  }
}

async function setupSnoozeMenu() {
  if (!browser.menus || !browser.menus.create) return;
  if (browser.menus.removeAll) {
    try {
      await browser.menus.removeAll();
    } catch (_) {}
  }
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
}

if (!IS_CHROME_BUILD) setupSnoozeMenu();

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
  if (tab.incognito) return;
  const id =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const entry = {
    id,
    url: tab.url,
    title: tab.title || tab.url,
    wakeAt,
  };
  await browser.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
  await mutateSnoozed((list) => [...list, entry]);
  try {
    await browser.tabs.remove(tab.id);
  } catch (_) {
    // Keep the original tab rather than creating an unexpected duplicate wake.
    try {
      await browser.alarms.clear(ALARM_PREFIX + id);
      await mutateSnoozed((list) => list.filter((e) => e.id !== id));
    } catch (_) {}
  }
}

function mutateSnoozed(mutator) {
  const operation = async () => {
    const { [SNOOZED_KEY]: existing = [] } = await browser.storage.local.get(
      SNOOZED_KEY
    );
    const next = mutator(existing);
    await browser.storage.local.set({ [SNOOZED_KEY]: next });
    return next;
  };
  const next = snoozeQueue.then(operation, operation);
  snoozeQueue = next.catch(() => {});
  return next;
}

async function wake(entry) {
  if (wakingSnoozes.has(entry.id)) return;
  wakingSnoozes.add(entry.id);
  try {
    await browser.tabs.create({ url: entry.url, active: true });
  } catch (_) {
    // Keep the item visible and retry later. Dropping it here silently loses a
    // user's tab when the browser temporarily refuses to open it.
    try {
      await browser.alarms.create(ALARM_PREFIX + entry.id, {
        when: Date.now() + 5 * 60 * 1000,
      });
    } catch (_) {}
    wakingSnoozes.delete(entry.id);
    return;
  }
  try {
    await mutateSnoozed((list) => list.filter((e) => e.id !== entry.id));
  } finally {
    wakingSnoozes.delete(entry.id);
  }
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
// Recent-tab jump. Firefox maintains tab.lastAccessed natively, so we sort the
// current window's tabs by it on demand. An MV3 event page can be suspended at
// any time — keeping our own in-memory queue means it gets wiped and the
// shortcut silently no-ops until the user manually changes tabs again.
// ---------------------------------------------------------------------------

async function gotoRecent(n) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const sorted = tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
  const target = sorted[n];
  if (!target) return;
  try {
    await browser.tabs.update(target.id, { active: true });
  } catch (_) {}
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
