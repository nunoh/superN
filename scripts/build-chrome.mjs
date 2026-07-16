import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const outDir = resolve("dist/chrome");
const files = [
  "background.js",
  "background-chrome.js",
  "browser-api.js",
  "content",
  "options",
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const file of files) {
  cpSync(join(root, file), join(outDir, file), { recursive: true });
}
mkdirSync(join(outDir, "icons"), { recursive: true });
for (const size of [16, 32, 48, 96, 128]) {
  cpSync(
    join(root, `icons/icon-${size}.png`),
    join(outDir, `icons/icon-${size}.png`)
  );
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

delete manifest.browser_specific_settings;
// contextMenus.removeAll() returns a Promise from Chrome 123 onwards. The
// shared background uses that promise to recreate menus safely on updates.
manifest.minimum_chrome_version = "123";
manifest.permissions = manifest.permissions.map((permission) =>
  permission === "menus" ? "contextMenus" : permission
);
manifest.background = {
  service_worker: "background-chrome.js",
};
manifest.icons = Object.fromEntries(
  [48, 96, 128].map((size) => [size, `icons/icon-${size}.png`])
);
manifest.action.default_icon = Object.fromEntries(
  [16, 32, 48].map((size) => [size, `icons/icon-${size}.png`])
);
manifest.content_scripts = manifest.content_scripts.map((script) => ({
  ...script,
  js: ["browser-api.js", ...(script.js || [])],
}));

// Chrome allows only four commands with suggested keyboard shortcuts. Keep the
// primary tab-management shortcuts; the remaining commands still appear in
// chrome://extensions/shortcuts for users who want to assign them manually.
for (const name of ["recent-1", "recent-2", "dev-reload"]) {
  delete manifest.commands[name].suggested_key;
}

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(outDir);
