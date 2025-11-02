# StreamFlix 静态网站部署指南

## 部署到 GitHub Pages

### 步骤1：创建仓库
1. 在 GitHub 上创建一个新仓库
2. 将仓库克隆到本地

### 步骤2：推送代码
1. 将所有文件添加到仓库：
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 步骤3：配置 GitHub Pages
1. 进入仓库的 Settings 页面
2. 找到 Pages 选项（在左侧菜单）
3. 在 Source 部分，选择以下配置：
   - Branch: main
   - Folder: / (root)
4. 点击 Save

### 步骤4：等待部署
- GitHub Pages 会自动部署你的网站
- 部署完成后，你可以通过 `https://[用户名].github.io/[仓库名]` 访问

## 本地测试
为了在本地测试网站，你可以使用 Python 的简单 HTTP 服务器：

```bash
# Python 3.x
python -m http.server 8080
```

然后在浏览器访问 `http://localhost:8080`

## 注意事项

1. 文件路径
   - 所有文件都使用相对路径（已配置 `<base href="./">` 标签）
   - 确保所有资源文件（图片、CSS、JS等）都在正确的相对位置

2. 文件名大小写
   - GitHub Pages 对文件名大小写敏感
   - 确保链接中的文件名与实际文件名完全匹配

3. 部署问题排查
   - 如果页面显示 404，检查仓库的 GitHub Pages 设置
   - 确认文件已正确推送到选定的分支
   - 查看 Actions 选项卡中的部署日志

4. 更新网站
   - 推送新的更改到 main 分支后，Pages 会自动重新部署
   - 部署可能需要几分钟时间才能生效

## 目录结构
```
├── assets/         # 静态资源
├── js/            # JavaScript 文件
├── *.html         # HTML 页面
├── style.css      # 样式文件
└── README.md      # 说明文档
```