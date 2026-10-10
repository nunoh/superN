(function () {
  // Sites listed in the manifest match list hijack browser keyboard shortcuts
  // (typically Cmd/Ctrl+digit for tab switching). Block the hijack in the
  // capture phase so the browser handles the shortcut normally.

  // event.code (not event.key) because modifiers change key values
  // (e.g. Shift+9 → "(").
  const DIGIT_CODES = new Set(
    Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`)
  );

  function hostMatches(entryDomain, host) {
    return host === entryDomain || host.endsWith("." + entryDomain);
  }

  // Per-host rules, because how much a site steals varies. Blocking every
  // modified key is right for a site that uses no shortcuts of its own, but
  // wrong for one whose own shortcuts are worth keeping.
  const RULES = [
    {
      // Steals plain digits too, and has no shortcuts worth keeping.
      domain: "rtve.es",
      isProtected: (event) =>
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        DIGIT_CODES.has(event.code),
    },
    {
      // Only take back Cmd/Ctrl+digit (with or without Shift) — the rest of
      // the ChatGPT shortcuts stay working.
      domain: "chatgpt.com",
      isProtected: (event) =>
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        DIGIT_CODES.has(event.code),
    },
  ];

  const rule = RULES.find((r) => hostMatches(r.domain, location.hostname));
  if (!rule) return;

  document.addEventListener(
    "keydown",
    (event) => {
      if (rule.isProtected(event)) event.stopImmediatePropagation();
    },
    true
  );
})();
