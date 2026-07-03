import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/bilibili-accelerator.user.js', 'utf8');

const samplePayload = {
  code: 0,
  data: {
    dash: {
      video: [
        {
          baseUrl: 'https://upos-sz-mirrorakam.akamaized.net/upgcxcode/sample/video.m4s?deadline=1',
          backupUrl: [
            'https://upos-sz-mirrorali.bilivideo.com/upgcxcode/sample/video.m4s?deadline=1',
            'https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/sample/video.m4s?deadline=1',
          ],
        },
      ],
      audio: [
        {
          base_url: 'https://upos-sz-mirrorhk.bilivideo.com/upgcxcode/sample/audio.m4s?deadline=1',
          backup_url: [
            'https://upos-sz-mirrorhw.bilivideo.com/upgcxcode/sample/audio.m4s?deadline=1',
          ],
        },
      ],
    },
  },
};

const pageWindow = {
  fetch: async () => new Response(JSON.stringify(samplePayload), {
    headers: {
      'content-type': 'application/json;charset=utf-8',
    },
  }),
  XMLHttpRequest: function XMLHttpRequest() {},
};

pageWindow.XMLHttpRequest.prototype = {
  open() {},
  send() {},
};

const scriptWindow = {
  document: {
    body: null,
  },
  addEventListener() {},
};

const context = vm.createContext({
  unsafeWindow: pageWindow,
  window: scriptWindow,
  location: {
    href: 'https://www.bilibili.com/video/BV1test',
  },
  console,
  alert() {},
  GM_registerMenuCommand() {},
  URL,
  Set,
  Date,
  JSON,
  Response,
  Headers,
});

vm.runInContext(source, context);

assert.equal(typeof pageWindow.fetch, 'function');
assert.equal(typeof pageWindow.__BILIBILI_ACCELERATOR_LITE__.diagnostics, 'function');

const response = await pageWindow.fetch('https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1test');
const rewritten = await response.json();
const diagnostics = pageWindow.__BILIBILI_ACCELERATOR_LITE__.diagnostics();

assert.equal(diagnostics.state.playUrlRequests, 1);
assert.equal(diagnostics.state.rewrites, 2);
assert.equal(
  new URL(rewritten.data.dash.video[0].baseUrl).hostname,
  'upos-sz-mirrorali.bilivideo.com',
);
assert.equal(
  new URL(rewritten.data.dash.audio[0].base_url).hostname,
  'upos-sz-mirrorhw.bilivideo.com',
);

pageWindow.__playinfo__ = JSON.parse(JSON.stringify(samplePayload));
const playInfoDiagnostics = pageWindow.__BILIBILI_ACCELERATOR_LITE__.diagnostics();
assert.equal(playInfoDiagnostics.state.playInfoAssignments, 1);
assert.equal(
  new URL(pageWindow.__playinfo__.data.dash.video[0].baseUrl).hostname,
  'upos-sz-mirrorali.bilivideo.com',
);

console.log('Smoke test passed.');
