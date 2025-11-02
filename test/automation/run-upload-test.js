/**
 * Playwright 自动化脚本：上传本地文件并验证 storageManager 中存在条目
 *
 * 使用方法（在项目根执行）：
 * 1. 安装 Node 与 Playwright：
 *    npm init -y
 *    npm i -D playwright
 *    npx playwright install --with-deps
 *
 * 2. 运行脚本（提供本地视频文件路径作为第一个参数）：
 *    node test/automation/run-upload-test.js "C:\\path\\to\\small-video.mp4"
 *
 * 输出示例：脚本会打印是否在 storageManager 中找到新写入的视频记录。
 */

const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('请提供要上传的本地视频文件路径，例如: node run-upload-test.js C:\\temp\\small.mp4');
    process.exit(1);
  }

  const abs = path.resolve(filePath);
  console.log('使用文件：', abs);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = 'http://localhost:8000';
  const testUrl = `${base}/test/test-upload.html`;
  console.log('打开测试页：', testUrl);

  await page.goto(testUrl, { waitUntil: 'networkidle' });

  // 等待文件输入可用
  const input = await page.$('#localFileInput');
  if (!input) {
    console.error('页面上未找到 #localFileInput，请确认 test-upload.html 正确加载并包含该元素');
    await browser.close();
    process.exit(1);
  }

  // 设置文件
  await input.setInputFiles(abs);
  console.log('文件已选择，点击上传按钮...');

  // 点击上传按钮
  await Promise.all([
    page.waitForEvent('popup').catch(() => null), // 可能会打开播放页
    page.click('#btnLocalUpload')
  ]);

  // 等待少许时间，确保 storageManager 写入完成
  await page.waitForTimeout(2000);

  // 在页面上下文调用 storageManager.getAllVideos()
  const stored = await page.evaluate(async () => {
    try {
      if (window.storageManager && typeof window.storageManager.getAllVideos === 'function') {
        const list = await window.storageManager.getAllVideos();
        return { ok: true, count: list.length, items: list.map(i => ({ id: i.id, uploadTime: i.uploadTime, size: i.file && i.file.size })) };
      }
      return { ok: false, error: 'storageManager.getAllVideos 不可用' };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  });

  console.log('storageManager 返回：', stored);

  if (stored.ok) {
    console.log(`找到 ${stored.count} 条视频记录`);
    if (stored.count > 0) console.table(stored.items);
  } else {
    console.error('检查失败：', stored.error);
  }

  await browser.close();
  process.exit(stored.ok ? 0 : 2);
})();
