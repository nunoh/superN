# Release checklist

SuperN is a single, local browser-productivity toolkit. The store listing must
name every page-modifying feature: time blocks, tab actions, snoozing, Google
result navigation, video controls, configured monochrome favicons, and the
x.com doomscroll meter. Do not describe it as only a time blocker.

## Privacy and permissions

Link the public store listing to the repository's `PRIVACY.md`. Complete the
Chrome Web Store data-use form truthfully: SuperN does not transmit user data
to the developer or any third party. Pending snooze URLs/titles, settings, and
usage totals are stored locally only. Private-window activity is not persisted.

The listing's permission justification should say:

- **Site access** — applies the user-facing time block, video controls,
  favicon conversion, Google navigation, and configured site-specific tools.
- **Storage** — stores settings, daily local usage totals, and pending snoozes.
- **Context menus and alarms** — lets users snooze a tab and reopen it later.
- **Web navigation** — distinguishes one external link navigation for the
  time-block bypass; it does not record browsing history.

## Before upload

1. Set the same release version in `manifest.json` and `package.json`; update
   `CHANGELOG.md`.
2. Run `npm run build`, `npm run package:chrome`, and `npm run cloc`.
3. Run `npx web-ext lint` with the same ignore list as `npm run build`.
4. Load `manifest.json` temporarily in Firefox. Load `dist/chrome/` unpacked
   in Chrome, then test the packaged `dist/supern-chrome.zip` in the Store's
   upload flow.
5. For AMO, submit the source repository/archive and build instructions, then
   use `npm run sign` for the listed release.

## Manual smoke tests

- Edit, remove, and add a time-block rule while its site is open; the page
  reloads and applies the new rule. Test overlapping parent/subdomain rules.
- In two windows, accumulate usage on two different blocked domains and verify
  both totals remain after a reload. Check the 4am reset boundary if practical.
- Follow an external link to a blocked site (one navigation bypasses); reload
  it and it blocks again. Internal links must not bypass.
- Snooze, cancel, and wake a normal tab. Repeat around a browser restart. Try
  snoozing in a private window and verify no item is saved.
- Hover a video: `S`, `D`, `Z`, `X`, `R`, `V`, and `F` affect only that video.
  Confirm ordinary typing on pages with background video is unaffected.
- Add and remove a favicon host. Confirm ordinary icons work and oversized or
  invalid favicon responses leave the original icon intact.
- Trigger the x.com meter; verify focus returns after dismissal and no meter
  appears on a time-block screen.
