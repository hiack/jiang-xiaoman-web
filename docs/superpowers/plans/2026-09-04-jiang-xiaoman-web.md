# 江小满对话网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个人物氛围明确、手机和桌面均可使用、通过 iframe 连接现有 Dify 对话的江小满单页网站。

**Architecture:** Vite 构建 React 和 TypeScript 静态站点。页面由角色展示、Dify 对话容器和安全说明三个独立组件组成；浏览器直接与 Dify 通信，网站不持有 API Key、不读取聊天内容、不设置后端。

**Tech Stack:** Node 24、npm 11、React 19、TypeScript 7、Vite 8、Vitest 5、Testing Library 16、Playwright 1.62、GitHub Actions、GitHub Pages

---

## 文件结构

```text
jiang-xiaoman-web/
├── .github/workflows/deploy-pages.yml       # GitHub Pages 构建与发布
├── docs/superpowers/                        # 已确认规格和本实施计划
├── e2e/home.spec.ts                         # 桌面、手机、离线与嵌入冒烟测试
├── public/images/jiang-xiaoman-original.png # 已确认的原始角色图
├── reports/pi-implementation-report.md      # Pi 的实现与测试报告
├── scripts/verify-dist.mjs                  # 构建产物密钥和本地路径检查
├── src/components/CharacterHero.tsx         # 人物、品牌、场景文案
├── src/components/CharacterHero.test.tsx
├── src/components/ChatPanel.tsx              # Dify iframe 与加载、离线、失败状态
├── src/components/ChatPanel.test.tsx
├── src/components/SafetyInfo.tsx             # AI、隐私与现实危险说明
├── src/components/SafetyInfo.test.tsx
├── src/config/content.ts                     # 唯一的文案与 Dify URL 配置
├── src/hooks/useNetworkStatus.ts             # 浏览器在线状态
├── src/hooks/useNetworkStatus.test.tsx
├── src/App.tsx                               # 组合页面组件
├── src/App.test.tsx
├── src/main.tsx                              # React 入口
├── src/styles.css                            # 视觉系统和响应式布局
├── src/test/setup.ts                         # Vitest DOM 设置
├── index.html                                # 文档入口和元信息
├── package.json                              # 依赖与命令
├── package-lock.json                         # 锁定依赖
├── playwright.config.ts                      # 浏览器测试配置
├── tsconfig.app.json                         # 浏览器 TypeScript 配置
├── tsconfig.json                             # TypeScript 项目引用
├── tsconfig.node.json                        # Vite 配置 TypeScript 配置
└── vite.config.ts                            # Vite、Vitest 和 Pages base
```

## Task 1 建立可测试的 Vite React 工程

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1 写入最小失败测试**

创建 `src/App.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Jiang Xiaoman experience shell', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: '江小满对话空间' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2 写入项目配置并安装依赖**

创建 `package.json`：

```json
{
  "name": "jiang-xiaoman-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "check": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "verify:dist": "node scripts/verify-dist.mjs"
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/node": "26.4.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "30.0.1",
    "typescript": "7.0.2",
    "vite": "8.2.2",
    "vitest": "5.0.0"
  }
}
```

创建 `tsconfig.json`：

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

创建 `tsconfig.app.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

创建 `tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

创建 `vite.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/jiang-xiaoman-web/' : '/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

创建 `src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
```

