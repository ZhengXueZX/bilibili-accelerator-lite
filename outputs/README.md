# Bilibili Accelerator Lite

这是一个给 Chrome + Tampermonkey 使用的 B 站播放地址加速脚本 MVP。

它做的事情很简单：

1. 在 `document-start` 阶段 hook `fetch` 和 `XMLHttpRequest`。
2. 只处理 B 站播放地址接口，例如 `/x/player/wbi/playurl`。
3. 在接口返回的 `baseUrl` / `backupUrl` 中选择更可能快的 CDN 地址。
4. 如果没有更好的备选地址，会按配置尝试把慢 host 换成常见的 `bilivideo.com` mirror host。

它不做这些事情：

- 不读取账号密码。
- 不上传任何数据。
- 不绕过会员、版权、登录或地区限制。
- 不下载视频。

## Chrome 安装方式

1. 安装 Tampermonkey。
2. 打开 Tampermonkey 管理面板。
3. 新建脚本。
4. 把 `bilibili-accelerator.user.js` 的内容粘进去并保存。
5. 打开 `https://www.bilibili.com`，播放一个平时容易卡的冷门视频。
6. 打开 DevTools Console，可以看到 `[Bilibili Accelerator Lite]` 日志。

## 调整配置

脚本顶部的 `config` 可以改：

- `debug`: 是否输出 console 日志。
- `slowHostHints`: 遇到这些 host 关键词时认为可能慢。
- `preferredHostHints`: 遇到这些 host 关键词时优先使用。
- `enableHostSwapFallback`: 是否在没有好备选时尝试换 host。
- `fallbackHosts`: fallback 目标 host 列表。

如果发现某个 host 换过去会 403 或无法播放，把 `enableHostSwapFallback` 改成 `false`，脚本就只会使用 B 站原本返回的备选地址。
