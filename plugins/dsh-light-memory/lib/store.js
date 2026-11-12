/**
 * 纯本地记忆存储。
 *
 * 设计约束：
 * - 不联网、不调用模型、不做向量/嵌入计算。
 * - 只用文件系统：每个 profile 一个 JSON 文档。
 * - 检索是确定性的字面匹配（子串 + 词元），结果可预测、可人工解释。
 *
 * 存储位置（按优先级）：
 *   1. config.dir 指定的绝对路径
 *   2. $DSH_HOME/light-memory/memories.json
 *   3. ~/.dsh/light-memory/memories.json
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const VERSION = 1
const MAX_TEXT = 2000
const MAX_TAGS = 12
const MAX_TAG = 40
const MAX_RECORDS = 5000
const MAX_SEARCH_LIMIT = 50

/**
 * 解析存储文件路径。DSH_HOME 未设置时退回 ~/.dsh。
 * @param {string | undefined} configuredDir 插件配置里的目录（可为绝对路径）
 * @returns {string} 记忆文件的绝对路径
 */
export function resolveStorePath(configuredDir) {
  if (typeof configuredDir === 'string' && configuredDir.trim() !== '') {
    const dir = isAbsolute(configuredDir) ? configuredDir : resolve(process.cwd(), configuredDir)
    return join(dir, 'memories.json')
  }
  const home = process.env.DSH_HOME?.trim() !== undefined && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(home, 'light-memory', 'memories.json')
}

/** 空文档。 */
function emptyDoc() {
  return { version: VERSION, records: [] }
}

/**
 * 读取文档；文件不存在时返回空文档，解析失败时抛错而不是静默清空。
 * @param {string} file 记忆文件路径
 * @returns {Promise<{version: number, records: object[]}>}
 */
export async function readDoc(file) {
  if (!existsSync(file)) return emptyDoc()
  const raw = await readFile(file, 'utf8')
  if (raw.trim() === '') return emptyDoc()
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`light-memory: ${file} 不是合法 JSON（${error instanceof Error ? error.message : String(error)}）`)
  }
  const records = Array.isArray(parsed?.records) ? parsed.records : []
  return {
    version: VERSION,
    records: records.filter(record => typeof record?.id === 'string' && typeof record?.text === 'string'),
  }
}

/**
 * 原子写入：先写临时文件再改名，避免中途崩溃留下半截文件。
 * @param {string} file 记忆文件路径
 * @param {{version: number, records: object[]}} doc 文档
 * @returns {Promise<void>}
 */
export async function writeDoc(file, doc) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  await rename(tmp, file)
}

/**
 * 归一化标签：去空白、去重、限制长度与数量。
 * @param {unknown} raw 模型传入的标签
 * @returns {string[]}
 */
export function normalizeTags(raw) {
  if (raw === undefined || raw === null) return []
  const list = Array.isArray(raw) ? raw : [raw]
  const seen = new Set()
  const tags = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const tag = item.trim().slice(0, MAX_TAG)
    if (tag === '') continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

/**
 * 归一化正文：去首尾空白，拒绝空串，限制最大长度。
 * @param {unknown} raw 模型传入的正文
 * @returns {string}
 */
export function normalizeText(raw) {
  if (typeof raw !== 'string') throw new Error('light-memory: text 必须是字符串')
  const text = raw.trim()
  if (text === '') throw new Error('light-memory: text 不能为空')
  if (text.length > MAX_TEXT) throw new Error(`light-memory: text 过长（上限 ${MAX_TEXT} 字符）`)
  return text
}

/**
 * 写入一条记忆。正文完全相同的记录视为同一条，更新时间而不是重复插入。
 * 记忆只有一层：全局共享，所有工作区与会话都能检索到。
 * 旧文件里遗留的 scope / workspace 字段会被忽略（不删不改）。
 * @param {{version: number, records: object[]}} doc 文档
 * @param {{text: string, tags: string[], inject?: boolean}} input 归一化后的输入
 * @param {string} now ISO 时间
 * @returns {{record: object, created: boolean, trimmed: number}}
 */
export function upsertRecord(doc, input, now) {
  const duplicate = doc.records.find(record => record.text === input.text)
  if (duplicate !== undefined) {
    duplicate.updatedAt = now
    if (input.tags.length > 0) duplicate.tags = normalizeTags([...duplicate.tags ?? [], ...input.tags])
    if (input.inject === true) duplicate.inject = true
    return { record: duplicate, created: false, trimmed: 0 }
  }
  const record = {
    id: randomUUID(),
    text: input.text,
    tags: input.tags,
    inject: input.inject === true,
    createdAt: now,
    updatedAt: now,
  }
  doc.records.push(record)
  let trimmed = 0
  // 超出上限时丢弃最久未更新的记录，保证文件不会无限增长。
  while (doc.records.length > MAX_RECORDS) {
    doc.records.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    doc.records.shift()
    trimmed++
  }
  return { record, created: true, trimmed }
}

/** 把文本切成用于字面匹配的词元：小写、按非字母数字与汉字切分。 */
function tokenize(value) {
  return String(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token !== '')
}

/**
 * 对一条记录打分。全部为字面规则：
 * - 查询整串出现在正文/标签中：高分
 * - 每个查询词元命中正文：加分
 * - 每个查询词元只命中标签：半分
 * @returns {number} 分数，0 表示不匹配
 */
function scoreRecord(record, query, queryTokens, requiredTags) {
  const text = record.text.toLowerCase()
  const tags = (record.tags ?? []).map(tag => tag.toLowerCase())
  for (const tag of requiredTags) {
    if (!tags.some(candidate => candidate === tag || candidate.includes(tag))) return 0
  }
  if (query === '') return 1
  let score = 0
  if (text.includes(query)) score += 5
  for (const token of queryTokens) {
    if (text.includes(token)) score += 2
    else if (tags.some(tag => tag.includes(token))) score += 1
  }
  return score
}

/**
 * 检索记忆：分数降序，同分按最近更新在前。
 * 记忆是全局的：不按工作区过滤，任何会话检索到的都是同一份。
 * @param {{version: number, records: object[]}} doc 文档
 * @param {{query?: string, tags?: string[], limit?: number}} options 查询
 * @returns {{items: object[], total: number, limit: number}}
 */
export function searchRecords(doc, options) {
  const query = typeof options.query === 'string' ? options.query.trim().toLowerCase() : ''
  const queryTokens = tokenize(query)
  const requiredTags = normalizeTags(options.tags).map(tag => tag.toLowerCase())
  const limit = clampLimit(options.limit)
  const scored = []
  for (const record of doc.records) {
    const score = scoreRecord(record, query, queryTokens, requiredTags)
    if (score > 0) scored.push({ record, score })
  }
  scored.sort((a, b) => b.score - a.score || String(b.record.updatedAt).localeCompare(String(a.record.updatedAt)))
  return {
    items: scored.slice(0, limit).map(item => ({ ...item.record, score: item.score })),
    total: scored.length,
    limit,
  }
}

/** 约束 limit 到 1..MAX_SEARCH_LIMIT，缺省 5。 */
function clampLimit(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 5
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.trunc(value)))
}

