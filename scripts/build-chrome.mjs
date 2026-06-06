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
cpSync(join(root, "icons/icon.svg"), join(outDir, "icons/icon.svg"));

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

delete manifest.browser_specific_settings;
manifest.minimum_chrome_version = "121";
manifest.permissions = manifest.permissions.map((permission) =>
  permission === "menus" ? "contextMenus" : permission
);
manifest.background = {
  service_worker: "background-chrome.js",
};
manifest.content_scripts = manifest.content_scripts.map((script) => ({
  ...script,
  js: ["browser-api.js", ...(script.js || [])],
}));

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(outDir);
