// ==UserScript==
// @name         Bilibili Accelerator Lite
// @namespace    https://local.codex/bilibili-accelerator-lite
// @version      0.2.0
// @description  Reorders Bilibili video CDN URLs before playback and exposes diagnostics.
// @author       Codex
// @match        https://www.bilibili.com/*
// @match        https://www.bilibili.tv/*
// @match        https://*.bilibili.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const scriptWindow = window;

  const config = {
    debug: true,
    showBadge: true,

    slowHostHints: [
      'akamai',
      'akamaized',
      'upos-sz-mirrorakam',
      'upos-sz-mirrorhk',
      'cn-hk',
      'oversea',
      'bstarstatic',
    ],

    preferredHostHints: [
      'upos-sz-mirrorali',
      'upos-sz-mirrorcos',
      'upos-sz-mirrorhw',
      'upos-sz-mirror08',
      'upos-sz-estg',
      'bilivideo.com',
    ],

    enableHostSwapFallback: true,
    allowHostSwapForKnownVideoHosts: true,
    fallbackHosts: [
      'upos-sz-mirrorali.bilivideo.com',
      'upos-sz-mirrorcos.bilivideo.com',
      'upos-sz-mirrorhw.bilivideo.com',
    ],
  };

  const PLAYURL_PATTERNS = [
    '/x/player/playurl',
    '/x/player/wbi/playurl',
    '/pgc/player/web/v2/playurl',
    '/pgc/player/web/playurl',
  ];

  const URL_FIELDS = new Set([
    'baseUrl',
    'base_url',
    'baseURL',
    'url',
  ]);

  const BACKUP_FIELDS = new Set([
    'backupUrl',
    'backup_url',
    'backupURL',
  ]);

  const state = {
    version: '0.2.0',
    installedAt: new Date().toISOString(),
    fetchHooked: false,
    xhrHooked: false,
    playUrlRequests: 0,
    mediaObjectsSeen: 0,
    rewrites: 0,
    skips: 0,
    lastRequestUrl: '',
    lastDecision: null,
    decisions: [],
    errors: [],
  };

  let badge;

  function log(...args) {
    if (config.debug) {
      console.info('[Bilibili Accelerator Lite]', ...args);
    }
  }

  function remember(listName, item, limit) {
    state[listName].push(item);
    if (state[listName].length > limit) {
      state[listName].shift();
    }
  }

  function recordDecision(decision) {
    state.lastDecision = decision;
    remember('decisions', decision, 20);
    updateBadge();
  }

  function recordError(source, error) {
    const message = error && error.message ? error.message : String(error);
    remember('errors', {
      at: new Date().toISOString(),
      source,
      message,
    }, 10);
    log(`${source} skipped`, error);
    updateBadge();
  }

  function diagnostics() {
    return JSON.parse(JSON.stringify({
      config,
      state,
    }));
  }

  function showDiagnostics() {
    const data = diagnostics();
    console.info('[Bilibili Accelerator Lite] diagnostics', data);
    alert([
      'Bilibili Accelerator Lite',
      `version: ${state.version}`,
      `fetchHooked: ${state.fetchHooked}`,
      `xhrHooked: ${state.xhrHooked}`,
      `playUrlRequests: ${state.playUrlRequests}`,
      `mediaObjectsSeen: ${state.mediaObjectsSeen}`,
      `rewrites: ${state.rewrites}`,
      `skips: ${state.skips}`,
      '',
      'Open DevTools Console and run:',
      'window.__BILIBILI_ACCELERATOR_LITE__.diagnostics()',
    ].join('\n'));
  }

  function exposeDiagnostics() {
    pageWindow.__BILIBILI_ACCELERATOR_LITE__ = {
      config,
      state,
      diagnostics,
      showDiagnostics,
    };

    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Bilibili Accelerator diagnostics', showDiagnostics);
    }
  }

  function ensureBadge() {
    if (!config.showBadge || badge || !scriptWindow.document || !scriptWindow.document.body) return;

    badge = scriptWindow.document.createElement('button');
    badge.type = 'button';
    badge.textContent = 'BiliAccel 0/0';
    badge.title = 'Bilibili Accelerator Lite diagnostics';
    badge.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'padding:6px 8px',
      'border:1px solid rgba(255,255,255,.28)',
      'border-radius:6px',
      'background:rgba(20,20,24,.86)',
      'color:#fff',
      'font:12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
      'cursor:pointer',
      'box-shadow:0 4px 16px rgba(0,0,0,.24)',
    ].join(';');
    badge.addEventListener('click', showDiagnostics);
    scriptWindow.document.body.appendChild(badge);
    updateBadge();
  }

  function updateBadge() {
    if (!badge) return;

    const active = state.playUrlRequests > 0;
    badge.textContent = `BiliAccel ${state.rewrites}/${state.playUrlRequests}`;
    badge.style.background = active
      ? 'rgba(12,96,64,.9)'
      : 'rgba(20,20,24,.86)';
  }

  function scheduleBadge() {
    if (!config.showBadge) return;

    if (scriptWindow.document && scriptWindow.document.body) {
      ensureBadge();
      return;
    }

    scriptWindow.addEventListener('DOMContentLoaded', ensureBadge, { once: true });
  }

  function isPlayUrlRequest(input) {
    const raw = typeof input === 'string' ? input : input && input.url;
    if (!raw) return false;

    try {
      const url = new URL(raw, location.href);
      return PLAYURL_PATTERNS.some((pattern) => url.pathname.includes(pattern));
    } catch (_) {
      return PLAYURL_PATTERNS.some((pattern) => raw.includes(pattern));
    }
  }

  function requestToString(input) {
    const raw = typeof input === 'string' ? input : input && input.url;
    if (!raw) return '';

    try {
      return new URL(raw, location.href).href;
    } catch (_) {
      return String(raw);
    }
  }

  function getHost(rawUrl) {
    try {
      return new URL(rawUrl).hostname.toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function hasHint(host, hints) {
    return hints.some((hint) => host.includes(hint));
  }

  function isKnownVideoHost(host) {
    return host.endsWith('bilivideo.com')
      || host.includes('akamaized.net')
      || host.includes('bilibili.com')
      || host.includes('bstarstatic.com');
  }

  function scoreUrl(rawUrl) {
    const host = getHost(rawUrl);
    if (!host) return -100;

    let score = 0;
    if (hasHint(host, config.preferredHostHints)) score += 40;
    if (hasHint(host, config.slowHostHints)) score -= 60;
    if (host.endsWith('.bilivideo.com')) score += 10;
    if (host.includes('mirrorali') || host.includes('mirrorcos') || host.includes('mirrorhw')) score += 10;
    return score;
  }

  function uniqueUrls(urls) {
    const seen = new Set();
    return urls.filter((url) => {
      if (typeof url !== 'string' || !url.startsWith('http')) return false;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  function buildFallbackUrls(rawUrl) {
    if (!config.enableHostSwapFallback) return [];

    try {
      const source = new URL(rawUrl);
      const sourceHost = source.hostname.toLowerCase();
      if (!isKnownVideoHost(sourceHost)) return [];
      if (!hasHint(sourceHost, config.slowHostHints) && !config.allowHostSwapForKnownVideoHosts) return [];

      return config.fallbackHosts
        .filter((host) => host !== source.hostname)
        .map((host) => {
          const next = new URL(source.href);
          next.hostname = host;
          return next.href;
        });
    } catch (_) {
      return [];
    }
  }

  function readBackups(obj, backupKey) {
    if (!backupKey) return [];
    const backups = obj[backupKey];
    if (Array.isArray(backups)) return backups;
    if (typeof backups === 'string') return [backups];
    return [];
  }

  function writeBackups(obj, backupKey, backups) {
    if (!backupKey) return;
    obj[backupKey] = backups;
  }

  function rewriteMediaObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

    const baseKey = Object.keys(obj).find((key) => URL_FIELDS.has(key) && typeof obj[key] === 'string');
    const backupKey = Object.keys(obj).find((key) => BACKUP_FIELDS.has(key));
    if (!baseKey) return false;

    state.mediaObjectsSeen += 1;

    const originalBase = obj[baseKey];
    const backups = readBackups(obj, backupKey);
    const candidates = uniqueUrls([originalBase, ...backups, ...buildFallbackUrls(originalBase)]);
    const hosts = candidates.map(getHost);

    if (candidates.length < 2) {
      state.skips += 1;
      recordDecision({
        at: new Date().toISOString(),
        action: 'skip',
        reason: 'not enough candidates',
        originalHost: getHost(originalBase),
        hosts,
      });
      return false;
    }

    const sorted = candidates.slice().sort((a, b) => scoreUrl(b) - scoreUrl(a));
    const best = sorted[0];
    const changed = best !== originalBase;
    const backupsChanged = backupKey && backups.join('\n') !== sorted.filter((url) => url !== best).join('\n');

    if (!changed && !backupsChanged) {
      state.skips += 1;
      recordDecision({
        at: new Date().toISOString(),
        action: 'skip',
        reason: 'current base already best',
        originalHost: getHost(originalBase),
        hosts: sorted.map(getHost),
      });
      return false;
    }

    obj[baseKey] = best;
    writeBackups(obj, backupKey, sorted.filter((url) => url !== best));

    state.rewrites += 1;
    recordDecision({
      at: new Date().toISOString(),
      action: changed ? 'rewrite-base' : 'reorder-backups',
      from: getHost(originalBase),
      to: getHost(best),
      hosts: sorted.map(getHost),
    });

    log('media url decision', state.lastDecision);
    return true;
  }

  function rewriteDeep(value, rewriteState) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      for (const item of value) rewriteDeep(item, rewriteState);
      return;
    }

    if (rewriteMediaObject(value)) {
      rewriteState.changed = true;
    }

    for (const key of Object.keys(value)) {
      rewriteDeep(value[key], rewriteState);
    }
  }

  function rewritePlayUrlPayload(payload) {
    const rewriteState = { changed: false };
    rewriteDeep(payload, rewriteState);
    return rewriteState.changed;
  }

  function responseFromJson(originalResponse, data) {
    const headers = new Headers(originalResponse.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');

    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json;charset=utf-8');
    }

    return new Response(JSON.stringify(data), {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers,
    });
  }

  function markPlayUrlRequest(input, source) {
    state.playUrlRequests += 1;
    state.lastRequestUrl = requestToString(input);
    log(`${source} playurl request`, state.lastRequestUrl);
    updateBadge();
  }

  function hookFetch() {
    const rawFetch = pageWindow.fetch;
    if (typeof rawFetch !== 'function') return;

    pageWindow.fetch = async function (...args) {
      const isTarget = isPlayUrlRequest(args[0]);
      if (isTarget) markPlayUrlRequest(args[0], 'fetch');

      const response = await rawFetch.apply(this, args);
      if (!isTarget) return response;

      try {
        const clone = response.clone();
        const data = await clone.json();
        if (!rewritePlayUrlPayload(data)) return response;
        return responseFromJson(response, data);
      } catch (error) {
        recordError('fetch rewrite', error);
        return response;
      }
    };

    state.fetchHooked = true;
    log('fetch hook installed');
  }

  function hookXhr() {
    const XHR = pageWindow.XMLHttpRequest;
    if (!XHR || !XHR.prototype) return;

    const rawOpen = XHR.prototype.open;
    const rawSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url, ...rest) {
      this.__biliAcceleratorUrl = url;
      return rawOpen.call(this, method, url, ...rest);
    };

    XHR.prototype.send = function (...args) {
      if (isPlayUrlRequest(this.__biliAcceleratorUrl)) {
        markPlayUrlRequest(this.__biliAcceleratorUrl, 'xhr');

        this.addEventListener('readystatechange', function () {
          if (this.readyState !== 4) return;

          try {
            const text = this.responseText;
            if (!text || typeof text !== 'string') return;

            const data = JSON.parse(text);
            if (!rewritePlayUrlPayload(data)) return;

            const rewritten = JSON.stringify(data);
            Object.defineProperty(this, 'responseText', { value: rewritten, configurable: true });
            Object.defineProperty(this, 'response', { value: rewritten, configurable: true });
          } catch (error) {
            recordError('xhr rewrite', error);
          }
        });
      }

      return rawSend.apply(this, args);
    };

    state.xhrHooked = true;
    log('xhr hook installed');
  }

  exposeDiagnostics();
  scheduleBadge();
  hookFetch();
  hookXhr();
  updateBadge();
})();
