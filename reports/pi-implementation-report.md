# Pi Coding Agent 实现报告

## 实现范围

- 已完成 React TypeScript 单页网站（Vite + React 19 + TypeScript 7，严格测试先行红绿循环）
- 已嵌入指定 Dify 对话（iframe 直连，无 API Key、无后端代理）
- 已应用确认的江小满主图（原始 PNG 保留于 `public/images/jiang-xiaoman-original.png`）与 A 方案沉浸式双栏视觉
- 已实现桌面 46/54 双栏与手机上下布局、加载超时、离线、重试、外部入口和安全说明折叠区
- 已添加单元测试（Vitest + Testing Library）、浏览器冒烟测试（Playwright，桌面 1440×900 与手机 390×844）、构建产物安全检查和 Pages 工作流
- 手机端人物高度约 168px，对话区直接可输入，无需先滚过人物介绍

## 验证结果

- npm ci: PASS（干净安装后重新验证全部通过）
- npm test: PASS（9 passed）
- npm run check: PASS（tsc -b）
- npm run build: PASS（dist/index.html、JS、CSS、PNG 共 4 个文件）
- npm run verify:dist: PASS（`VERIFY_DIST_PASS files=4`，产物含指定 Dify URL，无密钥/本地绝对路径）
- npm run test:e2e: PASS（desktop + mobile 共 4 passed、2 个按项目正确跳过）
- git diff --check: PASS
- git status --short: 工作区干净（提交报告后无未提交文件）
- 角色图 SHA-256：`7176C73A11EA631F624B8F9549EE1F5BFA2FFF5A161B2C0054508B76BD607870`（源图与仓库内、dist 内三方一致；1024×1536 未重生成、未换脸、未改风格）

## 对计划的工具链最小修正

以下问题均保留原始失败输出后处理，不改变产品范围与架构：

1. **vitest 误采集 Playwright 规格文件**。Task 6 加入 `e2e/home.spec.ts` 后，vitest 默认 include 会将其当作单元测试并因 `test.beforeEach()` 失败（`npm test` 退出码 1，9 个单测仍通过）。
   - 修正：在 `vite.config.ts` 的 `test.exclude` 追加 `e2e/**`。
2. **TypeScript 7 报 TS5096**。计划原 `tsconfig.node.json` 使用 `composite: true` 且带 `allowImportingTsExtensions` 却没有 `noEmit`/`emitDeclarationOnly`，`tsc -b` 报错退出。
   - 修正：`tsconfig.node.json` 增加 `"noEmit": true` 与 `"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"`（vite.config.ts 与 playwright.config.ts 无相对 `.ts` 导入，去掉该选项不影响语义；此处保留选项并补 noEmit）。
3. **构建信息文件污染项目根目录**。首次失败的 `tsc -b` 在根目录遗留 `vite.config.js/.d.ts`、`playwright.config.js/.d.ts` 与 `tsconfig.node.tsbuildinfo`；`tsconfig.app.json` 缺 `tsBuildInfoFile` 导致每次构建在根目录重写 `tsconfig.app.tsbuildinfo`。
   - 修正：清理遗留文件；为 `tsconfig.app.json` 增加 `"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo"`，验证后根目录保持干净。
4. **Testing Library 未自动清理**。`@testing-library/react` 只有在检测到全局 `afterEach` 时才自动卸载；本工程 vitest 未开启 `globals`，多测试文件内渲染残留 DOM 导致 ChatPanel 第三条用例 “Found multiple elements”。
   - 修正：`src/test/setup.ts` 显式注册 `afterEach(() => cleanup())`。
5. **Playwright 移动端浏览器缺失**。`iPhone 13` 设备描述默认 WebKit，而计划只在 Task 6 安装 chromium，导致 mobile 项目全部无法启动浏览器。
   - 修正：执行 `npx playwright install webkit`（非代码改动）。
6. **.gitignore 提前到 Task 1**。计划把 `.gitignore` 放在 Task 8，但 Task 1 提交后 `node_modules/` 作为未跟踪目录持续污染 `git status`，与计划“提交后工作区干净”的预期冲突。为保持工作区干净提前创建（内容与计划一致），Task 8 相应只新增工作流与 README。此改动为纯顺序调整，无范围影响。

以上 1、2、4、5 项在原样执行计划命令即失败的输出已保留在本会话日志中；修正后全部验证通过。

## 远程操作

未创建 GitHub 仓库，未推送，未启用 GitHub Pages，未运行 gh，未添加远程地址，未修改仓库可见性。

## 未解决问题

无本地实现阻塞。私有仓库是否支持 GitHub Pages 由 Codex 在远程发布阶段确认；若 GitHub 拒绝私有仓库发布，将保持仓库私有并停止发布，按要求请求用户决策。
