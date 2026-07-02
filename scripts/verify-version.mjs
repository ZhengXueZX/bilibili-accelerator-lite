import fs from 'node:fs';

const version = fs.readFileSync('VERSION', 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const source = fs.readFileSync('src/bilibili-accelerator.user.js', 'utf8');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');

const errors = [];

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  errors.push(`VERSION must use semver x.y.z, got "${version}".`);
}

if (pkg.version !== version) {
  errors.push(`package.json version "${pkg.version}" does not match VERSION "${version}".`);
}

const userscriptVersion = source.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
if (userscriptVersion !== version) {
  errors.push(`userscript @version "${userscriptVersion}" does not match VERSION "${version}".`);
}

if (!changelog.includes(`## [${version}]`)) {
  errors.push(`CHANGELOG.md is missing an entry for ${version}.`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Version ${version} is consistent.`);
