(function () {
  const STEP = 0.1;
  const MIN_RATE = 0.07;
  const MAX_RATE = 16;
  const SEEK_SECONDS = 10;
  const PREFERRED_KEY = "preferredSpeed";
  const DEFAULT_PREFERRED = 2.0;

  let preferred = DEFAULT_PREFERRED;
  let overlaysHidden = false;

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
      rec.overlay.textContent = fmt(next);
    }
  }

  function seekAll(delta) {
    for (const video of tracked.keys()) {
      try {
        video.currentTime = Math.max(0, video.currentTime + delta);
      } catch (_) {}
    }
  }

  function setOverlaysHidden(hidden) {
    overlaysHidden = hidden;
    for (const { overlay } of tracked.values()) {
      overlay.classList.toggle("hidden", hidden);
    }
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
    overlay.className = "__supern_speed__";
    if (overlaysHidden) overlay.classList.add("hidden");
    overlay.textContent = fmt(video.playbackRate);
    document.body.appendChild(overlay);

    const rec = {
      overlay,
      lastSet: video.playbackRate,
    };

    const onRateChange = () => {
      // Speed fightback — reapply our chosen rate when sites reset it.
      if (Math.abs(video.playbackRate - rec.lastSet) > 0.01) {
        video.playbackRate = rec.lastSet;
        return;
      }
      overlay.textContent = fmt(video.playbackRate);
    };
    video.addEventListener("ratechange", onRateChange);
    rec.detach = () => {
      video.removeEventListener("ratechange", onRateChange);
      overlay.remove();
    };

    tracked.set(video, rec);
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
      } else if (k === "d") {
        e.preventDefault();
        setRateAll((r) => r + STEP);
      } else if (k === "z") {
        e.preventDefault();
        seekAll(-SEEK_SECONDS);
      } else if (k === "x") {
        e.preventDefault();
        seekAll(SEEK_SECONDS);
      } else if (k === "r") {
        e.preventDefault();
        setRateAll((r) => (Math.abs(r - preferred) < 0.01 ? 1 : preferred));
      } else if (k === "v") {
        e.preventDefault();
        setOverlaysHidden(!overlaysHidden);
      }
    },
    true
  );
})();
