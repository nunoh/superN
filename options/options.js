const tbody = document.querySelector("#blocklist tbody");
const form = document.querySelector("#add-form");
const domainInput = document.querySelector("#add-domain");
const minutesInput = document.querySelector("#add-minutes");
const startInput = document.querySelector("#add-start");
const endInput = document.querySelector("#add-end");
const weekdaysInput = document.querySelector("#add-weekdays");
const modeInput = document.querySelector("#add-mode");
const snoozedList = document.querySelector("#snoozed-list");

const SNOOZED_KEY = "snoozed";
const SNOOZE_ALARM_PREFIX = "snooze-";
const TIME_BLOCK_RESET_HOUR = 4;

function usageDayStr() {
  const d = new Date();
  d.setHours(d.getHours() - TIME_BLOCK_RESET_HOUR);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function fmtUsed(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + "m " + String(s).padStart(2, "0") + "s";
}

function normalizeDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function isValidHM(s) {
  return /^\d{2}:\d{2}$/.test(s);
}

async function getList() {
  const { blocklist = [] } = await browser.storage.local.get("blocklist");
  return blocklist;
}

async function updateEntry(domain, patch) {
  const list = await getList();
  const item = list.find((e) => e.domain === domain);
  if (!item) return;
  for (const k of Object.keys(patch)) {
    if (patch[k] === undefined) delete item[k];
    else item[k] = patch[k];
  }
  await browser.storage.local.set({ blocklist: list });
}

async function load() {
  const { blocklist = [], usage = {}, resetDate = "" } =
    await browser.storage.local.get(["blocklist", "usage", "resetDate"]);
  const liveUsage = resetDate === usageDayStr() ? usage : {};

  tbody.innerHTML = "";
  if (blocklist.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="empty">no sites yet.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const entry of blocklist) {
    const tr = document.createElement("tr");

    const tdDomain = document.createElement("td");
    tdDomain.textContent = entry.domain;

    const tdMinutes = document.createElement("td");
    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.min = "1";
    minInput.max = "1440";
    minInput.placeholder = "—";
    minInput.value = entry.minutes || "";
    tdMinutes.appendChild(minInput);

    const tdWindow = document.createElement("td");
    tdWindow.className = "window-cell";
    const startEl = document.createElement("input");
    startEl.type = "time";
    startEl.value = entry.blockWindow ? entry.blockWindow.start : "";
    const endEl = document.createElement("input");
    endEl.type = "time";
    endEl.value = entry.blockWindow ? entry.blockWindow.end : "";
    const dash = document.createElement("span");
    dash.textContent = "–";
    dash.className = "dash";
    const weekdayLabel = document.createElement("label");
    weekdayLabel.className = "weekday-toggle";
    weekdayLabel.title = "apply this window on weekdays only";
    const weekdayEl = document.createElement("input");
    weekdayEl.type = "checkbox";
    weekdayEl.checked = !!(entry.blockWindow && entry.blockWindow.weekdaysOnly);
    weekdayLabel.append(weekdayEl, document.createTextNode("wkdys"));
    tdWindow.append(startEl, dash, endEl, weekdayLabel);

    const tdMode = document.createElement("td");
    const modeEl = document.createElement("select");
    for (const v of ["hard", "soft"]) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      modeEl.appendChild(opt);
    }
    modeEl.value = entry.mode === "soft" ? "soft" : "hard";
    tdMode.appendChild(modeEl);

    const tdUsed = document.createElement("td");
    tdUsed.className = "used-cell";
    tdUsed.dataset.domain = entry.domain;
    tdUsed.textContent = fmtUsed(liveUsage[entry.domain]);

    const tdActions = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "remove";
    removeBtn.className = "remove";
    tdActions.appendChild(removeBtn);

    tr.append(tdDomain, tdMinutes, tdWindow, tdMode, tdUsed, tdActions);
    tbody.appendChild(tr);

    minInput.addEventListener("change", async () => {
      const raw = minInput.value.trim();
      if (raw === "") {
        await updateEntry(entry.domain, { minutes: undefined });
        return;
      }
      const mins = parseInt(raw, 10);
      if (!mins || mins < 1) {
        minInput.value = entry.minutes || "";
        return;
      }
      await updateEntry(entry.domain, { minutes: mins });
    });

    const onWindowChange = async () => {
      const s = startEl.value;
      const e = endEl.value;
      if (!s && !e) {
        await updateEntry(entry.domain, { blockWindow: undefined });
        return;
      }
      if (!isValidHM(s) || !isValidHM(e)) return; // wait for both
      const win = { start: s, end: e };
      if (weekdayEl.checked) win.weekdaysOnly = true;
      await updateEntry(entry.domain, { blockWindow: win });
    };
    startEl.addEventListener("change", onWindowChange);
    endEl.addEventListener("change", onWindowChange);
    weekdayEl.addEventListener("change", onWindowChange);

    modeEl.addEventListener("change", async () => {
      await updateEntry(entry.domain, { mode: modeEl.value });
    });

    removeBtn.addEventListener("click", async () => {
      const list = (await getList()).filter((e) => e.domain !== entry.domain);
      await browser.storage.local.set({ blocklist: list });
    });
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const domain = normalizeDomain(domainInput.value);
  if (!domain) return;

  const rawMin = minutesInput.value.trim();
  const minutes = rawMin === "" ? null : parseInt(rawMin, 10);
  if (rawMin !== "" && (!minutes || minutes < 1)) return;

  const start = startInput.value;
  const end = endInput.value;
  const hasWindow = start && end;
  if ((start && !end) || (!start && end)) return; // both or neither

  if (!minutes && !hasWindow) {
    // need at least one constraint
    return;
  }

  const list = await getList();
  if (list.find((x) => x.domain === domain)) {
    domainInput.value = "";
    return;
  }

  const entry = { domain };
  if (minutes) entry.minutes = minutes;
  if (hasWindow) {
    entry.blockWindow = { start, end };
    if (weekdaysInput.checked) entry.blockWindow.weekdaysOnly = true;
  }
  if (modeInput.value === "soft") entry.mode = "soft";

  list.push(entry);
  await browser.storage.local.set({ blocklist: list });

  domainInput.value = "";
  minutesInput.value = "";
  startInput.value = "";
  endInput.value = "";
  weekdaysInput.checked = false;
  modeInput.value = "hard";
  domainInput.focus();
});

