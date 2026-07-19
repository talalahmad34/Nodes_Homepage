#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Zips the built `dist` folder for Chrome Web Store upload, named after the
// version in package.json (e.g. nodes-homepage-extension-1.3.0.zip).

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const zipName = `nodes-homepage-extension-${pkg.version}.zip`;
const zipPath = path.join(rootDir, zipName);

execFileSync('zip', ['-r', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });

console.log(`\nPackaged ${zipName} — ready to upload to the Chrome Web Store.`);