创建 `index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#362522" />
    <meta name="description" content="走进满糖甜品店，和江小满聊一会儿。" />
    <title>江小满 · 满糖</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

创建 `src/App.tsx`：

```tsx
export default function App() {
  return <main aria-label="江小满对话空间" />
}
```

创建 `src/main.tsx`：

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

创建空的 `src/styles.css`，随后运行：

```powershell
npm install
npm test
```

Expected: `1 passed`，并生成 `package-lock.json`。

- [ ] **Step 3 提交工程骨架**

```powershell
git add package.json package-lock.json index.html tsconfig*.json vite.config.ts src
git commit -m "chore: scaffold tested React site"
```

Expected: 提交成功，工作区干净。

## Task 2 集中角色文案和 Dify 配置

**Files:**
- Create: `src/config/content.ts`
- Create: `src/config/content.test.ts`

- [ ] **Step 1 写入配置失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { siteContent } from './content'

describe('siteContent', () => {
  it('uses the approved Dify app and fixed identity copy', () => {
    expect(siteContent.chatUrl).toBe('https://udify.app/chat/pNigFJHwFSH5pgcY')
    expect(siteContent.brand).toBe('满糖 · 江小满')
    expect(siteContent.isAiDisclosure).toContain('Dify')
  })

  it('does not contain secrets or local paths', () => {
    const serialized = JSON.stringify(siteContent)
    expect(serialized).not.toMatch(/api[_-]?key/i)
    expect(serialized).not.toContain('F:\\')
  })
})
```

运行：

```powershell
npm test -- src/config/content.test.ts
```

Expected: FAIL，因为 `content.ts` 尚不存在。

- [ ] **Step 2 写入最小配置实现**

```ts
export const siteContent = {
  brand: '满糖 · 江小满',
  scene: '雾城 · 傍晚五点半 · 小雨',
  headline: '“……你来了呀。”',
  subline: '靠窗的位置，我一直替你留着。如果今天有点累，就慢慢说。',
  inputHint: '和江小满说句话…',
  portraitUrl: `${import.meta.env.BASE_URL}images/jiang-xiaoman-original.png`,
  chatUrl: 'https://udify.app/chat/pNigFJHwFSH5pgcY',
  isAiDisclosure: '江小满是 AI 角色，回复由你已发布的 Dify 对话提供。',
  privacyNotice: '聊天内容由 Dify 服务处理，本网站不直接读取或保存聊天记录。请勿输入密码、证件号或银行卡信息。',
  emergencyNotice: '如果你或他人正面临现实危险，请立即联系所在地的紧急服务或可信赖的人。',
} as const
```

运行：

```powershell
npm test -- src/config/content.test.ts
```

Expected: `2 passed`。

- [ ] **Step 3 提交集中配置**

```powershell
git add src/config
git commit -m "feat: add approved character and chat configuration"
```

## Task 3 实现角色主视觉组件

**Files:**
- Create: `public/images/jiang-xiaoman-original.png`
- Create: `src/components/CharacterHero.tsx`
- Create: `src/components/CharacterHero.test.tsx`

- [ ] **Step 1 复制并核对已确认图片**

从以下只读来源复制：

```text
F:\ai产品竞品分析\111\outputs\江小满网站素材\江小满_主形象_C版.png
```

目标：

```text
public/images/jiang-xiaoman-original.png
```

运行：

```powershell
Get-FileHash -LiteralPath 'public\images\jiang-xiaoman-original.png' -Algorithm SHA256
```

Expected: `7176C73A11EA631F624B8F9549EE1F5BFA2FFF5A161B2C0054508B76BD607870`。

- [ ] **Step 2 写入角色组件失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CharacterHero } from './CharacterHero'

describe('CharacterHero', () => {
  it('renders the approved character, scene and greeting', () => {
    render(<CharacterHero />)
    expect(screen.getByRole('img', { name: '江小满站在雨天的满糖甜品店门口' })).toHaveAttribute(
      'src',
      '/images/jiang-xiaoman-original.png',
    )
    expect(screen.getByText('雾城 · 傍晚五点半 · 小雨')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '“……你来了呀。”' })).toBeInTheDocument()
  })
})
```

运行：

```powershell
npm test -- src/components/CharacterHero.test.tsx
```

Expected: FAIL，因为组件尚不存在。

- [ ] **Step 3 实现角色组件**

```tsx
import { siteContent } from '../config/content'

