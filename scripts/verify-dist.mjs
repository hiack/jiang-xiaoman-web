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
    if (pattern.test(text)) throw new Error(`Forbidden content ${pattern} in ${relative(root, file)}`)
  }
}

if (!chatUrlFound) throw new Error('Approved Dify URL missing from dist')
console.log(`VERIFY_DIST_PASS files=${allFiles.length}`)
