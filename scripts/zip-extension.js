#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Zips the built `dist` folder for Chrome Web Store upload, named after the
// version in package.json (e.g. nodes-homepage-extension-1.3.0.zip).

import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

if (!existsSync(distDir)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

const pkg = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf-8"),
);
const zipName = `nodes-homepage-extension-${pkg.version}.zip`;
const zipPath = path.join(rootDir, zipName);

// Both tools append to an existing archive, which would leave files from an older
// build inside the upload.
rmSync(zipPath, { force: true });

// Passing the top-level entries (rather than ".") keeps "./" prefixes out of the
// archive's paths.
const entries = readdirSync(distDir);

if (process.platform === "win32") {
  // Windows has no `zip` binary, but ships bsdtar, which writes a zip (with forward
  // slash paths, as the Web Store expects) when given `-a` and a .zip name. It's
  // called by full path because Git Bash puts GNU tar, which can't write zips,
  // ahead of it on PATH.
  const bsdtar = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "tar.exe",
  );
  execFileSync(bsdtar, ["-a", "-c", "-f", zipPath, ...entries], {
    cwd: distDir,
    stdio: "inherit",
  });
} else {
  execFileSync("zip", ["-r", zipPath, ...entries], {
    cwd: distDir,
    stdio: "inherit",
  });
}

console.log(`\nPackaged ${zipName} — ready to upload to the Chrome Web Store.`);
