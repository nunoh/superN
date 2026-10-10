import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

// Release-channel Firefox refuses unsigned add-ons, so installing the freshly
// built supern.xpi there silently does nothing — the previously installed
// signed build keeps running while looking freshly reloaded. This script
// therefore installs the newest *signed* artifact, and says out loud when that
// build is older than your working tree, so a stale install is never mistaken
// for a test of local changes. Use --local to install the unsigned build anyway
// (works in Developer Edition / Nightly with xpinstall.signatures.required off).

const artifactsDir = resolve("web-ext-artifacts");
const shouldPrint = process.argv.includes("--print");
const forceLocal = process.argv.includes("--local");
const LOCAL_BUILD = "supern.xpi";

const xpis = readdirSync(artifactsDir)
  .filter((name) => name.endsWith(".xpi"))
  .map((name) => {
    const path = join(artifactsDir, name);
    return { name, path, mtimeMs: statSync(path).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

const localBuild = xpis.find((x) => x.name === LOCAL_BUILD);
const signedXpi = xpis.find((x) => x.name !== LOCAL_BUILD);
const xpi = forceLocal ? localBuild : signedXpi || localBuild;

if (!xpi) {
  console.error(
    "No .xpi found in web-ext-artifacts. Run npm run build or npm run sign first."
  );
  process.exit(1);
}

const xpiPath = resolve(xpi.path);

if (shouldPrint) {
  console.log(xpiPath);
  process.exit(0);
}

const when = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
const isSigned = xpi.name !== LOCAL_BUILD;

console.log(
  `Installing ${xpi.name} (${isSigned ? "signed" : "UNSIGNED"}, built ${when(xpi.mtimeMs)})`
);

if (isSigned && localBuild && localBuild.mtimeMs > xpi.mtimeMs) {
  console.log(
    [
      "",
      "  !! This is the last SIGNED release, not your working tree.",
      `     ${LOCAL_BUILD} is newer (${when(localBuild.mtimeMs)}) but unsigned,`,
      "     and release-channel Firefox will not install it.",
      "",
      "  To test uncommitted changes, pick one:",
      "     npm run dev            — dev-profile Firefox, reloads on every save",
      "     about:debugging        — Load Temporary Add-on -> manifest.json",
      "     npm run release        — sign, then install for real",
      "",
    ].join("\n")
  );
}

const command =
  process.platform === "darwin"
    ? ["open", ["-a", process.env.FIREFOX_APP || "Firefox", xpiPath]]
    : [process.env.FIREFOX_BIN || "firefox", [xpiPath]];

const result = spawnSync(command[0], command[1], { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status || 0);
