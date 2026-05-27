#!/usr/bin/env node
// Usage: node scripts/bump-version.js <new-version>
// Updates version in both package.json and src-tauri/tauri.conf.json

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+/.test(newVersion)) {
  console.error('Usage: node scripts/bump-version.js <semver>');
  console.error('Example: node scripts/bump-version.js 1.3.0');
  process.exit(1);
}

function bumpJson(filePath, updater) {
  const content = JSON.parse(readFileSync(filePath, 'utf8'));
  const oldVersion = content.version;
  updater(content);
  writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ${filePath.replace(root, '.')}: ${oldVersion} → ${content.version}`);
}

console.log(`Bumping to v${newVersion}:`);

bumpJson(resolve(root, 'package.json'), (pkg) => {
  pkg.version = newVersion;
});

bumpJson(resolve(root, 'src-tauri/tauri.conf.json'), (cfg) => {
  cfg.version = newVersion;
});

const versionFilePath = resolve(root, 'src/version.ts');
writeFileSync(versionFilePath, `export const APP_VERSION = '${newVersion}';\n`);
console.log(`  ./src/version.ts: → ${newVersion}`);

console.log('');
console.log('Next steps:');
console.log(`  git add package.json src-tauri/tauri.conf.json src/version.ts`);
console.log(`  git commit -m "chore: release v${newVersion}"`);
console.log(`  git tag v${newVersion}`);
console.log(`  git push && git push --tags`);
