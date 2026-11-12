/**
 * 「个性化」页面的宿主侧接口。
 *
 * 只用 node: 内置模块与本地文件，不联网、不调用模型。
 *
 * 路由走 ctx.connection.fetch.register，而不是 ctx.webServer.register：
 *   - /api/ 前缀的路由由 dsh-client-connection 统一做信任栅栏 + cookie 鉴权，
 *     未认证请求返回 401，exact 路由还要求 principal 为 owner；
 *   - webServer 的原生路由没有任何鉴权，用它等于把文件读写接口裸露给本机任意进程。
 *
 * 提供三类能力：
 *   1. 读/写全局 AGENTS.md（$DSH_HOME/AGENTS.md 与 $DSH_AGENTS_HOME/AGENTS.md）
 *   2. 记忆库的查询/新增/删除（复用 store.js）
 *   3. 一次取回页面所需的全部状态
 */

import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { normalizeTags, normalizeText, readDoc, removeRecord, searchRecords, setInject, upsertRecord, writeDoc } from './store.js'

/** 路由前缀（必须落在 /api 下才会被鉴权层接管）。 */
export const BASE_PATH = '/api/dsh-personalization'

/** 单个指令文件上限 256 KiB，防止误贴巨型文件。 */
const MAX_INSTRUCTION_BYTES = 256 * 1024

/**
 * 全局指令文件位置。与 @deepseek-ai/dsh-agent-instructions 一致：
 *   - 用户级：$DSH_HOME/AGENTS.md（未设置时 ~/.dsh/AGENTS.md）
 * 只保留用户级；共享级（$DSH_AGENTS_HOME）按需求不提供编辑入口。
 * @returns {{id: string, label: string, path: string}[]}
 */
export function instructionTargets() {
  const home = envOr('DSH_HOME', join(homedir(), '.dsh'))
  return [
    { id: 'global', label: '用户级（$DSH_HOME/AGENTS.md）', path: join(home, 'AGENTS.md') },
  ]
}

/** 读取环境变量，空串视为未设置。 */
function envOr(name, fallback) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

/**
 * 读取一个指令文件。
 * @param {{id: string, label: string, path: string}} target 目标
 * @returns {Promise<object>}
 */
export async function readInstruction(target) {
  if (!existsSync(target.path)) {
    return { ...target, exists: false, content: '', bytes: 0, updatedAt: null }
  }
  const [raw, info] = await Promise.all([readFile(target.path, 'utf8'), stat(target.path)])
  return {
    ...target,
    exists: true,
    content: raw,
    bytes: Buffer.byteLength(raw, 'utf8'),
    updatedAt: info.mtime.toISOString(),
  }
}

/**
 * 写入一个指令文件。写前把旧内容备份为 `<文件>.bak`。
 * @param {{id: string, label: string, path: string}} target 目标
 * @param {string} content 新内容
 * @returns {Promise<{ok: true, path: string, bytes: number, backup: string | null}>}
 */
export async function writeInstruction(target, content) {
  if (typeof content !== 'string') throw new HttpError(400, 'content 必须是字符串')
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_INSTRUCTION_BYTES) throw new HttpError(413, `内容过大（${bytes} 字节，上限 ${MAX_INSTRUCTION_BYTES}）`)
  await mkdir(dirname(target.path), { recursive: true })
  let backup = null
  if (existsSync(target.path)) {
    backup = `${target.path}.bak`
    await copyFile(target.path, backup)
  }
  await writeFile(target.path, content, 'utf8')
  return { ok: true, path: target.path, bytes, backup }
}

/** 带状态码的错误，统一转成 JSON 响应。 */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {string} message 说明
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** JSON 响应，禁用缓存。 */
function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
}

/** 读取 JSON 请求体。 */
async function readBody(request) {
  try {
    const parsed = await request.json()
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON 对象')
  }
}

/**
 * 注册全部路由。
 * @param {object} ctx 宿主上下文，需要 ctx.connection
 * @param {{file: string, limit: number, onChange?: () => void}} options 存储文件、默认条数、变更回调
 * @returns {(() => void)[]} 注销函数
 */
export function registerRoutes(ctx, options) {
  const { file, limit } = options
  // 记忆被改写后通知宿主刷新"自动注入"缓存，否则提示词里还是旧内容。
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {}
  const disposers = []
  // 处理器内部一律抛错，这里统一转成 JSON，避免异常冒到 HTTP 层。
  const route = (path, methods, handler) => {
    disposers.push(ctx.connection.fetch.register({
      path,
      methods,
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          return await handler(request)
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500
          return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, status)
        }
      },
    }))
  }

  /** 首屏：全局指令文件 + 全部记忆（平铺展示用）。 */
  route(`${BASE_PATH}/state`, ['GET'], async () => {
    const instructions = await Promise.all(instructionTargets().map(readInstruction))
    const doc = await readDoc(file)
    const memories = [...doc.records].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return json({
      ok: true,
      instructions,
      memories,
      memory: {
        total: doc.records.length,
        injectable: doc.records.filter(record => record.inject === true).length,
        path: file,
      },
      limits: { instructionBytes: MAX_INSTRUCTION_BYTES, searchLimit: limit },
    })
  })

  /** 保存一个指令文件。 */
  route(`${BASE_PATH}/agents-md`, ['PUT', 'POST'], async (request) => {
    const body = await readBody(request)
    const target = instructionTargets().find(candidate => candidate.id === body.id)
    if (target === undefined) throw new HttpError(400, `未知的指令目标：${String(body.id)}`)
    const result = await writeInstruction(target, body.content)
    return json({ ok: true, ...result })
  })

  /** 检索记忆 / 删除记忆。 */
  route(`${BASE_PATH}/memories`, ['GET', 'DELETE'], async (request) => {
    const url = new URL(request.url, 'http://localhost')
    if (request.method === 'GET') {
      const doc = await readDoc(file)
      const { items, total } = searchRecords(doc, {
        query: url.searchParams.get('query') ?? '',
        limit: url.searchParams.get('limit') ?? limit,
      })
      return json({ ok: true, items, total })
    }
    const id = url.searchParams.get('id') ?? ''
    const doc = await readDoc(file)
    const outcome = removeRecord(doc, id)
    if (outcome.error !== undefined) throw new HttpError(404, outcome.error)
    await writeDoc(file, doc)
    onChange()
    return json({ ok: true, removed: outcome.removed, remaining: doc.records.length })
  })

  /** 切换"自动注入"。 */
  route(`${BASE_PATH}/memories/inject`, ['PATCH', 'POST'], async (request) => {
    const body = await readBody(request)
    const doc = await readDoc(file)
    const outcome = setInject(doc, body.id, body.inject === true)
    if (outcome.error !== undefined) throw new HttpError(404, outcome.error)
    await writeDoc(file, doc)
    onChange()
    return json({ ok: true, record: outcome.record, injectable: doc.records.filter(record => record.inject === true).length })
  })

  /** 新增记忆。 */
  route(`${BASE_PATH}/memories/add`, ['POST'], async (request) => {
    const body = await readBody(request)
    let text
    let tags
    try {
      text = normalizeText(body.text)
      tags = normalizeTags(body.tags)
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : String(error))
    }
    const doc = await readDoc(file)
    const outcome = upsertRecord(doc, { text, tags, inject: body.inject === true }, new Date().toISOString())
    await writeDoc(file, doc)
    onChange()
    return json({ ok: true, record: outcome.record, created: outcome.created, total: doc.records.length })
  })

  return disposers
}

export { MAX_INSTRUCTION_BYTES }
