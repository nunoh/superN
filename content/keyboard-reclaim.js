(function () {
  // Sites listed in the manifest match list hijack browser keyboard shortcuts
  // (typically Cmd/Ctrl+digit for tab switching). Block the hijack in the
  // capture phase so the browser handles the shortcut normally.

  // event.code (not event.key) because modifiers change key values
  // (e.g. Shift+9 → "(").
  const PROTECTED_UNMODIFIED_CODES = new Set(
    Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`)
  );

  function isProtected(event) {
    // Anything with a modifier is almost certainly a browser/OS shortcut, not
    // something the page legitimately uses — block the whole class.
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    return PROTECTED_UNMODIFIED_CODES.has(event.code);
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (isProtected(event)) event.stopImmediatePropagation();
    },
    true
  );
})();