export function CharacterHero() {
  return (
    <section className="character-hero" aria-labelledby="hero-title">
      <img
        className="character-hero__image"
        src={siteContent.portraitUrl}
        alt="江小满站在雨天的满糖甜品店门口"
      />
      <div className="character-hero__scrim" />
      <p className="character-hero__brand">{siteContent.brand}</p>
      <div className="character-hero__copy">
        <p className="character-hero__scene">{siteContent.scene}</p>
        <h1 id="hero-title">{siteContent.headline}</h1>
        <p>{siteContent.subline}</p>
      </div>
    </section>
  )
}
```

运行：

```powershell
npm test -- src/components/CharacterHero.test.tsx
```

Expected: `1 passed`。

- [ ] **Step 4 提交角色组件**

```powershell
git add public/images src/components/CharacterHero*
git commit -m "feat: add approved Jiang Xiaoman hero"
```

## Task 4 实现网络状态和 Dify 对话组件

**Files:**
- Create: `src/hooks/useNetworkStatus.ts`
- Create: `src/hooks/useNetworkStatus.test.tsx`
- Create: `src/components/ChatPanel.tsx`
- Create: `src/components/ChatPanel.test.tsx`

- [ ] **Step 1 写入在线状态失败测试**

```tsx
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  it('reacts to browser offline and online events', () => {
    const { result } = renderHook(() => useNetworkStatus())
    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)
    act(() => window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })
})
```

运行后应因模块不存在而失败。

- [ ] **Step 2 实现在线状态 Hook**

```ts
import { useEffect, useState } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return isOnline
}
```

运行：

```powershell
npm test -- src/hooks/useNetworkStatus.test.tsx
```

Expected: `1 passed`。

- [ ] **Step 3 写入对话组件失败测试**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel'

describe('ChatPanel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders the exact Dify URL and accessible title', () => {
    render(<ChatPanel />)
    const frame = screen.getByTitle('与江小满对话')
    expect(frame).toHaveAttribute('src', 'https://udify.app/chat/pNigFJHwFSH5pgcY')
  })

  it('shows a fallback after the load timeout', () => {
    render(<ChatPanel />)
    act(() => vi.advanceTimersByTime(12000))
    expect(screen.getByRole('alert')).toHaveTextContent('暂时没有加载出来')
    expect(screen.getByRole('link', { name: '直接打开原对话' })).toHaveAttribute(
      'href',
      'https://udify.app/chat/pNigFJHwFSH5pgcY',
    )
  })

  it('hides the loading state when the iframe loads', () => {
    render(<ChatPanel />)
    fireEvent.load(screen.getByTitle('与江小满对话'))
    expect(screen.queryByText('正在推开满糖的门…')).not.toBeInTheDocument()
  })
})
```

运行后应因组件不存在而失败。

- [ ] **Step 4 实现 Dify 对话组件**

```tsx
import { useEffect, useState } from 'react'
import { siteContent } from '../config/content'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

type FrameStatus = 'loading' | 'ready' | 'timeout'

export function ChatPanel() {
  const isOnline = useNetworkStatus()
  const [status, setStatus] = useState<FrameStatus>('loading')
  const [frameKey, setFrameKey] = useState(0)

  useEffect(() => {
    if (!isOnline || status !== 'loading') return
    const timer = window.setTimeout(() => setStatus('timeout'), 12000)
    return () => window.clearTimeout(timer)
  }, [isOnline, status, frameKey])

  const retry = () => {
    setStatus('loading')
    setFrameKey((key) => key + 1)
  }

  return (
    <section className="chat-panel" aria-label="江小满聊天区">
      <header className="chat-panel__header">
        <div className="chat-panel__identity">
          <img src={siteContent.portraitUrl} alt="" />
          <div>
            <strong>江小满</strong>
            <span><i aria-hidden="true" />正在满糖甜品店</span>
          </div>
        </div>
        <a href={siteContent.chatUrl} target="_blank" rel="noreferrer">新窗口打开</a>
      </header>

      <div className="chat-panel__body">
        {!isOnline && (
          <div className="chat-state" role="alert">
            <h2>现在没有网络连接</h2>
            <p>恢复联网后，江小满的对话会重新加载。</p>
          </div>
        )}

        {isOnline && status === 'loading' && (
          <div className="chat-state" aria-live="polite">正在推开满糖的门…</div>
        )}

        {isOnline && status === 'timeout' && (
          <div className="chat-state" role="alert">
            <h2>江小满的对话暂时没有加载出来</h2>
            <p>可以重试，或者直接打开原始 Dify 对话。</p>
            <div className="chat-state__actions">
              <button type="button" onClick={retry}>重新加载</button>
              <a href={siteContent.chatUrl} target="_blank" rel="noreferrer">直接打开原对话</a>
            </div>
          </div>
        )}

        {isOnline && (
          <iframe
            key={frameKey}
            className={status === 'ready' ? 'chat-frame chat-frame--ready' : 'chat-frame'}
            src={siteContent.chatUrl}
            title="与江小满对话"
            onLoad={() => setStatus('ready')}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      <p className="chat-panel__disclosure">{siteContent.isAiDisclosure}</p>
    </section>
  )
}
```

