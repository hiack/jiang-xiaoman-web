# 江小满对话网站

一个围绕江小满和满糖甜品店设计的响应式对话入口。网页通过 iframe 连接已经发布的 Dify 对话应用，本仓库不保存 Dify API Key，也不直接读取或保存访客的聊天内容。

## 本地运行

```powershell
npm ci
npm run dev
```

## 验证

```powershell
npm test
npm run check
npm run build
npm run verify:dist
npm run test:e2e
```

## 发布边界

远程仓库必须保持 private。只有 Codex 负责创建 GitHub 仓库、推送和启用 Pages；Pi Coding Agent 不执行远程操作。
# 2026-10-22：站内对话接入

`api/chat.ts` 继续使用现有服务端 `DIFY_API_KEY`，精确增加 `https://home.tangzhaochu.com` 来源，供自有网站的原生聊天界面使用。旧 Pages 前端和密钥不迁移、不复制到浏览器。

新增独立 `POST /api/nutrition`，服务端 Secret 为 `NUTRITION_API_KEY`，仅接受 `https://training.tangzhaochu.com`；缺配置返回503。请求只允许 query（最多2000字符）、user（匿名随机编号）与可选 conversation_id，其余字段丢弃；消息发给已有饮食应用，不改提示词。只输出消息增量、会话编号和通用错误，不输出模型、工作流和凭据。OPTIONS204，非法来源403、输入400、节流429、上游失败502。单次上游50秒超时，Function60秒；响应no-store。

每实例12次/分钟/IP只是尽力限制，不是全局额度或账户权限隔离。前台仅供虚构案例体验；不读取训练记录/账号，不调用历史/删除接口。上线前须启用该应用API并将专用密钥写入此项目的Production Secret，再验证真实虚构案例；未完成时不能宣称已接通。

验证：`npm test -- --exclude '.worktrees/**'`、`npm run check`；新增 API mock 覆盖正常流、专用凭据缺失、输入/来源/节流与错误脱敏。
