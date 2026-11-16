#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const version = "10.8.0";
const args = process.argv.slice(2);
const result = spawnSync(
  "pnpm",
  ["dlx", `web-ext@${version}`, ...args],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