function fmtWakeAt(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return "today " + time;
  if (isTomorrow) return "tomorrow " + time;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
}

async function loadSnoozed() {
  if (!snoozedList) return;
  const { [SNOOZED_KEY]: list = [] } = await browser.storage.local.get(
    SNOOZED_KEY
  );
  snoozedList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "none.";
    snoozedList.appendChild(li);
    return;
  }
  const sorted = [...list].sort((a, b) => a.wakeAt - b.wakeAt);
  for (const entry of sorted) {
    const li = document.createElement("li");

    const main = document.createElement("div");
    main.className = "snoozed-main";

    const title = document.createElement("a");
    title.className = "snoozed-title";
    title.textContent = entry.title || entry.url;
    title.title = entry.url;
    title.href = entry.url;
    title.target = "_blank";
    title.rel = "noreferrer";

    const meta = document.createElement("div");
    meta.className = "snoozed-meta";
    meta.textContent = "wakes " + fmtWakeAt(entry.wakeAt);

    main.append(title, meta);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "remove";
    cancelBtn.textContent = "cancel";
    cancelBtn.addEventListener("click", async () => {
      await browser.alarms.clear(SNOOZE_ALARM_PREFIX + entry.id);
      const { [SNOOZED_KEY]: cur = [] } = await browser.storage.local.get(
        SNOOZED_KEY
      );
      await browser.storage.local.set({
        [SNOOZED_KEY]: cur.filter((e) => e.id !== entry.id),
      });
    });

    li.append(main, cancelBtn);
    snoozedList.appendChild(li);
  }
}

async function refreshUsed() {
  const { usage = {}, resetDate = "" } = await browser.storage.local.get([
    "usage",
    "resetDate",
  ]);
  const liveUsage = resetDate === usageDayStr() ? usage : {};
  for (const cell of tbody.querySelectorAll(".used-cell")) {
    cell.textContent = fmtUsed(liveUsage[cell.dataset.domain]);
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // Only a full reload when the list shape changes; usage/resetDate just
  // update the "used today" cells in place so focused inputs aren't clobbered.
  if (changes.blocklist) {
    load();
  } else if (changes.usage || changes.resetDate) {
    refreshUsed();
  }
  if (changes[SNOOZED_KEY]) loadSnoozed();
});

