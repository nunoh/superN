# Privacy

SuperN does not collect, sell, or transmit personal data to the developer or
any analytics, advertising, or remote-settings service. It has no account
system and executes no remotely hosted code.

By default, extension state stays in the browser's local extension storage:

- time-block rules and daily per-domain usage totals;
- favicon host allowlist and preferred video speed; and
- pending snoozes (URL, page title, and wake time), until they are opened or
  cancelled.

SuperN does not persist activity from private browsing windows.

The extension requests site access because its chosen features alter the page:
time blocks, video controls, configured favicon conversion, Google navigation,
and the x.com doomscroll meter. Favicon conversion fetches the page-declared
favicon with credentials omitted and no referrer, then converts it locally to a
data URL. No favicon or browsing data is sent to the developer.

You can remove rules and pending snoozes from the settings page, or remove the
extension and its stored data from the browser's extension manager.

## Optional Zero connection

When you choose Connect SuperN on your own `https://zero.nh` dashboard, SuperN
sends only the number of Gmail Inbox conversations, the number of normal-window
tabs (excluding the first three pinned tabs), availability, and timestamps to
that LAN server. Gmail is read from the Inbox pagination already displayed in
your logged-in tab. Message contents, account addresses, tab URLs and titles,
and private-window activity are never included. No Google OAuth credentials or
cookies are copied. The connection token remains in local extension storage.

Reporting is disabled until you connect it. Firefox 140+ additionally requests
optional browsing-activity and website-content consent through Firefox's
built-in controls. You can disconnect in SuperN settings or revoke those
permissions in Firefox. Zero keeps the latest reported counts on your Bee
server; it does not send them to the developer or analytics services.
