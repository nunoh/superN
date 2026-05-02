(async function () {
  const BYPASS_KEY = "__supern_bypass__";

  function todayStr() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function hostMatches(entryDomain, host) {
    return host === entryDomain || host.endsWith("." + entryDomain);
  }

  function formatRemaining(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return (
        h +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0")
      );
    }
    return m + ":" + String(s).padStart(2, "0");
  }

  function parseHM(s) {
    const [h, m] = String(s).split(":").map(Number);
    return h * 60 + m;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function inWindow(win) {
    if (!win || !win.start || !win.end) return false;
    const now = nowMinutes();
    const s = parseHM(win.start);
    const e = parseHM(win.end);
    if (s === e) return false;
    if (s < e) return now >= s && now < e;
    // wraps midnight
    return now >= s || now < e;
  }

  function blockReasons(entry, usedSec) {
    const reasons = [];
    if (entry.blockWindow && inWindow(entry.blockWindow)) reasons.push("window");
    if (entry.minutes && usedSec >= entry.minutes * 60) reasons.push("budget");
    return reasons;
  }

  function reasonText(reasons) {
    if (reasons.includes("window")) return "outside allowed hours.";
    if (reasons.includes("budget")) return "daily time used.";
    return "blocked.";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  async function readState() {
    const stored = await browser.storage.local.get([
      "blocklist",
      "usage",
      "resetDate",
    ]);
    const today = todayStr();
    if (stored.resetDate !== today) {
      stored.usage = {};
      stored.resetDate = today;
      await browser.storage.local.set({
        usage: stored.usage,
        resetDate: stored.resetDate,
      });
    }
    return {
      blocklist: stored.blocklist || [],
      usage: stored.usage || {},
    };
  }

  const host = location.hostname;
  const state = await readState();
  const entry = state.blocklist.find((e) => hostMatches(e.domain, host));
  if (!entry) return;

  function fromExternalReferrer() {
    const ref = document.referrer;
    if (!ref) return false;
    let refHost;
    try {
      refHost = new URL(ref).hostname;
    } catch (_) {
      return false;
    }
    return !hostMatches(entry.domain, refHost);
  }

  const bypassed = (() => {
    try {
      if (sessionStorage.getItem(BYPASS_KEY) === "1") return true;
    } catch (_) {}
    return fromExternalReferrer();
  })();

  const budgetSec = entry.minutes ? entry.minutes * 60 : null;
  let usedSec = state.usage[entry.domain] || 0;
  let blocked = false;
  let overlay = null;
  let tickHandle = null;
  let persistHandle = null;

  function showBlocked(reasons) {
    if (blocked) return;
    blocked = true;
    if (tickHandle) clearInterval(tickHandle);
    if (persistHandle) clearInterval(persistHandle);
    try {
      window.stop();
    } catch (_) {}

    const isSoft = entry.mode === "soft";
    const msg = reasonText(reasons || []);
    const btnHtml = isSoft
      ? "<button id='__supern_bypass_btn__' disabled>open anyway (10s)</button>"
      : "";

    document.documentElement.innerHTML =
      '<head><meta charset="utf-8"><title>blocked — ' +
      escapeHtml(entry.domain) +
      '</title><style>' +
      "html,body{margin:0;padding:0;height:100%;background:#0e0e0e;color:#e8e8e8;" +
      "font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;}" +
      ".wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "height:100%;gap:.6rem;text-align:center;padding:2rem;}" +
      ".dom{font-size:1.6rem;font-weight:600;letter-spacing:-.01em;}" +
      ".msg{opacity:.75;}" +
      ".reset{opacity:.45;font-size:.85rem;margin-top:.5rem;}" +
      "#__supern_bypass_btn__{margin-top:1rem;font:inherit;padding:.5rem 1rem;" +
      "border-radius:.375rem;border:1px solid rgba(255,255,255,.22);" +
      "background:transparent;color:inherit;cursor:pointer;}" +
      "#__supern_bypass_btn__:disabled{cursor:not-allowed;opacity:.45;}" +
      "#__supern_bypass_btn__:not(:disabled):hover{background:rgba(255,255,255,.08);}" +
      "</style></head><body><div class='wrap'>" +
      "<div class='dom'>" +
      escapeHtml(entry.domain) +
      "</div>" +
      "<div class='msg'>" +
      escapeHtml(msg) +
      "</div>" +
      btnHtml +
      "<div class='reset'>resets at midnight.</div>" +
      "</div></body>";

    if (isSoft) {
      const btn = document.getElementById("__supern_bypass_btn__");
      if (!btn) return;
      let secs = 10;
      const countdown = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(countdown);
          btn.disabled = false;
          btn.textContent = "open anyway";
        } else {
          btn.textContent = "open anyway (" + secs + "s)";
        }
      }, 1000);
      btn.addEventListener("click", () => {
        try {
          sessionStorage.setItem(BYPASS_KEY, "1");
        } catch (_) {}
        location.reload();
      });
    }
  }

  if (!bypassed) {
    const initialReasons = blockReasons(entry, usedSec);
    if (initialReasons.length) {
      showBlocked(initialReasons);
      return;
    }
  }

  function ensureOverlay() {
    if (overlay || blocked) return;
    if (!document.body) return;
    if (!budgetSec) return;
    overlay = document.createElement("div");
    overlay.id = "__supern_timer__";
    overlay.textContent = formatRemaining(budgetSec - usedSec);
    document.body.appendChild(overlay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureOverlay, { once: true });
  } else {
    ensureOverlay();
  }

  let lastTickMs = Date.now();
  let dirtySec = 0;
  let scriptDay = todayStr();

  tickHandle = setInterval(() => {
    if (blocked) return;
    const now = Date.now();
    const dt = (now - lastTickMs) / 1000;
    lastTickMs = now;

    if (todayStr() !== scriptDay) {
      scriptDay = todayStr();
      usedSec = 0;
      dirtySec = 0;
    }

    const focused =
      document.visibilityState === "visible" && document.hasFocus();
    if (focused && dt < 5) {
      usedSec += dt;
      dirtySec += dt;
    }

    if (overlay && budgetSec) {
      overlay.textContent = formatRemaining(budgetSec - usedSec);
    }

    if (!bypassed) {
      const reasons = blockReasons(entry, usedSec);
      if (reasons.length) {
        persist(true).finally(() => showBlocked(reasons));
      }
    }
  }, 1000);

  async function persist(force) {
    if (!force && dirtySec < 5) return;
    const adding = dirtySec;
    dirtySec = 0;
    const cur = await readState();
    const newUsage = Object.assign({}, cur.usage);
    newUsage[entry.domain] = (newUsage[entry.domain] || 0) + adding;
    await browser.storage.local.set({ usage: newUsage });
    usedSec = newUsage[entry.domain];
  }

  persistHandle = setInterval(() => persist(false), 5000);
  window.addEventListener("beforeunload", () => persist(true));

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.usage) {
      const u = changes.usage.newValue || {};
      const remote = u[entry.domain] || 0;
      // Only update if remote is ahead (another tab is the active ticker).
      if (remote > usedSec) {
        usedSec = remote;
        if (overlay && budgetSec) {
          overlay.textContent = formatRemaining(budgetSec - usedSec);
        }
        if (!bypassed && budgetSec && usedSec >= budgetSec) {
          showBlocked(["budget"]);
        }
      } else if (remote === 0 && usedSec > 0) {
        // Daily reset happened elsewhere.
        usedSec = 0;
        if (overlay && budgetSec) {
          overlay.textContent = formatRemaining(budgetSec);
        }
      }
    }
    if (changes.blocklist) {
      const list = changes.blocklist.newValue || [];
      const e = list.find((x) => hostMatches(x.domain, host));
      if (!e) {
        // Removed from blocklist — tear down overlay.
        if (overlay) overlay.remove();
        if (tickHandle) clearInterval(tickHandle);
        if (persistHandle) clearInterval(persistHandle);
      }
    }
  });
})();
