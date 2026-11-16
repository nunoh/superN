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
// script reads via message. Deep links to a single item (a post, a video) also
// bypass when typed, pasted or bookmarked, but not when reached by a link from
// the same site. Reloads never bypass.
// ---------------------------------------------------------------------------

const LINK_BYPASS_STORE_KEY = "__supern_link_bypass_tabs";
const LINK_TRANSITIONS = new Set(["link", "form_submit"]);
const lastCommittedHost = new Map();

// Mirrors timer.js: the item ID a deep link points at, or null for feeds,
// profiles and other browsable pages.
function deepLinkAnchor(url) {
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return null;
  }
  const v = u.searchParams.get("v");
  if (u.pathname === "/watch" && v) return "v=" + v;
  const segs = u.pathname.split("/").filter(Boolean);
  return segs.slice(1).find((s) => s.length >= 6 && /\d/.test(s)) || null;
}

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
    const transition = details.transitionType;
    const isLink = LINK_TRANSITIONS.has(transition);
    const fromElsewhere = previousHost !== host;
    const bypass =
      transition !== "reload" &&
      (deepLinkAnchor(details.url)
        ? !isLink || fromElsewhere
        : isLink && Boolean(previousHost) && fromElsewhere);
    if (bypass) {
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
  if (msg?.type?.startsWith("supern-zero-")) return zeroMessage(msg, sender);
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
// Snooze tab(s).
// Right-click any tab → "Snooze tab" → choose a wake time. The tab is closed
// and re-opened at the chosen time. If the clicked tab is part of a multi-tab
// selection, the whole selection is snoozed in one go. State persists across
// Firefox restarts via browser.alarms; on startup we reconcile any past-due
// wakes.
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

// Firefox keeps a multi-tab selection alive through a right-click, so reflect
// the real target count in the menu label. Chromium has no menus.onShown.
if (browser.menus.onShown && browser.menus.refresh) {
  browser.menus.onShown.addListener(async (info, tab) => {
    if (!info.contexts.includes("tab") || !tab) return;
    const count = (await snoozeTargets(tab)).length;
    browser.menus.update("snooze-parent", {
      title: count > 1 ? `Snooze ${count} tabs` : "Snooze tab",
    });
    browser.menus.refresh();
  });
}

// The tabs a snooze click applies to: the whole highlighted selection when the
// clicked tab belongs to it, otherwise just the clicked tab.
async function snoozeTargets(tab) {
  try {
    const selected = await browser.tabs.query({
      highlighted: true,
      windowId: tab.windowId,
    });
    if (selected.length > 1 && selected.some((t) => t.id === tab.id)) {
      return selected;
    }
  } catch (_) {}
  return [tab];
}

browser.menus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  let wakeAt;
  if (info.menuItemId === "snooze-evening") wakeAt = eveningWakeAt();
  else if (info.menuItemId === "snooze-tomorrow") wakeAt = tomorrowWakeAt();
  else return;
  await snoozeTabs(await snoozeTargets(tab), wakeAt);
});

async function snoozeTabs(tabs, wakeAt) {
  const entries = [];
  for (const tab of tabs) {
    if (tab.incognito || !isSnoozable(tab.url)) continue;
    const id =
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    entries.push({
      tabId: tab.id,
      entry: { id, url: tab.url, title: tab.title || tab.url, wakeAt },
    });
  }
  if (entries.length === 0) return;

  for (const { entry } of entries) {
    await browser.alarms.create(ALARM_PREFIX + entry.id, { when: wakeAt });
  }
  await mutateSnoozed((list) => [...list, ...entries.map((e) => e.entry)]);

  // Close one at a time so a single stubborn tab only rolls back its own entry
  // rather than the rest of the selection.
  const failed = [];
  for (const { tabId, entry } of entries) {
    try {
      await browser.tabs.remove(tabId);
    } catch (_) {
      failed.push(entry.id);
    }
  }
  if (failed.length === 0) return;
  // Keep the original tabs rather than creating unexpected duplicate wakes.
  try {
    for (const id of failed) await browser.alarms.clear(ALARM_PREFIX + id);
    await mutateSnoozed((list) => list.filter((e) => !failed.includes(e.id)));
  } catch (_) {}
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
      (e) =>
        e.enabled !== false &&
        (host === e.domain || host.endsWith("." + e.domain))
    );
    if (matches) browser.tabs.reload(tab.id);
  }
})();

