(function () {
  const STEP = 0.1;
  const FINE_STEP = 0.05;
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
  let activeVideo = null;
  let positionFrame = null;

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

  function setRate(videos, mutator) {
    for (const video of videos) {
      const rec = tracked.get(video);
      if (!rec) continue;
      const next = clamp(mutator(rec.lastSet));
      rec.lastSet = next;
      video.playbackRate = next;
      rec.label.textContent = fmt(next);
    }
  }

  function fullscreen(video) {
    if (video) try { video.requestFullscreen(); } catch (_) {}
  }

  function seek(videos, delta) {
    for (const video of videos) {
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
    if (!document.body) return;

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
      activeVideo = video;
      fullscreen(video);
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
      video.removeEventListener("pointerenter", onPointerEnter);
      video.removeEventListener("pointerdown", onPointerEnter);
      rec.resizeObserver.disconnect();
      overlay.remove();
    };

    const onPointerEnter = () => {
      activeVideo = video;
      reveal(REVEAL_ON_INTERACTION_MS);
      schedulePositioning();
    };
    video.addEventListener("pointerenter", onPointerEnter);
    video.addEventListener("pointerdown", onPointerEnter);
    rec.resizeObserver = new ResizeObserver(schedulePositioning);
    rec.resizeObserver.observe(video);

    tracked.set(video, rec);
    if (pinned) overlay.classList.remove("hidden");
    else reveal(REVEAL_ON_ATTACH_MS);
    schedulePositioning();
  }

  function detach(video) {
    const rec = tracked.get(video);
    if (!rec) return;
    rec.detach();
    tracked.delete(video);
    if (activeVideo === video) activeVideo = null;
  }

  function positionOverlays() {
    positionFrame = null;
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
  }

  function schedulePositioning() {
    if (
      positionFrame ||
      tracked.size === 0 ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    positionFrame = requestAnimationFrame(positionOverlays);
  }

  window.addEventListener("scroll", schedulePositioning, { passive: true, capture: true });
  window.addEventListener("resize", schedulePositioning, { passive: true });
  document.addEventListener("visibilitychange", schedulePositioning);

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

  function activeTrackedVideo() {
    if (!activeVideo || !tracked.has(activeVideo) || !activeVideo.isConnected) {
      return null;
    }
    const rect = activeVideo.getBoundingClientRect();
    return rect.width >= 40 && rect.height >= 40 ? activeVideo : null;
  }

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
      const video = activeTrackedVideo();
      if (!video) return;

      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        setRate([video], (r) => r - (e.shiftKey ? FINE_STEP : STEP));
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "d") {
        e.preventDefault();
        setRate([video], (r) => r + (e.shiftKey ? FINE_STEP : STEP));
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "z") {
        e.preventDefault();
        seek([video], -SEEK_SECONDS);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "x") {
        e.preventDefault();
        seek([video], SEEK_SECONDS);
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "r") {
        e.preventDefault();
        setRate([video], (r) => (Math.abs(r - preferred) < 0.01 ? 1 : preferred));
        reveal(REVEAL_ON_INTERACTION_MS);
      } else if (k === "v") {
        e.preventDefault();
        togglePinned();
      } else if (k === "f") {
        e.preventDefault();
        fullscreen(video);
        reveal(REVEAL_ON_INTERACTION_MS);
      }
    },
    true
  );
})();
