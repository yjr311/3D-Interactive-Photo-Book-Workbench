# 光匣 LUMEN · 项目长期约定

单文件 HTML 照片书工具。源码在 `.workbuddy/tmp/src/`（`head.html` + `core.js` + `photos.js` + `app.js`），
由 `.workbuddy/tmp/build.py` 拼成 `光匣-3D互动照片书.html`（零依赖、可 `file://` 打开）。
**改完源码必须重新 build，产物才是唯一交付物。**

## 硬约定

1. **书页画面来源 = `state.book.art`**，`'tpl'`（模版成品，默认）/ `'plain'`（干净照片）。
   默认必须是 `tpl` —— 用户逐张挑的模版必须在成书里看得见，否则模版功能白做。
2. **模版文字一律用占位符**（`{name}` `{n}` `{nn}` `{total}` `{tpl}`），
   不要在 `state.opts` 里写常量文字：常量会在 28 页上重复 28 遍。
3. **同一信息不出现两次**：模版自带题字时书页不再画图注（`plateHasText`）。
4. 新增 `book.*` / `opts.*` 键时，同步在 `PERSIST.restore()` 里决定要不要补默认值；
   **改出默认值时必须做定向迁移**（只升级"原样等于旧默认值"的字段），不要换 KEY 版本号。
5. 封面 / 扉页 / 环衬走 `artOf()`（干净照片）；内容页走 `plateOf()`。两者别混。

## 环境

- Python（有 PIL）只装在系统 3.10：`C:/Users/zz/AppData/Local/Programs/Python/Python310/python.exe`
- Node 用托管版：`C:/Users/zz/.workbuddy/binaries/node/versions/22.22.2-2/node.exe`，
  跑 CDP 脚本时 `NODE_PATH=C:/Users/zz/.workbuddy/binaries/node/workspace/node_modules`
- 无头 Chromium：`C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe`

## 测试与出图

- `test_book.mjs`（书本观感 + 翻页手感 + 书页画面）、`test_flow.mjs`（流程与持久化）、
  `test_landing.mjs`（翻页落地连续性/阴影越界）、`test_real.mjs`（CDP 真实输入）。
  四套全绿才算过（2026-09-18：97/97）。
- `preview.py` 出 10 张预览图到工作区（含翻页九宫格、书页版式联页、书页画面对照）。
- **本环境读不了图片**（Read 对图片报「model does not support images」），
  所以视觉改动一律用**像素量测**取证（几何、亮度、哈希去重），不要靠"看着没问题"。