// ---------------------------------------------------------------------------
// Zero: opt-in count reporting to the user's LAN dashboard. Count/timestamp
// only; no tab URLs, message contents, account identities, or private tabs.
// ---------------------------------------------------------------------------
const ZERO_ORIGIN = 'https://zero.nh';
const ZERO_ALARM = 'supern-zero-refresh';
let zeroTimer;
let zeroQueue = Promise.resolve();

function zeroSchedule() {
  clearTimeout(zeroTimer);
  zeroTimer = setTimeout(() => zeroSync().catch(() => {}), 800);
}

async function zeroMessage(msg, sender) {
  if (sender.tab?.incognito || IS_PRIVATE_CONTEXT) return { ok: false };
  if (msg.type === 'supern-zero-pair') {
    if (!sender.tab || new URL(sender.url || sender.tab.url).origin !== ZERO_ORIGIN ||
        !/^[a-f0-9]{64}$/.test(msg.token)) return { ok: false };
    const permissions = await browser.permissions.getAll();
    if (permissions.data_collection && !['browsingActivity', 'websiteContent'].every(p => permissions.data_collection.includes(p))) {
      await browser.runtime.openOptionsPage();
      return { ok: false, needsConsent: true };
    }
    await browser.storage.local.set({ zeroConnection: { token: msg.token } });
    await browser.alarms.create(ZERO_ALARM, { periodInMinutes: 1 });
    return { ok: await zeroSync() };
  }
  if (msg.type === 'supern-zero-gmail-changed') {
    if (!sender.tab || new URL(sender.url || sender.tab.url).origin !== 'https://mail.google.com') return;
    zeroSchedule();
  }
}

function zeroTabCount(tabs) {
  const normal = tabs.filter(tab => !tab.incognito);
  return normal.length - Math.min(3, normal.filter(tab => tab.pinned).length);
}

function zeroSync() {
  // A suspended/restarted background can reconstruct everything from storage.
  zeroQueue = zeroQueue.catch(() => {}).then(async () => {
    if (IS_PRIVATE_CONTEXT) return false;
    const { zeroConnection } = await browser.storage.local.get('zeroConnection');
    if (!zeroConnection?.token) return false;
    const permissions = await browser.permissions.getAll();
    if (permissions.data_collection && !['browsingActivity', 'websiteContent'].every(p => permissions.data_collection.includes(p))) return false;
    const tabs = (await browser.tabs.query({ windowType: 'normal' })).filter(tab => !tab.incognito);
    // Global allowance of three pinned tabs; extra pinned tabs count too.
    const report = { tabs: { available: true, count: zeroTabCount(tabs), observedAt: Date.now() } };
    const gmail = tabs.filter(tab => /^https:\/\/mail\.google\.com\/mail\//.test(tab.url || ''))
      .sort((a, b) => a.windowId - b.windowId || a.index - b.index)[0];
    if (gmail) {
      try { report.inbox = await browser.tabs.sendMessage(gmail.id, { type: 'supern-zero-read-inbox' }); }
      catch { report.inbox = { available: false, reason: 'loading', observedAt: Date.now() }; }
    } else report.inbox = { available: false, reason: 'closed', observedAt: Date.now() };
    try {
      const response = await fetch(ZERO_ORIGIN + '/api/sources', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + zeroConnection.token },
        body: JSON.stringify(report), credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await browser.storage.local.set({ zeroStatus: { ok: true, updatedAt: Date.now(), inbox: report.inbox, tabs: report.tabs.count } });
      return true;
    } catch (error) {
      await browser.storage.local.set({ zeroStatus: { ok: false, updatedAt: Date.now(), error: String(error.message).slice(0, 120) } });
      return false;
    }
  });
  return zeroQueue;
}

browser.tabs.onCreated.addListener(zeroSchedule);
browser.tabs.onRemoved.addListener(zeroSchedule);
browser.tabs.onMoved.addListener(zeroSchedule);
browser.tabs.onAttached.addListener(zeroSchedule);
browser.tabs.onDetached.addListener(zeroSchedule);
browser.tabs.onUpdated.addListener((_id, change) => {
  if ('pinned' in change || change.status === 'complete' || 'url' in change) zeroSchedule();
});
browser.alarms.onAlarm.addListener(alarm => { if (alarm.name === ZERO_ALARM) zeroSync().catch(() => {}); });
(async () => {
  if (IS_PRIVATE_CONTEXT) return;
  const { zeroConnection } = await browser.storage.local.get('zeroConnection');
  if (zeroConnection?.token) {
    await browser.alarms.create(ZERO_ALARM, { periodInMinutes: 1 });
    zeroSync().catch(() => {});
  }
})();
