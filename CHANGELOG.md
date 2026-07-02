# Changelog

All notable changes to this project are tracked here.

## [0.1.0] - 2026-07-01

- Added Chrome/Tampermonkey userscript MVP.
- Hooks Bilibili playurl requests via `fetch` and `XMLHttpRequest`.
- Reorders `baseUrl` and `backupUrl` candidates by configurable CDN host hints.
- Adds conservative host-swap fallback for slow `bilivideo.com` mirrors.
- Keeps behavior limited to playback URL selection; no account, cookie, upload, payment, or region bypass logic.
