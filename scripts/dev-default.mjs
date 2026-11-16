import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = "default-release";
const port = Number(process.env.SUPERN_DEBUG_PORT || 60123);
const setup = `One-time setup in Firefox's default-release profile:
  Open about:config and set:
    devtools.debugger.remote-enabled = true
    devtools.chrome.enabled = true
    devtools.debugger.force-local = true (keep debugging local)
  Then quit Firefox completely and run npm run dev:default.
  Accept Firefox's debugging connection prompt when it appears.

After setup, this command loads the working tree and reloads on save.
If Firefox was opened normally, quit it before running this command.
Ctrl-C stops watching and leaves Firefox open. The add-on is temporary:
after Firefox restarts normally, the installed signed version is restored.
`;

if (process.argv.includes("--help")) {
  console.log(setup);
  process.exit(0);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("SUPERN_DEBUG_PORT must be a port number from 1 to 65535.");
  process.exit(1);
}

// Reuse the debugger client already shipped by our locked web-ext dependency.
// Do not use web-ext's profile setup: it changes many unrelated preferences.
const require = createRequire(import.meta.url);
const webExtRoot = dirname(require.resolve("web-ext"));
const { connect, connectWithMaxRetries } = await import(
  pathToFileURL(resolve(webExtRoot, "lib/firefox/remote.js")).href
);
let remote;
const watchers = [];
let timer;
let queue = Promise.resolve();
let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  remote?.disconnect();
}

try {
  try {
    remote = await connect(port);
    console.log(`Connected to Firefox's existing debugger on localhost:${port}.`);
  } catch (error) {
    if (error.code !== "ECONNREFUSED" || process.argv.includes("--attach")) {
      throw error;
    }
    console.log(`Starting Firefox profile ${profile}.\n${setup}`);
    const binary = process.env.FIREFOX_BIN ||
      (process.platform === "darwin"
        ? "/Applications/Firefox.app/Contents/MacOS/firefox"
        : "firefox");
    const child = spawn(binary, [
      "-P", profile, "-no-remote", "-start-debugger-server", String(port),
    ], { detached: true, stdio: "ignore" });
    await new Promise((resolveSpawn, reject) => {
      child.once("spawn", resolveSpawn);
      child.once("error", reject);
    });
    child.unref();
    remote = await connectWithMaxRetries({ port, maxRetries: 100, retryInterval: 200 });
  }

  const install = async () => {
    const result = await remote.installTemporaryAddon(root, false);
    if (!result.addon?.id) throw new Error("Firefox did not return an add-on ID.");
    console.log(`Loaded local SuperN at ${new Date().toLocaleTimeString()}.`);
  };
  await install();
  if (process.argv.includes("--once")) {
    stop();
  } else {
    // Only watch shipped source paths, never the active Firefox profile.
    const rootFiles = new Set([
      "manifest.json", "background.js", "background-chrome.js", "browser-api.js",
    ]);
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Serialize installs when several files are saved together.
        queue = queue.then(install).catch(error => console.error(error.message));
      }, 300);
    };
    watchers.push(watch(root, (_, filename) => {
      if (filename && rootFiles.has(String(filename))) changed();
    }));
    for (const dir of ["content", "options", "newtab", "icons"]) {
      watchers.push(watch(resolve(root, dir), { recursive: true }, changed));
    }
    console.log("Watching local source. Ctrl-C stops watching; Firefox stays open.");
    remote.client.on("disconnect", () => { stop(); process.exit(0); });
    remote.client.on("end", () => { stop(); process.exit(0); });
    process.once("SIGINT", () => { stop(); process.exit(0); });
    process.once("SIGTERM", () => { stop(); process.exit(0); });
  }
} catch (error) {
  stop();
  console.error(`Could not load SuperN: ${error.message}\n\n${setup}`);
  process.exitCode = 1;
}
