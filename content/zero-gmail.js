// Read only Inbox pagination. Never use the title/sidebar (unread counts),
// message rows, cookies, or Gmail's private network endpoints.
(function () {
  function parseRange(text) {
    const normalized = text.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
    // Gmail localizes the separator word; require a range and exactly three
    // numbers, so unrelated toolbar badges cannot become an inbox count.
    const match = /^([\d.,\s]+)\s*[-–—]\s*([\d.,\s]+)\s+[^\d]+\s+([\d.,\s]+)$/.exec(normalized);
    if (!match || /about|approximately|cerca|aprox|environ|ungefähr|mais de|more than/i.test(normalized)) return null;
    const [start, end, total] = match.slice(1).map(value => Number(value.replace(/\D/g, '')));
    if (!Number.isSafeInteger(total) || total > 10_000_000 || start < 1 || end < start || total < end) return null;
    return total;
  }
  function readInbox() {
    const unavailable = reason => ({ available: false, reason, observedAt: Date.now() });
    if (!/^#inbox(?:\/p\d+)?$/.test(location.hash)) return unavailable('not-inbox');
    const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const main = [...document.querySelectorAll('[role="main"]')].find(shown);
    if (!main) return unavailable('loading');
    // Category/priority/multiple inboxes can expose a subtotal. Fail closed
    // rather than silently report that as the total inbox.
    if ([...main.querySelectorAll('[role="tab"]')].some(shown)) return unavailable('unreadable');
    const sectionHeaders = [...main.querySelectorAll('.Wg')].filter(shown);
    if (sectionHeaders.length) {
      // Verified against the user's Unread first layout. Each header's
      // parent contains its own pagination and explicit empty-state message.
      const names = sectionHeaders.map(el => el.querySelector('[role="button"]')?.textContent.trim());
      if (sectionHeaders.length !== 2 || !names.includes('Unread') || !names.includes('Everything else')) return unavailable('unreadable');
      let total = 0;
      for (const header of sectionHeaders) {
        const section = header.parentElement;
        const ranges = [...header.querySelectorAll('.Dj')].filter(shown).map(el => parseRange(el.textContent || '')).filter(n => n !== null);
        if (ranges.length === 1) { total += ranges[0]; continue; }
        const empty = [...section.querySelectorAll('.qd')].some(el => shown(el) &&
          /^(Woohoo! You've read all the messages in your inbox\.|No conversations in this section\.|No conversations in Inbox\.|Your inbox is empty\.)$/.test(el.textContent.trim()));
        if (!empty) return unavailable('unreadable');
      }
      return { available: true, count: total, observedAt: Date.now() };
    }
    const ranges = [...document.querySelectorAll('.G-atb .Dj, [role="main"] .Dj, [role="main"] [aria-label]')]
      .filter(shown).map(el => parseRange(el.textContent || '') ?? parseRange(el.getAttribute('aria-label') || ''))
      .filter(value => value !== null);
    const totals = [...new Set(ranges)];
    if (totals.length === 1) return { available: true, count: totals[0], observedAt: Date.now() };
    // Explicit empty-state text only. A missing range is not proof of zero.
    const empty = [...main.querySelectorAll('.aRv, .aRu, .qd')].some(el => shown(el) &&
      /^(Your inbox is empty\.?|No new mail!|No conversations in Inbox\.?|A sua caixa de entrada est[áa] vazia\.?|Nenhuma conversa na caixa de entrada\.?)$/i.test(el.textContent.trim()));
    if (empty) return { available: true, count: 0, observedAt: Date.now() };
    return unavailable('unreadable');
  }
  // Polling is requested by the background alarm, even in an inactive tab.
  browser.runtime.onMessage.addListener(message => {
    if (message?.type === 'supern-zero-read-inbox') return Promise.resolve(readInbox());
  });
  let timer;
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => browser.runtime.sendMessage({ type: 'supern-zero-gmail-changed' }).catch(() => {}), 1500);
  };
  new MutationObserver(changed).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', changed);
})();
