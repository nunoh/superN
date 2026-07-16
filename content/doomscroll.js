(function () {
  // Charge meter as the user scrolls fast; discharge while idle or slow.
  // Hits 100 → lock the page until the user takes a breath.
  const FAST_THRESHOLD = 2000; // px/s above this counts as "doomscrolling"
  const SLOW_THRESHOLD = 400;  // px/s below this lets the meter discharge
  const CHARGE_PER_PX = 0.01;  // % per (px/s above threshold) per second
  const CHARGE_CAP = 25;       // % per second, hard cap
  const DECAY_PER_SEC = 6;     // % per second of decay while slow / idle
  const TICK_MS = 200;
  const LOCK_DURATION_MS = 8000;
  const POST_LOCK_METER = 60;  // meter value after the lock clears

  // Timer's hard/soft block screen owns this document. Do not add a meter to
  // it when x.com is currently time-blocked.
  if (document.title.startsWith("blocked —")) return;

  let meter = 0;
  let locked = false;
  let lockTimer = null;
  let lastY = window.scrollY || 0;
  let lastTickMs = Date.now();

  const bar = document.createElement("div");
  bar.id = "__supern_doom__";
  const fill = document.createElement("div");
  fill.id = "__supern_doom_fill__";
  bar.appendChild(fill);
  bar.title = "doomscroll-o-meter";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "doomscroll meter");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");

  function attach() {
    if (!document.body) return;
    if (!bar.isConnected) document.body.appendChild(bar);
    positionNextToTimer();
  }

  function positionNextToTimer() {
    const timer = document.getElementById("__supern_timer__");
    if (timer) {
      const rect = timer.getBoundingClientRect();
      bar.style.left = (rect.right + 6) + "px";
      bar.style.top = rect.top + "px";
      bar.style.height = rect.height + "px";
    } else {
      bar.style.left = "8px";
      bar.style.top = "8px";
      bar.style.height = "20px";
    }
  }

  function colorFor(pct) {
    // green (120) → yellow (60) → red (0)
    const hue = Math.max(0, 120 - (pct * 1.2));
    const sat = 70 + Math.min(20, pct / 5);
    const light = 45 - Math.min(10, pct / 10);
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  function render() {
    fill.style.width = meter + "%";
    fill.style.background = colorFor(meter);
    bar.setAttribute("aria-valuenow", String(Math.round(meter)));
    if (meter > 80) {
      bar.classList.add("__supern_doom_warn__");
    } else {
      bar.classList.remove("__supern_doom_warn__");
    }
  }

  function tick() {
    if (document.visibilityState !== "visible") {
      lastTickMs = Date.now();
      lastY = window.scrollY || 0;
      return;
    }
    const now = Date.now();
    const dt = (now - lastTickMs) / 1000;
    lastTickMs = now;
    if (dt <= 0 || dt > 2) {
      lastY = window.scrollY || 0;
      return;
    }

    if (locked) {
      render();
      return;
    }

    const y = window.scrollY || 0;
    const speed = Math.abs(y - lastY) / dt;
    lastY = y;

    if (speed > FAST_THRESHOLD) {
      const charge = Math.min(CHARGE_CAP, (speed - FAST_THRESHOLD) * CHARGE_PER_PX);
      meter = Math.min(100, meter + charge * dt);
    } else if (speed < SLOW_THRESHOLD) {
      meter = Math.max(0, meter - DECAY_PER_SEC * dt);
    }

    positionNextToTimer();
    render();

    if (meter >= 100) lock();
  }

  let lockOverlay = null;
  let previousFocus = null;

  function blockScrollEvent(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function lock() {
    if (locked) return;
    locked = true;
    meter = 100;
    render();

    const prevOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body ? document.body.style.overflow : "";
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";

    window.addEventListener("wheel", blockScrollEvent, { passive: false, capture: true });
    window.addEventListener("touchmove", blockScrollEvent, { passive: false, capture: true });
    window.addEventListener("keydown", blockKeyScroll, { capture: true });

    lockOverlay = document.createElement("div");
    lockOverlay.id = "__supern_doom_overlay__";
    lockOverlay.setAttribute("role", "dialog");
    lockOverlay.setAttribute("aria-modal", "true");
    lockOverlay.setAttribute("aria-labelledby", "__supern_doom_title__");
    lockOverlay.tabIndex = -1;
    const card = document.createElement("div");
    card.className = "__supern_doom_card__";
    const title = document.createElement("div");
    title.id = "__supern_doom_title__";
    title.className = "__supern_doom_title__";
    title.textContent = "take a breath.";
    const msg = document.createElement("div");
    msg.className = "__supern_doom_msg__";
    msg.textContent = "you were scrolling fast. is this what you came for?";
    const btn = document.createElement("button");
    btn.className = "__supern_doom_dismiss__";
    btn.disabled = true;
    card.append(title, msg, btn);
    lockOverlay.appendChild(card);
    previousFocus = document.activeElement;
    document.body.appendChild(lockOverlay);
    lockOverlay.focus({ preventScroll: true });

    let secs = Math.floor(LOCK_DURATION_MS / 1000);
    btn.textContent = `dismiss (${secs}s)`;
    const countdown = setInterval(() => {
      secs -= 1;
      if (secs <= 0) {
        clearInterval(countdown);
        btn.disabled = false;
        btn.textContent = "dismiss";
      } else {
        btn.textContent = `dismiss (${secs}s)`;
      }
    }, 1000);

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      clearInterval(countdown);
      unlock(prevOverflow, prevBodyOverflow);
    });

    lockTimer = setTimeout(() => {
      clearInterval(countdown);
      // Auto-unlock as a safety net even if the button is ignored.
      if (locked) unlock(prevOverflow, prevBodyOverflow);
    }, LOCK_DURATION_MS + 1000);
  }

  function blockKeyScroll(e) {
    const keys = ["PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home", " ", "Spacebar", "Tab"];
    if (keys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function unlock(prevOverflow, prevBodyOverflow) {
    if (!locked) return;
    locked = false;
    if (lockTimer) clearTimeout(lockTimer);
    document.documentElement.style.overflow = prevOverflow || "";
    if (document.body) document.body.style.overflow = prevBodyOverflow || "";
    window.removeEventListener("wheel", blockScrollEvent, { capture: true });
    window.removeEventListener("touchmove", blockScrollEvent, { capture: true });
    window.removeEventListener("keydown", blockKeyScroll, { capture: true });
    if (lockOverlay) {
      lockOverlay.remove();
      lockOverlay = null;
    }
    if (previousFocus && previousFocus.isConnected) {
      try {
        previousFocus.focus({ preventScroll: true });
      } catch (_) {}
    }
    previousFocus = null;
    meter = POST_LOCK_METER;
    lastY = window.scrollY || 0;
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  } else {
    attach();
  }

  setInterval(tick, TICK_MS);
})();