运行：

```powershell
npm test -- src/hooks/useNetworkStatus.test.tsx src/components/ChatPanel.test.tsx
```

Expected: `4 passed`。

- [ ] **Step 5 提交对话组件**

```powershell
git add src/hooks src/components/ChatPanel*
git commit -m "feat: embed Dify chat with resilient states"
```

## Task 5 实现安全说明并组合页面

**Files:**
- Create: `src/components/SafetyInfo.tsx`
- Create: `src/components/SafetyInfo.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1 写入安全说明失败测试**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafetyInfo } from './SafetyInfo'

describe('SafetyInfo', () => {
  it('states the AI, privacy and emergency boundaries', () => {
    render(<SafetyInfo />)
    expect(screen.getByText(/AI 角色/)).toBeInTheDocument()
    expect(screen.getByText(/不直接读取或保存聊天记录/)).toBeInTheDocument()
    expect(screen.getByText(/现实危险/)).toBeInTheDocument()
  })
})
```

运行后应因组件不存在而失败。

- [ ] **Step 2 实现安全说明**

```tsx
import { siteContent } from '../config/content'

export function SafetyInfo() {
  return (
    <details className="safety-info">
      <summary>关于江小满与隐私</summary>
      <div>
        <p>{siteContent.isAiDisclosure}</p>
        <p>{siteContent.privacyNotice}</p>
        <p>{siteContent.emergencyNotice}</p>
      </div>
    </details>
  )
}
```

- [ ] **Step 3 更新 App 组合测试**

将 `src/App.test.tsx` 改为：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('combines the hero, chat and safety information', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: '江小满对话空间' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '“……你来了呀。”' })).toBeInTheDocument()
    expect(screen.getByTitle('与江小满对话')).toBeInTheDocument()
    expect(screen.getByText('关于江小满与隐私')).toBeInTheDocument()
  })
})
```

运行后应失败，因为 `App` 尚未组合组件。

- [ ] **Step 4 组合最终页面结构**

将 `src/App.tsx` 改为：

```tsx
import { CharacterHero } from './components/CharacterHero'
import { ChatPanel } from './components/ChatPanel'
import { SafetyInfo } from './components/SafetyInfo'

