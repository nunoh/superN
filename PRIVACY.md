# Privacy

SuperN does not collect, sell, or transmit personal data to the developer or
any analytics, advertising, or remote-settings service. It has no account
system and executes no remotely hosted code.

All extension state stays in the browser's local extension storage:

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
