# Bilibili Accelerator Lite

A small Chrome/Tampermonkey userscript for improving slow Bilibili playback from overseas by reordering playback CDN URLs.

## Install

1. Install Tampermonkey in Chrome.
2. Open `outputs/bilibili-accelerator.user.js`.
3. Copy the file content into a new Tampermonkey script and save.
4. Open `https://www.bilibili.com` and test a video that usually buffers.
5. Check DevTools Console for `[Bilibili Accelerator Lite]` logs.

## Project Layout

- `src/bilibili-accelerator.user.js`: source userscript.
- `outputs/bilibili-accelerator.user.js`: installable release copy.
- `VERSION`: current release version.
- `CHANGELOG.md`: human-readable release history.
- `scripts/verify-version.mjs`: checks version consistency.
- `scripts/release.mjs`: verifies and copies source into `outputs`.

## Release Workflow

1. Edit `src/bilibili-accelerator.user.js`.
2. Bump the version in all three places:
   - `VERSION`
   - `package.json`
   - the userscript `@version` line
3. Add a new top entry to `CHANGELOG.md`.
4. Run `npm run check`.
5. Run `npm run release`.
6. Commit the result and tag it, for example:

```powershell
git add .
git commit -m "Release v0.1.1"
git tag v0.1.1
```

## Safety Boundary

This script only changes playback URL choice. It does not read account credentials, upload data, download videos, or bypass member-only, login-only, copyright, or region restrictions.
