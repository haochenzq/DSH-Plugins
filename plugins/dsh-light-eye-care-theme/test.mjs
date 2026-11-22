import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFileSync(join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
assert.equal(pkg.name, 'dsh-light-eye-care-theme')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
for (const f of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'locale/zh.json', 'locale/en.json', 'icon.svg', 'README.md']) assert.ok(existsSync(join(root, f)), f)
for (const lang of ['zh', 'en']) {
  const locale = JSON.parse(read(`locale/${lang}.json`))
  assert.ok(locale.meta.title && locale.meta.description)
}
assert.match(read('cordis.patch.yml'), /- insert:\s+- id: light-eye-care-theme\s+name: dsh-light-eye-care-theme\s+config: \{\}/)
const icon = read('icon.svg')
assert.match(icon, /<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/)
assert.doesNotMatch(icon, /<script|<style|<foreignObject|\bon\w+=/i)

const source = read('lib/client.js')
const design = readFileSync(resolve(root, '../../themes/dsh-abyss-theme-design/theme.css'), 'utf8')
const palette = Object.fromEntries([...source.matchAll(/'([a-z-]+)': '(#[0-9A-F]{6})'/g)].map(m => [m[1], m[2]]))
const designPalette = Object.fromEntries([...design.matchAll(/--ds-light-([a-z-]+):\s*(#[0-9A-F]{6});/g)].map(m => [m[1], m[2]]))
assert.ok(Object.keys(palette).length >= 20)
assert.deepEqual(palette, designPalette, 'plugin palette must exactly match design source')
assert.match(source, /prefers-reduced-motion: no-preference/)
assert.doesNotMatch(source, /localStorage|sessionStorage|\bfetch\s*\(/)
let moduleFactory
runInNewContext(source, { window: { __ModuleLoader__: { load: ({ id, factory }) => { assert.equal(id, pkg.name); moduleFactory = factory } } } })
assert.equal(typeof moduleFactory, 'function')
const plugin = moduleFactory()
assert.equal(plugin.inject[0], 'theme')
let scheme = 'dark', layer = null, cleanup, registrations = 0, removals = 0
const listeners = new Set()
const snapshot = () => ({ active: { colorScheme: scheme, tokens: layer
  ? Object.fromEntries(Object.entries(layer.pairs).map(([k, pair]) => [k, pair[scheme]])) : {} } })
// 按 ThemeRuntime 的行为，发射时固定快照；模拟 presenter 比插件更晚订阅。
const notify = () => { const event = snapshot(); for (const f of [...listeners]) f(event) }
const setScheme = (next) => { scheme = next; notify() }
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const ctx = {
  theme: {
    getTheme: snapshot,
    overrideTokens(id, pairs) {
      assert.equal(id, pkg.name)
      const own = { pairs }
      layer = own
      registrations++
      notify()
      return () => {
        if (layer !== own) return
        layer = null
        removals++
        notify()
      }
    },
  },
  on(name, fn) { assert.equal(name, 'theme/change'); listeners.add(fn); return () => listeners.delete(fn) },
  effect(fn) { cleanup = fn() },
}
let presented = snapshot()
const presenter = event => { presented = event }
plugin.apply(ctx)
listeners.add(presenter)
await flush()
assert.equal(layer, null, 'dark mode must not be overridden')
assert.equal(registrations, 0)
// 模拟启动时宿主异步恢复内置浅色，再在后续事件切换深色。
setScheme('light')
await flush()
assert.equal(registrations, 1)
assert.equal(layer.pairs['--dsw-alias-bg-base'].light, palette.base)
assert.equal(layer.pairs['--dsw-specific-sidebar-fill'].light, palette.sidebar)
assert.equal(layer.pairs['--dsw-alias-label-primary'].light, palette.text)
assert.equal(layer.pairs['--dsw-alias-button-primary-fill'].light, palette.success)
assert.equal(layer.pairs['--dsw-alias-brand-primary-new-colorprimary-new-color'].light, palette['blue-ink'])
for (const pair of Object.values(layer.pairs)) assert.equal(pair.light, pair.dark)
assert.equal(presented.active.tokens['--dsw-alias-bg-base'], palette.base)
notify()
await flush()
assert.equal(registrations, 1, 'same-mode notifications do not reinstall')
setScheme('dark')
await flush()
assert.equal(layer, null)
assert.equal(scheme, 'dark')
assert.equal(presented.active.colorScheme, 'dark')
assert.equal(presented.active.tokens['--dsw-alias-bg-base'], undefined, 'presenter must not retain stale light tokens')
assert.equal(removals, 1)
setScheme('light')
await flush()
assert.equal(registrations, 2)
assert.ok(layer)
// 快速来回切换在一个广播栈内合并，以最终方案为准。
setScheme('dark')
setScheme('light')
await flush()
assert.ok(layer)
assert.equal(presented.active.colorScheme, 'light')
assert.equal(presented.active.tokens['--dsw-alias-bg-base'], palette.base)
// 在另一个监听器的广播中卸载，最终 presenter 也必须收到无覆盖快照。
const disposeOnDark = event => { if (event.active.colorScheme === 'dark') cleanup() }
listeners.add(disposeOnDark)
setScheme('dark')
listeners.delete(disposeOnDark)
await flush()
assert.equal(layer, null)
assert.equal(presented.active.colorScheme, 'dark')
assert.equal(presented.active.tokens['--dsw-alias-bg-base'], undefined)
assert.equal(scheme, 'dark')
listeners.delete(presenter)
assert.equal(listeners.size, 0)
// 卸载后又重新启用，等待过期微任务，旧 disposer 不得移除新层。
setScheme('light')
plugin.apply(ctx)
await flush()
assert.ok(layer)
cleanup()
plugin.apply(ctx)
await flush()
assert.ok(layer)
cleanup()
await flush()
assert.equal(layer, null)
assert.equal(listeners.size, 0)
// 另一个监听器在 overrideTokens 的同步广播中卸载本插件。
plugin.apply(ctx)
const disposeOnRegistration = () => { if (layer) cleanup() }
listeners.add(disposeOnRegistration)
await flush()
listeners.delete(disposeOnRegistration)
assert.equal(layer, null, 'unload during registration must remove the just-created layer')
assert.equal(listeners.size, 0)

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(s => parseInt(s, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((u, v) => v - u)
  return (x + 0.05) / (y + 0.05)
}
for (const [ink, fill] of [
  ['text', 'base'], ['text', 'sidebar'], ['text', 'surface'], ['text', 'selection'],
  ['text-secondary', 'sidebar'], ['text-secondary', 'surface'], ['text-tertiary', 'surface'],
  ['text-secondary', 'selection-strong'], ['text-tertiary', 'selection-strong'],
  ['blue-ink', 'base'], ['success', 'surface'], ['warn', 'surface'], ['error', 'surface'],
  ['inverse-text', 'success'], ['inverse-text', 'accent-hover'], ['inverse-text', 'blue-ink'],
]) {
  const result = contrast(palette[ink], palette[fill])
  assert.ok(result >= 4.5, `${ink} on ${fill}: ${result.toFixed(2)} < 4.5`)
  console.log(`${ink} / ${fill}: ${result.toFixed(2)}:1`)
}
// Settings 的强调文字可能出现在同一强调色 8% 与表面混合的底上。
function mix(foreground, background, alpha) {
  const a = foreground.slice(1).match(/../g).map(v => parseInt(v, 16))
  const b = background.slice(1).match(/../g).map(v => parseInt(v, 16))
  return '#' + a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}
for (const background of ['base', 'surface', 'sidebar']) {
  const ratio = contrast(palette['blue-ink'], mix(palette['blue-ink'], palette[background], 0.08))
  assert.ok(ratio >= 4.5, `blue-ink over 8% tint on ${background}: ${ratio.toFixed(2)}`)
  console.log(`blue-ink / 8% tint on ${background}: ${ratio.toFixed(2)}:1`)
}
const trajectory = mix(palette['blue-ink'], palette.error, 0.6)
const trajectoryBackground = mix(trajectory, palette.surface, 0.15)
const trajectoryRatio = contrast(trajectory, trajectoryBackground)
assert.ok(trajectoryRatio >= 4.5, `trajectory text: ${trajectoryRatio.toFixed(2)}:1`)
console.log(`trajectory text / 15% mixed fill: ${trajectoryRatio.toFixed(2)}:1`)
const borderRatio = contrast(palette['border-strong'], palette['secondary-surface'])
assert.ok(borderRatio >= 3, `interactive border: ${borderRatio.toFixed(2)}:1`)
console.log(`interactive border / secondary surface: ${borderRatio.toFixed(2)}:1`)
console.log(`OK: ${Object.keys(palette).length} design tokens, manifest, lifecycle race and contrast pairs`)
