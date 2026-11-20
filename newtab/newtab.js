(async function () {
  try {
    const { newTabUrl, newTabMode } = await browser.storage.local.get([
      "newTabUrl", "newTabMode",
    ]);
    if (typeof newTabUrl === "string" && newTabUrl.trim()) {
      const url = new URL(newTabUrl);
      if (["http:", "https:"].includes(url.protocol)) {
        if (newTabMode === "redirect") {
          location.replace(url.href);
          return;
        }
        // Keep the registered new-tab document as the top-level page so the
        // browser leaves its address bar empty and ready for a search.
        const frame = document.createElement("iframe");
        frame.title = "New tab page";
        frame.referrerPolicy = "no-referrer";
        frame.setAttribute("sandbox", [
          "allow-scripts", "allow-same-origin", "allow-forms", "allow-modals",
          "allow-popups", "allow-popups-to-escape-sandbox", "allow-downloads",
          "allow-top-navigation-by-user-activation",
          "allow-storage-access-by-user-activation",
        ].join(" "));
        frame.src = url.href;
        document.body.appendChild(frame);
        document.querySelector("#open-directly").href = url.href;
        document.querySelector("#page-tools").hidden = false;
        return;
      }
    }
  } catch (_) {}
  document.querySelector("#fallback").hidden = false;
})();
