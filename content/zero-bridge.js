// Narrow bridge for the user-owned Zero LAN page. Nothing is enabled until
// the user clicks Connect SuperN there. The token never enters a URL.
(function () {
  if (location.origin !== 'https://zero.nh') return;
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'zero-supern-hello') {
      window.postMessage({ type: 'supern-zero-ready' }, location.origin);
    }
    if (event.data?.type !== 'zero-supern-pair' || !/^[a-f0-9]{64}$/.test(event.data.token)) return;
    try {
      const result = await browser.runtime.sendMessage({ type: 'supern-zero-pair', token: event.data.token });
      window.postMessage({ type: 'supern-zero-paired', ok: result?.ok === true, needsConsent: result?.needsConsent === true }, location.origin);
    } catch {
      window.postMessage({ type: 'supern-zero-paired', ok: false }, location.origin);
    }
  });
  window.postMessage({ type: 'supern-zero-ready' }, location.origin);
})();
