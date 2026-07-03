# Bilibili Accelerator Lite

Bilibili Accelerator Lite is a conservative Chrome/Tampermonkey userscript for overseas Bilibili viewers. It tries to reduce buffering on cold or poorly cached videos by intercepting Bilibili playback URL responses and preferring faster CDN candidates from the URLs Bilibili already returns.

This is not a VPN, proxy, downloader, or access bypass tool. It only adjusts playback URL selection in the browser.

## What It Helps With

- Cold Bilibili videos that buffer or stall from overseas networks.
- Playback responses that include multiple `baseUrl` / `backupUrl` CDN candidates.
- Chrome users who want a lightweight, auditable userscript instead of a separate proxy app.

## What It Does Not Do

- It does not bypass member-only, login-only, copyright, or region restrictions.
- It does not read account credentials or upload browsing data.
- It does not download, cache, or redistribute video content.
- It cannot fix every network path; if no usable CDN candidate exists, improvement may be limited.

## Install

1. Install Tampermonkey in Chrome.
2. Open `outputs/bilibili-accelerator.user.js`.
3. Copy the file content into a new Tampermonkey script and save.
4. Open `https://www.bilibili.com` and test a video that usually buffers.
5. Check DevTools Console for `[Bilibili Accelerator Lite]` logs.

## Debugging

Version `0.2.1` shows a small `BiliAccel rewrites/sources` badge in the lower-right corner on Bilibili pages.

- `BiliAccel 0/0`: the script loaded, but no Bilibili playurl request or page playinfo assignment has been seen yet.
- `BiliAccel 0/2`: playback sources were seen, but no URL was changed.
- `BiliAccel 4/2`: playback sources were seen and several media URL objects were changed.

For full diagnostics, open DevTools Console and run:

```js
window.__BILIBILI_ACCELERATOR_LITE__.diagnostics()
```

You can also click the badge or use the Tampermonkey menu command `Bilibili Accelerator diagnostics`.

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
