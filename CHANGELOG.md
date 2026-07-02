# Changelog

All notable changes to this project are tracked here.

## [0.2.0] - 2026-07-02

- Added visible in-page diagnostics badge showing rewrite count and playurl request count.
- Exposed `window.__BILIBILI_ACCELERATOR_LITE__.diagnostics()` for DevTools debugging.
- Recorded playurl requests, CDN candidates, rewrite decisions, skip reasons, and rewrite errors.
- Added Tampermonkey menu command for diagnostics.
- Broadened host detection for Akamai-style Bilibili video URLs.
- Added a local smoke test for playurl rewrite behavior.

## [0.1.0] - 2026-07-01

- Added Chrome/Tampermonkey userscript MVP.
- Hooks Bilibili playurl requests via `fetch` and `XMLHttpRequest`.
- Reorders `baseUrl` and `backupUrl` candidates by configurable CDN host hints.
- Adds conservative host-swap fallback for slow `bilivideo.com` mirrors.
- Keeps behavior limited to playback URL selection; no account, cookie, upload, payment, or region bypass logic.
