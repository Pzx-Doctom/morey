# Morey

> 一款 Chrome 浏览器扩展，让你在任意网页中嵌入 Markdown 阅读/编辑器。

## 简介

Morey 可以将网页上任意一块区域"替换"成 Markdown 面板，让你在浏览网页的同时阅读或编辑自己的 Markdown 文档。面板会自动继承宿主页面的字体、颜色和排版风格，看起来就像页面原有内容一样。

## 功能特性

- **元素选择器**：像浏览器开发者工具一样，可视化选中任意页面元素作为面板容器
- **Markdown 渲染**：基于 markdown-it，支持标准 Markdown 语法
- **编辑模式**：内置编辑器，支持自动保存（500ms 防抖）
- **样式融合**：自动提取宿主页面样式，Markdown 内容与原页面风格一致
- **文件管理**：支持导入多个 `.md` / `.txt` 文件，可在文件间快速切换
- **拖拽导入**：直接将 `.md` 文件拖拽到面板区域即可导入
- **站点记忆**：为每个域名单独保存选择器配置，下次访问自动应用
- **SPA 支持**：自动检测 `pushState` 路由变化，在单页应用中正常工作
- **快捷键**：无需鼠标即可快速切换或恢复页面

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+M` | 切换 Morey 面板显示/隐藏 |
| `Alt+Q` | 紧急恢复，立即还原页面原始内容 |

## 安装与使用

### 1. 克隆项目

```bash
git clone https://github.com/yourname/morey.git
cd morey
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 4. 在 Chrome 中加载扩展

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目的 `dist/` 目录

### 5. 开始使用

1. 打开任意网页
2. 点击工具栏中的 **Morey 图标**，弹出控制面板
3. 点击 **选择元素**，用鼠标点选页面上要替换的区域
4. 在文件管理区点击 **导入文件**，选择本地 `.md` 文件
5. Markdown 内容将渲染在选定区域中

## 开发

### 监听模式（修改源码后自动重新构建）

```bash
npm run watch
```

重新构建后，在 `chrome://extensions/` 页面点击 Morey 的刷新按钮，再刷新目标网页即可生效。

### 调试

| 组件 | 调试方式 |
|------|---------|
| Background | `chrome://extensions/` → 点击 "service worker" 链接 |
| Content Script | 目标网页按 F12，查看 Console |
| Popup | 右键扩展图标 → 检查弹出内容 |

### 清理构建产物

```bash
npm run clean
```

## 项目结构

```
morey/
├── src/
│   ├── background/
│   │   └── service-worker.js   # 消息路由中心，管理 Tab 状态
│   ├── content/
│   │   ├── content.js          # Content Script 入口，协调各模块
│   │   ├── markdown-panel.js   # Markdown 面板核心（Shadow DOM + 渲染）
│   │   ├── element-picker.js   # 可视化元素选择器
│   │   ├── file-manager.js     # 文件导入/导出/拖拽
│   │   ├── style-inheritor.js  # 提取宿主页面样式，实现风格融合
│   │   └── content.css         # Content Script 样式
│   ├── popup/
│   │   ├── popup.html          # 扩展弹窗 UI
│   │   ├── popup.js            # 弹窗逻辑
│   │   └── popup.css           # 弹窗样式
│   └── shared/
│       ├── constants.js        # 消息类型枚举、存储 Key、默认配置
│       ├── messaging.js        # 消息收发封装
│       └── storage.js          # chrome.storage.local 操作封装
├── assets/icons/               # 扩展图标
├── test/
│   ├── test-page.html          # 本地测试页面
│   └── sample.md               # 示例 Markdown 文件
├── esbuild.config.mjs          # 构建配置
├── manifest.json               # Chrome 扩展配置（Manifest V3）
└── package.json
```

## 数据存储

所有数据存储在 `chrome.storage.local` 中，以下是存储结构：

| Key | 说明 |
|-----|------|
| `morey:config` | 全局配置（启用状态、最后活跃文件 ID） |
| `morey:sites` | 各域名配置（选择器、是否自动应用、最后使用的文件） |
| `morey:files:index` | 文件列表索引（ID、文件名、大小、时间） |
| `morey:file:{id}` | 每个文件的实际文本内容 |

## 依赖

| 依赖 | 用途 |
|------|------|
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown 渲染 |
| [esbuild](https://esbuild.github.io/) | 打包构建 |

## License

MIT