export default function App() {
  return (
    <main className="app-shell" aria-label="江小满对话空间">
      <div className="experience-card">
        <CharacterHero />
        <div className="conversation-column">
          <ChatPanel />
          <SafetyInfo />
        </div>
      </div>
    </main>
  )
}
```

运行：

```powershell
npm test
```

Expected: 全部单元测试通过。

- [ ] **Step 5 提交页面组合**

```powershell
git add src
git commit -m "feat: compose companion experience and safety guidance"
```

## Task 6 落实最终视觉与响应式规则

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1 写入完整视觉样式**

将 `src/styles.css` 替换为：

```css
:root {
  color: #362522;
  background: #d9e3e3;
  font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
html, body, #root { min-width: 320px; min-height: 100%; margin: 0; }
body {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 10%, rgba(255,255,255,.86), transparent 28rem),
    linear-gradient(145deg, #d9e3e3, #f3e8e2 56%, #d9e3e3);
}
button, a { font: inherit; }
a { color: #8e4c50; text-underline-offset: 3px; }
button:focus-visible, a:focus-visible, summary:focus-visible {
  outline: 3px solid #7d4145;
  outline-offset: 3px;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px;
}

.experience-card {
  width: min(1180px, 100%);
  min-height: min(760px, calc(100vh - 56px));
  display: grid;
  grid-template-columns: 46% 54%;
  overflow: hidden;
  border: 1px solid rgba(234, 223, 217, .9);
  border-radius: 30px;
  background: #fbf6f1;
  box-shadow: 0 30px 80px rgba(54, 37, 34, .18);
}

.character-hero {
  position: relative;
  min-height: 660px;
  overflow: hidden;
  color: white;
  background: #362522;
}
.character-hero__image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 31%; }
.character-hero__scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(25,18,16,.08) 28%, rgba(25,18,16,.84) 100%); }
.character-hero__brand { position: absolute; top: 28px; left: 30px; margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 1.2rem; letter-spacing: .16em; text-shadow: 0 2px 12px rgba(0,0,0,.38); }
.character-hero__copy { position: absolute; right: 34px; bottom: 34px; left: 30px; }
.character-hero__scene { margin: 0 0 12px; font-size: .76rem; letter-spacing: .16em; opacity: .82; }
.character-hero h1 { margin: 0 0 12px; font-family: Georgia, "Songti SC", serif; font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 500; line-height: 1.2; }
.character-hero__copy > p:last-child { max-width: 30rem; margin: 0; font-size: .95rem; line-height: 1.8; opacity: .92; }

