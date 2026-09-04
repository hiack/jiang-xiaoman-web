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
