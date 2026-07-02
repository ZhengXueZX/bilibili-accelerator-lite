import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const check = spawnSync(process.execPath, ['scripts/verify-version.mjs'], {
  stdio: 'inherit',
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

fs.mkdirSync('outputs', { recursive: true });
fs.copyFileSync('src/bilibili-accelerator.user.js', 'outputs/bilibili-accelerator.user.js');

console.log('Copied src/bilibili-accelerator.user.js to outputs/bilibili-accelerator.user.js');
