import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const artifactsDir = resolve("web-ext-artifacts");
const shouldPrint = process.argv.includes("--print");

const xpis = readdirSync(artifactsDir)
  .filter((name) => name.endsWith(".xpi"))
  .map((name) => {
    const path = join(artifactsDir, name);
    return { name, path, mtimeMs: statSync(path).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

const signedXpi = xpis.find((xpi) => xpi.name !== "supern.xpi");
const xpi = signedXpi || xpis[0];

if (!xpi) {
  console.error("No .xpi found in web-ext-artifacts. Run npm run build or npm run sign first.");
  process.exit(1);
}

const xpiPath = resolve(xpi.path);

if (shouldPrint) {
  console.log(xpiPath);
  process.exit(0);
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
