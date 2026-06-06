(function () {
  const api = globalThis.browser || globalThis.chrome;
  if (!api) return;

  if (!globalThis.browser) {
    globalThis.browser = api;
  }

  const contextMenus =
    globalThis.browser.contextMenus ||
    (globalThis.chrome && globalThis.chrome.contextMenus);
  if (!globalThis.browser.menus && contextMenus) {
    globalThis.browser.menus = contextMenus;
  }
})();
