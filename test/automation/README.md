自动化验证说明
=================

目的
---
提供一个可运行的 Playwright 脚本，自动在浏览器中打开 `test/test-upload.html`，选择本地视频文件并触发“使用本地文件并存储”按钮，然后验证 `storageManager.getAllVideos()` 是否包含新写入的记录。

准备
---
1. 你需要在本机安装 Node.js（>=14 推荐）和 npm。
2. 在项目根目录（包含 `index.html` 的目录）打开终端（PowerShell），然后安装 Playwright：

```powershell
npm init -y
npm i -D playwright
npx playwright install --with-deps
```

运行脚本
---
在项目根目录，运行：

```powershell
node test/automation/run-upload-test.js "C:\\path\\to\\your\\small-video.mp4"
```

脚本行为
---
- 启动 Chromium 打开 `http://localhost:8000/test/test-upload.html`（请确保你已在项目根启动静态服务器，例如 `python -m http.server 8000`）。
- 自动在页面选择提供的文件并点击“使用本地文件并存储”按钮。
- 调用页面内的 `storageManager.getAllVideos()` 并将返回结果打印到控制台（包含 id、uploadTime、file.size）。

注意
---
- Playwright 会控制一个完整的浏览器实例（非无头模式，便于调试）。
- 如果 `storageManager` 在页面中不可用，脚本会报告错误并退出。
- 脚本假定 `test/test-upload.html` 的元素 id 与仓库中的一致（`#localFileInput`, `#btnLocalUpload`）。

常见问题排查
---
- 未找到元素：检查 `test/test-upload.html` 是否与仓库中的文件一致，以及页面是否从 `http://localhost:8000` 加载而不是 `file://`。
- IndexedDB 写入失败（QuotaExceededError）：请尝试清理磁盘或使用更小文件；或者使用管理页 `test/storage-manager-admin.html` 删除旧记录。

扩展
---
- 你可以修改脚本以自动检查 `video-play.html?id=<新VideoId>` 是否能播放（通过在 new page 上查询 video element 的 readyState 或监听 `error` 事件）。

