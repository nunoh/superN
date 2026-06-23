(function () {
  const STEP = 0.05;
  const MIN_RATE = 0.07;
  const MAX_RATE = 16;
  const SEEK_SECONDS = 10;
  const PREFERRED_KEY = "preferredSpeed";
  const DEFAULT_PREFERRED = 2.0;

  const REVEAL_ON_ATTACH_MS = 5000;
  const REVEAL_ON_INTERACTION_MS = 3000;

  let preferred = DEFAULT_PREFERRED;
  let pinned = false;
  let hideTimer = null;

  browser.storage.local.get(PREFERRED_KEY).then((r) => {
    if (typeof r[PREFERRED_KEY] === "number") preferred = r[PREFERRED_KEY];
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[PREFERRED_KEY]) return;
    const v = changes[PREFERRED_KEY].newValue;
    preferred = typeof v === "number" ? v : DEFAULT_PREFERRED;
  });

  const tracked = new Map();

  function fmt(rate) {
    return rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "x";
  }

  function clamp(r) {
    return Math.max(MIN_RATE, Math.min(MAX_RATE, r));
  }

  function setRateAll(mutator) {
    for (const [video, rec] of tracked) {
      const next = clamp(mutator(rec.lastSet));
      rec.lastSet = next;
      video.playbackRate = next;
      rec.label.textContent = fmt(next);
    }
  }

  function fullscreenBest() {
    let best = null, bestArea = 0;
    for (const video of tracked.keys()) {
      if (!video.isConnected) continue;
      const r = video.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = video; }
    }
    if (best) try { best.requestFullscreen(); } catch (_) {}
  }

  function seekAll(delta) {
    for (const video of tracked.keys()) {
      try {
        video.currentTime = Math.max(0, video.currentTime + delta);
      } catch (_) {}
    }
  }

  function showAll() {
    for (const { overlay } of tracked.values()) {
      overlay.classList.remove("hidden");
    }
  }

  function hideAll() {
    for (const { overlay } of tracked.values()) {
      overlay.classList.add("hidden");
    }
  }

  function reveal(ms) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    showAll();
    if (pinned) return;
    hideTimer = setTimeout(() => {
      hideAll();
      hideTimer = null;
    }, ms);
  }

  function togglePinned() {
    pinned = !pinned;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (pinned) showAll();
    else hideAll();
  }

  function isThumbnailPreview(video) {
    // Hover-preview videos on grid sites (YouTube, etc.) live inside the
    // thumbnail's link. Real player videos do not.
    return Boolean(video.closest("a"));
  }

  function attach(video) {
    if (tracked.has(video)) return;
    if (isThumbnailPreview(video)) return;

    const overlay = document.createElement("div");
    overlay.className = "__supern_speed__ hidden";

    const label = document.createElement("span");
    label.textContent = fmt(video.playbackRate);
    overlay.appendChild(label);

    const fsBtn = document.createElement("button");
    fsBtn.className = "__supern_speed_fs__";
    fsBtn.textContent = "⛶";
    fsBtn.title = "Fullscreen (F)";
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      try { video.requestFullscreen(); } catch (_) {}
    });
    overlay.appendChild(fsBtn);

    document.body.appendChild(overlay);

    const rec = {
      overlay,
      label,
      lastSet: video.playbackRate,
    };

    const onRateChange = () => {
      // Speed fightback — reapply our chosen rate when sites reset it.
      if (Math.abs(video.playbackRate - rec.lastSet) > 0.01) {
        video.playbackRate = rec.lastSet;
        return;
      }
      label.textContent = fmt(video.playbackRate);
    };
    video.addEventListener("ratechange", onRateChange);
    rec.detach = () => {
      video.removeEventListener("ratechange", onRateChange);
      overlay.remove();
    };

    tracked.set(video, rec);
    if (pinned) overlay.classList.remove("hidden");
    else reveal(REVEAL_ON_ATTACH_MS);
  }

  function detach(video) {
    const rec = tracked.get(video);
    if (!rec) return;
    rec.detach();
    tracked.delete(video);
  }

  function positionOverlays() {
    for (const [video, rec] of tracked) {
      if (!video.isConnected) {
        detach(video);
        continue;
      }
      const rect = video.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) {
        rec.overlay.style.display = "none";
        continue;
      }
      rec.overlay.style.display = "";
      rec.overlay.style.top = rect.top + 8 + "px";
      rec.overlay.style.left = rect.left + 8 + "px";
    }
    requestAnimationFrame(positionOverlays);
  }
  requestAnimationFrame(positionOverlays);

  function discover(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === "VIDEO") attach(root);
    else if (root.querySelectorAll) {
      for (const v of root.querySelectorAll("video")) attach(v);
    }
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) discover(n);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  discover(document);

  function inEditable(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(target.isContentEditable);
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inEditable(e.target)) return;
      if (tracked.size === 0) return;

      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        setRateAll((r) => r - STEP);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "d") {
        e.preventDefault();
        setRateAll((r) => r + STEP);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "z") {
        e.preventDefault();
        seekAll(-SEEK_SECONDS);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "x") {
        e.preventDefault();
        seekAll(SEEK_SECONDS);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "r") {
        e.preventDefault();
        setRateAll((r) => (Math.abs(r - preferred) < 0.01 ? 1 : preferred));
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "v") {
        e.preventDefault();
        togglePinned();
      } else if (k === "f") {
        e.preventDefault();
        fullscreenBest();
        reveal(REVEAL_ON_INTERACTION_MS);
      }
    },
    true
  );
})();
