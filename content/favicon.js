(async function () {
  const STORE_KEY = "monoFavicons";
  const ICON_SELECTOR =
    'link[rel~="icon" i], link[rel="shortcut icon" i]';
  const ours = new Set(); // data URIs we produced — skip on observer fire-back

  function hostMatches(entryDomain, host) {
    return host === entryDomain || host.endsWith("." + entryDomain);
  }

  function active(list) {
    return list.some((d) => hostMatches(d, location.hostname));
  }

  const { [STORE_KEY]: initialList = [] } = await browser.storage.local.get(
    STORE_KEY
  );

  if (!active(initialList)) {
    // Not configured for this host. Reload if the user adds it later so the
    // change takes effect without a manual refresh.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORE_KEY]) return;
      const next = changes[STORE_KEY].newValue || [];
      if (active(next)) location.reload();
    });
    return;
  }

  async function toMono(url) {
    const res = await fetch(url, { credentials: "omit", cache: "force-cache" });
    if (!res.ok) throw new Error("favicon fetch " + res.status);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function processLink(link) {
    const href = link.getAttribute("href");
    if (!href || ours.has(href)) return;
    let abs;
    try {
      abs = new URL(href, location.href).href;
    } catch (_) {
      return;
    }
    try {
      const data = await toMono(abs);
      ours.add(data);
      // Re-check before write — the page may have swapped the icon meanwhile.
      if (link.getAttribute("href") === href) link.setAttribute("href", data);
    } catch (_) {
      // give up silently; original favicon stays
    }
  }

  async function injectDefault() {
    try {
      const data = await toMono("/favicon.ico");
      ours.add(data);
      const link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("href", data);
      document.head.appendChild(link);
    } catch (_) {}
  }

  function processAll() {
    const links = document.querySelectorAll(ICON_SELECTOR);
    if (links.length === 0) {
      injectDefault();
      return;
    }
    for (const l of links) processLink(l);
  }

  function watch() {
    processAll();
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.target.tagName === "LINK") {
          if (m.target.matches(ICON_SELECTOR)) processLink(m.target);
        } else if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node.nodeName === "LINK" && node.matches(ICON_SELECTOR)) {
              processLink(node);
            }
          }
        }
      }
    });
    obs.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel"],
    });
  }

  if (document.head) {
    watch();
  } else {
    const wait = new MutationObserver(() => {
      if (document.head) {
        wait.disconnect();
        watch();
      }
    });
    wait.observe(document.documentElement, { childList: true });
  }
})();