// Tick the "used today" cells live without re-rendering rows (which would
// destroy any focused input mid-edit).
setInterval(() => {
  if (document.visibilityState === "visible") refreshUsed();
}, 1000);

function prettyShortcut(s) {
  // On Mac, "MacCtrl" is the actual Control key — display as "Ctrl" since this
  // page is only ever shown on Mac.
  return s.replace(/\bMacCtrl\b/g, "Ctrl");
}

async function loadShortcuts() {
  if (!browser.commands || !browser.commands.getAll) return;
  const map = {
    "open-options": document.querySelector("#open-shortcut"),
    "pin-toggle": document.querySelector("#pin-shortcut"),
    "tab-left": document.querySelector("#tab-left-shortcut"),
    "tab-right": document.querySelector("#tab-right-shortcut"),
    "recent-1": document.querySelector("#recent-1-shortcut"),
    "recent-2": document.querySelector("#recent-2-shortcut"),
    "dev-reload": document.querySelector("#reload-shortcut"),
  };
  try {
    const cmds = await browser.commands.getAll();
    for (const [name, el] of Object.entries(map)) {
      if (!el) continue;
      const cmd = cmds.find((c) => c.name === name);
      el.textContent =
        cmd && cmd.shortcut ? prettyShortcut(cmd.shortcut) : "(unset)";
    }
  } catch (_) {
    for (const el of Object.values(map)) {
      if (el) el.textContent = "(unavailable)";
    }
  }
}

const PREFERRED_SPEED_KEY = "preferredSpeed";
const DEFAULT_PREFERRED_SPEED = 2.0;

async function loadVideoSpeed() {
  const input = document.querySelector("#preferred-speed");
  if (!input) return;
  const r = await browser.storage.local.get(PREFERRED_SPEED_KEY);
  const v = r[PREFERRED_SPEED_KEY];
  input.value = typeof v === "number" ? v : DEFAULT_PREFERRED_SPEED;
  input.addEventListener("change", async () => {
    const n = parseFloat(input.value);
    if (!Number.isFinite(n) || n < 0.1 || n > 16) {
      input.value = DEFAULT_PREFERRED_SPEED;
      return;
    }
    await browser.storage.local.set({ [PREFERRED_SPEED_KEY]: n });
  });
}

const MONO_KEY = "monoFavicons";
const monoList = document.querySelector("#mono-list");
const monoForm = document.querySelector("#mono-form");
const monoDomain = document.querySelector("#mono-domain");

async function loadMono() {
  if (!monoList) return;
  const { [MONO_KEY]: list = [] } = await browser.storage.local.get(MONO_KEY);
  monoList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "none.";
    monoList.appendChild(li);
    return;
  }
  for (const host of list) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = host;
    const btn = document.createElement("button");
    btn.className = "remove";
    btn.textContent = "remove";
    btn.addEventListener("click", async () => {
      const { [MONO_KEY]: cur = [] } = await browser.storage.local.get(MONO_KEY);
      await browser.storage.local.set({
        [MONO_KEY]: cur.filter((h) => h !== host),
      });
    });
    li.append(span, btn);
    monoList.appendChild(li);
  }
}

if (monoForm) {
  monoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const host = normalizeDomain(monoDomain.value);
    if (!host) return;
    const { [MONO_KEY]: cur = [] } = await browser.storage.local.get(MONO_KEY);
    if (cur.includes(host)) {
      monoDomain.value = "";
      return;
    }
    await browser.storage.local.set({ [MONO_KEY]: [...cur, host] });
    monoDomain.value = "";
    monoDomain.focus();
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[MONO_KEY]) loadMono();
});

async function loadBuildStamp() {
  const el = document.querySelector("#loaded-at");
  if (!el) return;
  const { __supern_loaded_at: ts } = await browser.storage.local.get(
    "__supern_loaded_at"
  );
  if (!ts) {
    el.textContent = "—";
    return;
  }
  const d = new Date(ts);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 8);
  el.textContent = `${date} ${time}`;
}

load();
loadSnoozed();
loadShortcuts();
loadVideoSpeed();
loadMono();
loadBuildStamp();
