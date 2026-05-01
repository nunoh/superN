(function () {
  // Each result row is an <a> wrapping an <h3> (organic results, "People also
  // ask" expansions, and most other Google blocks share this shape).
  // Filter out ads and hidden duplicates.
  function getResults() {
    return Array.from(document.querySelectorAll("a:has(h3)")).filter(
      (a) =>
        a.offsetParent !== null &&
        !a.closest(
          "[data-text-ad], [aria-label='Ad'], [aria-label='Ads'], .commercial-unit-desktop-top"
        )
    );
  }

  function inEditable(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(target.isContentEditable);
  }

  let cur = -1;
  let lastFocused = null;

  function highlight(el) {
    const target = el.querySelector("h3") || el;
    if (lastFocused && lastFocused !== target) {
      lastFocused.classList.remove("__supern_focus__");
    }
    target.classList.add("__supern_focus__");
    lastFocused = target;
  }

  function goto(idx) {
    const results = getResults();
    if (results.length === 0) return;
    cur = Math.max(0, Math.min(results.length - 1, idx));
    const el = results[cur];
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "start", behavior: "instant" });
    highlight(el);
  }

  function findSearchBox() {
    return document.querySelector(
      "textarea[name='q'], input[name='q'], textarea[aria-label*='Search']"
    );
  }

  function selectFirst() {
    const results = getResults();
    if (results.length === 0) return false;
    cur = 0;
    highlight(results[0]);
    return true;
  }

  if (!selectFirst()) {
    const obs = new MutationObserver(() => {
      if (selectFirst()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 5000);
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inEditable(e.target)) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        goto(cur < 0 ? 0 : cur + 1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        goto(cur < 0 ? 0 : cur - 1);
      } else if (e.key === "/") {
        const box = findSearchBox();
        if (box) {
          e.preventDefault();
          box.focus();
          if (typeof box.select === "function") box.select();
        }
      }
    },
    true
  );
})();
