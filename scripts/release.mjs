// One-command release: bump, changelog, commit, tag, sign, install, push.
//
//   npm run release           → patch
//   npm run release minor     → 0.11.0 → 0.12.0
//   npm run release 1.0.0     → explicit version
//
// The Infisical domain is deliberately not hardcoded: this repository is
// public. Put INFISICAL_DOMAIN in .env (gitignored) or the environment. The
// Infisical CLI prompts for a login itself when the session has expired.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const ENV = process.env.INFISICAL_ENV || "prod";
const CHANNEL = process.env.AMO_CHANNEL || "unlisted";

function die(message) {
  console.error("release: " + message);
  process.exit(1);
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) die(result.error.message);
  if (result.status !== 0) die(`${command} ${args.join(" ")} failed`);
  return capture ? result.stdout.trim() : "";
}

// .env is gitignored, so it is where machine-specific release config lives.
function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return die(`unknown bump "${bump}" — use patch, minor, major, or x.y.z`);
}

// Rewrite the version string in place rather than reformatting the JSON, so
// the diff stays one line per file. manifest.json in particular does not
// survive a JSON round-trip unchanged.
function setVersion(path, version) {
  const text = readFileSync(path, "utf8");
  const next = text.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${version}"`);
  if (next === text) die(`no version field found in ${path}`);
  writeFileSync(path, next);
}

// The lockfile carries the version twice — at the root and under packages[""].
// npm writes it as 2-space JSON with a trailing newline, so a round-trip here
// is byte-identical and safer than replacing one of two identical strings.
function setLockVersion(version) {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  lock.version = version;
  if (lock.packages && lock.packages[""]) lock.packages[""].version = version;
  writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
}

loadDotEnv();

const domain = process.env.INFISICAL_DOMAIN;
if (!domain) {
  die("INFISICAL_DOMAIN is not set. Add it to .env, e.g.\n" +
      "  echo 'INFISICAL_DOMAIN=https://infisical.example' >> .env");
}

if (run("git", ["status", "--porcelain"], { capture: true })) {
  die("working tree is dirty — commit or stash first, so the release ships\n" +
      "        exactly what is committed");
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes("## Unreleased")) {
  die("CHANGELOG.md has no '## Unreleased' section. Write the release notes\n" +
      "        under that heading first; this script stamps it with the version.");
}

const current = JSON.parse(readFileSync("package.json", "utf8")).version;
const version = nextVersion(current, process.argv[2] || "patch");
const today = new Date().toISOString().slice(0, 10);

console.log(`\n→ ${current} → ${version} (${CHANNEL})\n`);

setVersion("package.json", version);
setVersion("manifest.json", version);
setLockVersion(version);
writeFileSync(
  "CHANGELOG.md",
  changelog.replace("## Unreleased", `## ${today} (v${version})`)
);

run("npm", ["run", "verify"]);
run("git", ["add", "package.json", "package-lock.json", "manifest.json", "CHANGELOG.md"]);
run("git", ["commit", "-m", `chore(release): bump version to ${version}`]);
run("git", ["tag", `v${version}`]);

// stdio is inherited, so the Infisical CLI can run its own login flow here.
run("infisical", [
  "run", `--domain=${domain}`, `--env=${ENV}`, "--path=/", "--silent",
  "--", "npm", "run", CHANNEL === "listed" ? "sign" : "sign:unlisted",
]);

run("npm", ["run", "install-ext"]);
run("git", ["push", "--follow-tags"]);

console.log(`\n✓ v${version} signed, installed, and pushed.\n`);