/**
 * 删除一条记忆。
 * @param {{version: number, records: object[]}} doc 文档
 * @param {string} id 记录 id（支持前缀唯一匹配）
 * @returns {{removed: object} | {error: string}}
 */
export function removeRecord(doc, id) {
  const key = String(id ?? '').trim()
  if (key === '') return { error: 'id 不能为空' }
  const exact = doc.records.findIndex(record => record.id === key)
  if (exact !== -1) return { removed: doc.records.splice(exact, 1)[0] }
  const matches = doc.records.filter(record => record.id.startsWith(key))
  if (matches.length === 0) return { error: `没有 id 以 ${JSON.stringify(key)} 开头的记忆` }
  if (matches.length > 1) return { error: `id 前缀 ${JSON.stringify(key)} 命中 ${matches.length} 条，请给出更长的前缀` }
  const index = doc.records.findIndex(record => record.id === matches[0].id)
  return { removed: doc.records.splice(index, 1)[0] }
}

/**
 * 切换一条记忆的"自动注入"标记。
 * @param {{version: number, records: object[]}} doc 文档
 * @param {string} id 记录 id（支持前缀唯一匹配）
 * @param {boolean} inject 是否自动注入
 * @returns {{record: object} | {error: string}}
 */
export function setInject(doc, id, inject) {
  const key = String(id ?? '').trim()
  if (key === '') return { error: 'id 不能为空' }
  const exact = doc.records.find(record => record.id === key)
  const matches = exact === undefined ? doc.records.filter(record => record.id.startsWith(key)) : [exact]
  if (matches.length === 0) return { error: `没有 id 以 ${JSON.stringify(key)} 开头的记忆` }
  if (matches.length > 1) return { error: `id 前缀 ${JSON.stringify(key)} 命中 ${matches.length} 条，请给出更长的前缀` }
  const record = matches[0]
  record.inject = inject === true
  record.updatedAt = new Date().toISOString()
  return { record }
}

/**
 * 取出需要自动注入的记忆：只含注入标记为真的，按更新时间倒序，数量与长度都设上限。
 * @param {{version: number, records: object[]}} doc 文档
 * @param {number} maxCount 最多几条
 * @returns {object[]}
 */
export function injectableRecords(doc, maxCount = 30) {
  return doc.records
    .filter(record => record.inject === true)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, maxCount)
}

/** 供 UI/日志使用的单行摘要。 */
export function summarize(record) {
  const head = record.text.length > 80 ? `${record.text.slice(0, 80)}…` : record.text
  const tags = (record.tags ?? []).length > 0 ? ` [${record.tags.join(', ')}]` : ''
  return `${record.id.slice(0, 8)} ${head}${tags}`
}

export { MAX_TEXT, MAX_TAGS, MAX_SEARCH_LIMIT, MAX_RECORDS }
