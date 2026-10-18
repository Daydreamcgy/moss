# Moss

简体中文 · [English](README.en.md)

一个 Typora 风格的 Markdown 编辑器：**你在文字里写，页面在你周围成形**。没有预览窗格，没有左右分栏——你正在读的这一段，本身就是源码。

![Moss](docs/screenshot.png)

## 它是什么

Typora 证明了 Markdown 编辑不需要分屏。Moss 沿着这个思路，用另一套引擎从头实现了一遍：基于 [CodeMirror 6](https://codemirror.net/) 的编辑器内核，加一层把语法树翻译成装饰（decoration）的实时渲染层。

功能上是完整的写作工具，不是玩具：表格能点进去改、公式能渲染、文件夹能浏览、主题跟着窗口走。

## 特性

- **实时预览** —— 标题、粗体、斜体、行内代码、删除线、链接、引用、列表、任务清单、分割线都在原位呈现。光标进入某个元素，它的原始语法会浮出来、变灰，可以直接改；移开又淡回页面。
- **表格就地编辑** —— 点任意单元格直接打字，`Tab` / `Shift+Tab` 在格子间移动，`Enter` 提交，`Esc` 取消。`Alt`+点击回到 Markdown 源码去加行删行。
- **代码块** —— 约 100 种语言的语法高亮，围栏本身淡出。
- **公式** —— 行内 `$...$` / `\(...\)`，独立成行 `$$...$$` / `\[...\]`，KaTeX 渲染。
- **图片** —— 相对路径按打开的文件夹解析，异步加载。
- **标签页 / 文件夹树 / 大纲** —— 大纲跟着滚动高亮当前章节。
- **文件监听** —— 磁盘上的改动会自动重新载入并保持滚动位置；你这边有未保存改动时不会覆盖，只提示。
- **三种写作模式** —— 实时 / 源码、专注（只亮当前段）、打字机（光标锁在中线）。
- **五套主题** —— 纸张、GitHub、棕褐、夜间、苔绿。
- **中文界面** —— 全界面中英双语，菜单里随时切换，下次打开记住选择。
- **导出** —— 独立 HTML（带打印 CSS），或直接打印成 PDF。
- **桌面版** —— 单实例、`.md` 文件关联、标题栏跟随主题、关闭前原生确认。

## 快速开始

```bash
npm install
npm run dev            # http://127.0.0.1:5188
```

生产构建：

```bash
npm run build
npm run preview        # 用 5188 端口伺服 dist/
```

桌面窗口（不打包）：

```bash
npm run desktop        # 先 npm run build
MOSS_DEV=1 npm run desktop   # 直接加载开发服务器
```

> 如果 shell 里设了 `ELECTRON_RUN_AS_NODE=1`（某些 agent 环境会设），Electron 会当成普通 Node 启动然后直接退出、什么都不显示。先清掉这个变量：`Remove-Item Env:ELECTRON_RUN_AS_NODE`。

## 打包 Windows 安装包

```bash
npm run dist           # vite build + electron-builder --win nsis
```

产物在 `release/`：

- `Moss-Setup-0.1.0.exe` —— NSIS 安装包（可选安装目录、桌面快捷方式、`.md` 文件关联）
- `win-unpacked/Moss.exe` —— 免安装版

`npm run dist:dir` 只出免安装版，不生成安装器。

渲染进程由 Vite 完整打包，所有编辑器依赖都放在 `devDependencies`，所以打包出来的应用不带 `node_modules`。图标由 `tools/make-icon.py` 生成（需要 Pillow），可以传 `A`–`D` 选不同字形：

```bash
python tools/make-icon.py A   # build/icon.ico + public/icon.png
```

## 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 新建 / 打开文件 / 打开文件夹 | `Ctrl+N` / `Ctrl+O` / `Ctrl+Shift+O` |
| 保存 | `Ctrl+S` |
| 关闭标签 / 关闭全部 | `Ctrl+W` / `Ctrl+Shift+W` |
| 加粗 / 斜体 / 删除线 / 行内代码 | `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` / `Ctrl+E` |
| 插入链接 | `Ctrl+K` |
| 标题 1–6 / 清除标题 | `Ctrl+1` … `Ctrl+6` / `Ctrl+0` |
| 切换源码模式 | `Ctrl+/` |
| 专注模式 | `Ctrl+Shift+F` |
| 打字机模式 | `F8` |
| 收起 / 展开侧栏 | `Ctrl+\` |

## 文件读写

浏览器不能直接写磁盘，所以网页版走 **File System Access API**（Chrome / Edge）。`打开文件夹` 拿一个目录句柄，`保存` 通过同一个句柄写回，并用 2.5 秒轮询比对 `lastModified` 发现外部改动。Firefox / Safari 退化成拖拽打开 + 下载保存，没有文件监听。

桌面版另外支持：命令行带文件参数启动、`.md` 双击打开（第二次启动会把文件交给已有窗口，而不是开新进程）、`Ctrl+S` 由主进程直接写盘。

## 实现结构

```
src/
  editor/
    live-preview.ts   # 核心：把语法树翻译成 decoration 的 StateField
    table.ts          # 表格模型、单元格偏移、就地编辑浮层
    widgets.ts        # 图片 / 公式 / 复选框 / 项目符号 / 分割线
    setup.ts          # CodeMirror 6 配置
    format.ts         # 加粗、链接、标题等命令
  ui/                 # 标签页、文件树、大纲（含滚动同步）
  io/files.ts         # File System Access 封装、目录扫描、mtime 轮询
  export/html.ts      # 独立 HTML + 打印 CSS
electron/main.cjs     # 桌面外壳（自定义标题栏、主题化窗口边框、单实例）
electron/preload.cjs  # 唯一的 IPC 桥：渲染进程告诉外壳该用什么颜色
```

### 两个值得记下来的坑

**一、装饰必须放在 StateField 里，不能放在 ViewPlugin 里。**

跨行的替换装饰（表格、块级公式）由 `ViewPlugin` 提供时会抛 `RangeError: Decorations that replace line breaks may not be specified via plugins`。它不会让页面崩掉，而是**悄悄破坏 CodeMirror 的高度映射**——52 行的文档会算出 16000px 的滚动高度，中间全是幽灵空白。

**二、标题栏遮罩会盖掉 tab 栏的 1px 底线。**

`titleBarOverlay` 的 `height` 如果和 tab 栏一样高（42px），遮罩的底色会把那条分隔线整个吃掉，右上角看起来就"缺一截"。把遮罩降到 40px、线留在 41–42px 就露出来了。

## 已知缺口

- 图片还不能直接拖进文档
- 表格没有多光标、不能可视化增删行列
- PDF 走浏览器打印，不是真正的排版引擎
- 侧栏没有文件名过滤
- 双击打开的单个文件没有文件监听（只有"打开文件夹"那条路有句柄可以轮询）

## 关于

这是一次**独立实现**：按照公开可见的行为，从零写的一个实时预览 Markdown 编辑器。仓库里不含 Typora 的任何代码、样式、图标或主题文件，也不是 Typora 的分发版本。Typora 是商业软件，需要它的功能请购买。

MIT License.
