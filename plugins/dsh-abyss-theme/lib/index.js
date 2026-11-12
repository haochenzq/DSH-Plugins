/**
 * dsh-abyss-theme —— 宿主侧：把主题资源（底图）通过 /api 路由供客户端使用。
 *
 * 路由走 ctx.connection.fetch.register：/api 前缀由 dsh-client-connection 统一做
 * cookie 鉴权，未认证请求返回 401，不会把本机文件裸露给任意进程。
 * 只用 node: 内置模块，不联网、不调用模型。
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 路由前缀（必须在 /api 下才会被鉴权层接管）。 */
export const BASE_PATH = '/api/dsh-abyss-theme'

const here = dirname(fileURLToPath(import.meta.url))
const assetDir = join(here, '..', 'assets')

/** 对外暴露的静态资源：路由后缀 → 文件与类型。 */
const ASSETS = {
  '/wallpaper.png': { file: 'deepseek-abyss.png', type: 'image/png' },
  '/hero.png': { file: 'deepseek-abyss.png', type: 'image/png' },
}

export const name = 'abyss-theme'
export const inject = ['connection']

/**
 * 注册资源路由。
 * @param ctx 插件上下文
 * @param options 插件配置（目前只需 wallpaper 开关，客户端自行读取）
 */
export function apply(ctx, config = {}) {
  const disabled = config.wallpaper === false
  for (const [suffix, asset] of Object.entries(ASSETS)) {
    ctx.connection.fetch.register({
      path: BASE_PATH + suffix,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => {
        if (disabled && suffix === '/wallpaper.png') {
          return new Response('', { status: 404 })
        }
        const body = await readFile(join(assetDir, asset.file))
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': asset.type,
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    })
  }
}