.conversation-column { min-width: 0; display: flex; flex-direction: column; background: radial-gradient(circle at 100% 0, #f0d4d0, transparent 28rem), #fbf6f1; }
.chat-panel { min-height: 0; flex: 1; display: flex; flex-direction: column; padding: 22px 24px 12px; }
.chat-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 54px; padding-bottom: 14px; border-bottom: 1px solid #eadfd9; }
.chat-panel__header > a { flex: none; font-size: .82rem; }
.chat-panel__identity { display: flex; align-items: center; gap: 11px; min-width: 0; }
.chat-panel__identity img { width: 44px; height: 44px; object-fit: cover; object-position: center 24%; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 1px #eadfd9; }
.chat-panel__identity strong, .chat-panel__identity span { display: block; }
.chat-panel__identity span { margin-top: 3px; color: #708b78; font-size: .73rem; }
.chat-panel__identity i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #75a681; }
.chat-panel__body { position: relative; min-height: 480px; flex: 1; margin-top: 14px; overflow: hidden; border: 1px solid #eadfd9; border-radius: 18px; background: rgba(255,255,255,.7); }
.chat-frame { width: 100%; height: 100%; min-height: 480px; border: 0; opacity: 0; transition: opacity .24s ease; }
.chat-frame--ready { opacity: 1; }
.chat-state { position: absolute; z-index: 1; inset: 0; display: grid; align-content: center; justify-items: center; gap: 10px; padding: 28px; text-align: center; color: #79655f; background: #fbf6f1; }
.chat-state h2, .chat-state p { max-width: 28rem; margin: 0; }
.chat-state h2 { color: #362522; font-family: Georgia, "Songti SC", serif; font-weight: 500; }
.chat-state__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 8px; }
.chat-state__actions button, .chat-state__actions a { min-height: 42px; padding: 10px 16px; border: 1px solid #cf777a; border-radius: 13px; }
.chat-state__actions button { color: white; background: #cf777a; cursor: pointer; }
.chat-state__actions a { background: white; }
.chat-panel__disclosure { margin: 10px 0 0; color: #8f7d76; font-size: .7rem; text-align: center; }
.safety-info { margin: 0 24px 18px; color: #79655f; font-size: .77rem; }
.safety-info summary { width: fit-content; cursor: pointer; color: #6e4a46; }
.safety-info div { max-width: 48rem; padding-top: 8px; line-height: 1.65; }
.safety-info p { margin: 6px 0; }

@media (max-width: 800px) {
  .app-shell { display: block; padding: 0; }
  .experience-card { min-height: 100vh; grid-template-columns: 1fr; border: 0; border-radius: 0; box-shadow: none; }
  .character-hero { min-height: 168px; }
  .character-hero__image { object-position: center 24%; }
  .character-hero__scrim { background: linear-gradient(180deg, rgba(25,18,16,.05), rgba(25,18,16,.7)); }
  .character-hero__brand { top: 18px; left: 18px; font-size: .95rem; }
  .character-hero__copy { right: 18px; bottom: 14px; left: 18px; }
  .character-hero__scene { margin-bottom: 5px; font-size: .62rem; }
  .character-hero h1 { margin-bottom: 0; font-size: 1.45rem; }
  .character-hero__copy > p:last-child { display: none; }
  .conversation-column { min-height: calc(100vh - 168px); }
  .chat-panel { min-height: calc(100vh - 220px); padding: 12px 12px 8px; }
  .chat-panel__header { min-height: 48px; padding-bottom: 10px; }
  .chat-panel__identity img { width: 38px; height: 38px; }
  .chat-panel__body, .chat-frame { min-height: 520px; }
  .safety-info { margin: 0 14px 14px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

- [ ] **Step 2 运行单元测试和构建**

```powershell
npm test
npm run check
npm run build
```

Expected: 三个命令退出码均为 0，`dist/index.html` 存在。

- [ ] **Step 3 提交视觉系统**

```powershell
git add src/styles.css
git commit -m "feat: apply approved responsive visual system"
```

## Task 7 添加浏览器冒烟测试和构建产物检查

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/home.spec.ts`
- Create: `scripts/verify-dist.mjs`

- [ ] **Step 1 创建 Playwright 配置**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
})
```

- [ ] **Step 2 写入浏览器测试**

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://udify.app/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<main>江小满 Dify 测试替身</main>' })
  })
})

test('shows the approved hero and embedded chat without horizontal overflow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '“……你来了呀。”' })).toBeVisible()
  await expect(page.getByTitle('与江小满对话')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('keeps chat visible in a mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only assertion')
  await page.goto('/')
  const frame = page.getByTitle('与江小满对话')
  await expect(frame).toBeVisible()
  const box = await frame.boundingBox()
  expect(box?.y).toBeLessThan(360)
})
```

- [ ] **Step 3 写入产物安全检查**

```js
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const requiredChatUrl = 'https://udify.app/chat/pNigFJHwFSH5pgcY'
const forbidden = [
  /DIFY_API_KEY\s*=/i,
  /Bearer\s+[A-Za-z0-9._-]{16,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /F:\\\\ai产品竞品分析/i,
]

async function files(dir) {
  const entries = await readdir(dir)
  const output = []
  for (const entry of entries) {
    const path = join(dir, entry)
    if ((await stat(path)).isDirectory()) output.push(...await files(path))
    else output.push(path)
  }
  return output
}

const allFiles = await files(root)
let chatUrlFound = false
for (const file of allFiles) {
  const text = await readFile(file, 'utf8').catch(() => '')
  if (text.includes(requiredChatUrl)) chatUrlFound = true
  for (const pattern of forbidden) {
    if (pattern.test(text)) throw new Error(`Forbidden content ${pattern} in ${relative(root.pathname, file)}`)
  }
}

if (!chatUrlFound) throw new Error('Approved Dify URL missing from dist')
console.log(`VERIFY_DIST_PASS files=${allFiles.length}`)
```

- [ ] **Step 4 安装 Chromium 并运行全部检查**

```powershell
npx playwright install chromium
npm run test:e2e
npm run build
npm run verify:dist
```

Expected: desktop 和 mobile 项目通过，最后输出 `VERIFY_DIST_PASS`。

- [ ] **Step 5 提交验证工具**

```powershell
git add playwright.config.ts e2e scripts
git commit -m "test: add responsive smoke and dist safety checks"
```

## Task 8 添加私有仓库发布配置和项目说明

**Files:**
- Create: `.gitignore`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `README.md`

- [ ] **Step 1 添加忽略规则**

```gitignore
node_modules/
dist/
playwright-report/
test-results/
.env
.env.*
!.env.example
.superpowers/
*.log
```

- [ ] **Step 2 添加 GitHub Pages 工作流**

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run verify:dist
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3 添加项目说明**

```markdown
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
```

- [ ] **Step 4 运行 YAML 和构建复核**

```powershell
npm test
npm run check
npm run build
npm run verify:dist
git diff --check
```

Expected: 所有命令退出码为 0。

- [ ] **Step 5 提交发布配置**

```powershell
git add .gitignore .github README.md
git commit -m "ci: prepare private repository Pages deployment"
```

## Task 9 Pi 完成本地总验收并输出报告

**Files:**
- Create: `reports/pi-implementation-report.md`

- [ ] **Step 1 运行最终验证矩阵**

```powershell
npm ci
npm test
npm run check
npm run build
npm run verify:dist
npm run test:e2e
git diff --check
git status --short
```

Expected: 前七项退出码为 0；`git status --short` 仅允许出现尚未提交的 `reports/pi-implementation-report.md`。

- [ ] **Step 2 写入 Pi 实现报告**

```markdown
# Pi Coding Agent 实现报告

## 实现范围

- 已完成 React TypeScript 单页网站
- 已嵌入指定 Dify 对话
- 已应用确认的江小满主图与 A 版响应式视觉
- 已实现加载超时 离线 重试 外部入口和安全说明
- 已添加单元测试 浏览器测试 构建产物安全检查和 Pages 工作流

## 验证结果

- npm ci: PASS
- npm test: PASS
- npm run check: PASS
- npm run build: PASS
- npm run verify:dist: PASS
- npm run test:e2e: PASS
- git diff --check: PASS

## 远程操作

未创建 GitHub 仓库 未推送 未启用 GitHub Pages

## 未解决问题

无本地实现阻塞。私有仓库是否支持 GitHub Pages 由 Codex 在远程发布阶段确认。
```

- [ ] **Step 3 提交报告并结束 Pi 工作**

```powershell
git add reports/pi-implementation-report.md
git commit -m "docs: add Pi implementation report"
git status --short
```

Expected: 工作区无未提交修改。Pi 输出最终提交号和所有验证命令结果后退出。

## Task 10 Codex 独立验收并执行远程发布

**Files:**
- Verify only: all project files
- Remote create: `hiack/jiang-xiaoman-web` private repository

- [ ] **Step 1 独立复核 Pi 结果**

Codex 检查 Pi 退出码、报告、提交历史、工作区状态和源图 SHA-256，并重新执行：

```powershell
npm ci
npm test
npm run check
npm run build
npm run verify:dist
npm run test:e2e
git diff --check
```

Expected: 全部通过，且 Pi 未执行远程操作。

- [ ] **Step 2 独立进行视觉验收**

Codex 在 1440 × 900 与 390 × 844 视口检查：首页构图、人物裁切、Dify 对话可见性、键盘焦点、折叠安全说明、加载和失败状态。发现问题时退回 Pi 修复，不由 Codex替代实现。

- [ ] **Step 3 创建私有 GitHub 仓库并推送**

```powershell
gh repo create hiack/jiang-xiaoman-web --private --source . --remote origin --push
gh repo view hiack/jiang-xiaoman-web --json nameWithOwner,visibility,url
```

Expected: `visibility` 为 `PRIVATE`，远程地址属于 `hiack/jiang-xiaoman-web`。

- [ ] **Step 4 尝试启用 GitHub Pages**

使用 GitHub API 将 Pages 构建类型设为 `workflow`，随后触发或等待 `Deploy GitHub Pages`。如果 API 返回账号套餐不支持私有仓库 Pages，则保持仓库私有、记录错误并停止，不改变仓库可见性。

- [ ] **Step 5 公网验收**

Pages 成功时，Codex 验证：

- HTTPS 地址返回成功。
- 页面静态资源均加载。
- 桌面端和手机端视觉无溢出。
- Dify iframe 显示。
- 在新对话中发送一条无敏感内容的测试消息并收到江小满回复。
- GitHub 仓库仍为 private。

只有以上条件全部成立，才能宣布网站完成上线。
