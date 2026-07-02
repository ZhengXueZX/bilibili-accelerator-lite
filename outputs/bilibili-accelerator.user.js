// ==UserScript==
// @name         Bilibili Accelerator Lite
// @namespace    https://local.codex/bilibili-accelerator-lite
// @version      0.1.0
// @description  Reorders Bilibili video CDN URLs before playback to avoid slow overseas nodes.
// @author       Codex
// @match        https://www.bilibili.com/*
// @match        https://www.bilibili.tv/*
// @match        https://*.bilibili.com/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const config = {
    debug: true,

    // Domains containing these words are treated as likely slow from overseas.
    slowHostHints: [
      'akamai',
      'upos-sz-mirrorakam',
      'upos-sz-mirrorhk',
      'cn-hk',
      'hk',
      'oversea',
      'bstarstatic',
    ],

    // Domains containing these words are preferred when Bilibili already gives them as backups.
    preferredHostHints: [
      'upos-sz-mirrorali',
      'upos-sz-mirrorcos',
      'upos-sz-mirrorhw',
      'upos-sz-mirror08',
      'upos-sz-estg',
      'bilivideo.com',
    ],

    // Optional fallback. Used only when there is a base URL but no better backup URL.
    // Keep this conservative: changing hosts can fail if Bilibili changes signing rules.
    enableHostSwapFallback: true,
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
    'url',
  ]);

  const BACKUP_FIELDS = new Set([
    'backupUrl',
    'backup_url',
  ]);

  function log(...args) {
    if (config.debug) {
      console.info('[Bilibili Accelerator Lite]', ...args);
    }
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
      if (!sourceHost.endsWith('bilivideo.com')) return [];
      if (!hasHint(sourceHost, config.slowHostHints)) return [];

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

  function rewriteMediaObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

    const baseKey = Object.keys(obj).find((key) => URL_FIELDS.has(key) && typeof obj[key] === 'string');
    const backupKey = Object.keys(obj).find((key) => BACKUP_FIELDS.has(key) && Array.isArray(obj[key]));
    if (!baseKey) return false;

    const originalBase = obj[baseKey];
    const backups = backupKey ? obj[backupKey] : [];
    const candidates = uniqueUrls([originalBase, ...backups, ...buildFallbackUrls(originalBase)]);
    if (candidates.length < 2) return false;

    const sorted = candidates.slice().sort((a, b) => scoreUrl(b) - scoreUrl(a));
    const best = sorted[0];
    if (best === originalBase && (!backupKey || backups.join('\n') === sorted.slice(1).join('\n'))) {
      return false;
    }

    obj[baseKey] = best;
    if (backupKey) {
      obj[backupKey] = sorted.filter((url) => url !== best);
    }

    log('rewrote media url', {
      from: getHost(originalBase),
      to: getHost(best),
      candidates: sorted.map(getHost),
    });

    return true;
  }

  function rewriteDeep(value, state) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      for (const item of value) rewriteDeep(item, state);
      return;
    }

    if (rewriteMediaObject(value)) {
      state.changed = true;
    }

    for (const key of Object.keys(value)) {
      rewriteDeep(value[key], state);
    }
  }

  function rewritePlayUrlPayload(payload) {
    const state = { changed: false };
    rewriteDeep(payload, state);
    return state.changed;
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

  function hookFetch() {
    const rawFetch = w.fetch;
    if (typeof rawFetch !== 'function') return;

    w.fetch = async function (...args) {
      const response = await rawFetch.apply(this, args);
      if (!isPlayUrlRequest(args[0])) return response;

      try {
        const clone = response.clone();
        const data = await clone.json();
        if (!rewritePlayUrlPayload(data)) return response;
        return responseFromJson(response, data);
      } catch (error) {
        log('fetch rewrite skipped', error);
        return response;
      }
    };

    log('fetch hook installed');
  }

  function hookXhr() {
    const XHR = w.XMLHttpRequest;
    if (!XHR || !XHR.prototype) return;

    const rawOpen = XHR.prototype.open;
    const rawSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url, ...rest) {
      this.__biliAcceleratorUrl = url;
      return rawOpen.call(this, method, url, ...rest);
    };

    XHR.prototype.send = function (...args) {
      if (isPlayUrlRequest(this.__biliAcceleratorUrl)) {
        this.addEventListener('readystatechange', function () {
          if (this.readyState !== 4) return;

          try {
            const text = this.responseText;
            if (!text || typeof text !== 'string') return;

            const data = JSON.parse(text);
            if (!rewritePlayUrlPayload(data)) return;

            const rewritten = JSON.stringify(data);
            Object.defineProperty(this, 'responseText', { value: rewritten });
            Object.defineProperty(this, 'response', { value: rewritten });
          } catch (error) {
            log('xhr rewrite skipped', error);
          }
        });
      }

      return rawSend.apply(this, args);
    };

    log('xhr hook installed');
  }

  hookFetch();
  hookXhr();
})();
