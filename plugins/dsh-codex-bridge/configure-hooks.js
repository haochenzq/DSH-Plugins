import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { constants, copyFileSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Interrupt']

// Only releases that installed this stock hook layout can be migrated.
const legacyVersions = new Set(['0.6.8', '0.6.9', '0.6.10', '0.6.11'])
const packageScript = /^([a-z]:\/(?:.*\/)?dsh codex bridge\/packages)\/(\d+\.\d+\.\d+)\/turn-channel\.js$/
const nodeScript = /^(?:"[^"]*[\\/]node(?:\.exe)?"|[^"\s]*[\\/]node(?:\.exe)?|node(?:\.exe)?)\s+"([^"]+)"$/i
const hasOnlyKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key))

function findBridgeHooks(groups, event, path, command) {
  const target = packageScript.exec(path)
  const entries = []
  for (const group of groups) {
    if (!Array.isArray(group?.hooks)) throw new Error('Expected hook list for ' + event)
    if (group.matcher != null && group.matcher !== '') continue
    for (const hook of group.hooks) {
      if (hook?.type !== 'command' || hook.async || hook.commandWindows || typeof hook.command !== 'string') continue
      const script = nodeScript.exec(hook.command)?.[1].replaceAll('\\', '/').toLowerCase()
      const stock = hasOnlyKeys(group, ['hooks', 'matcher']) && hasOnlyKeys(hook, ['type', 'command', 'timeout'])
      if (hook.command === command || script === path) {
        entries.push({ hook, current: true, stock })
        continue
      }
      if (!stock || !script || target?.[2] !== '0.7.0') continue
      const previous = packageScript.exec(script)
      if (previous?.[1] === target[1] && legacyVersions.has(previous[2])) {
        entries.push({ hook, current: false, stock: true })
      }
    }
  }
  return entries
}

function installedNodePath() {
  const executable = realpathSync.native(process.execPath)
  if (process.platform !== 'win32' || !executable.includes(' ')) return executable
  const command = join(process.env.SystemRoot, 'System32', 'cmd.exe')
  const args = ['/d', '/v:off', '/u', '/c', 'for %I in ("%DSH_CODEX_SETUP_NODE%") do @echo %~sI']
  const short = execFileSync(command, args, { encoding: 'utf16le', windowsHide: true,
    windowsVerbatimArguments: true, env: { ...process.env, DSH_CODEX_SETUP_NODE: executable } }).trim()
  if (!short || realpathSync.native(short).toLowerCase() !== executable.toLowerCase()) {
    throw new Error('Could not resolve the installed Node executable.')
  }
  return short
}

export function configureHooks(file, script, executable = installedNodePath()) {
  const path = script.replaceAll('\\', '/')
  const node = executable.replaceAll('\\', '/')
  if (/["`$%!\r\n]/.test(path + node)) throw new Error('Use installation paths without shell expansion characters.')
  const command = (/^[\w:.~/\-]+$/.test(node) ? node : '"' + node + '"') + ' "' + path + '"'
  let original
  try {
    original = readFileSync(file, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const root = original === undefined ? {} : JSON.parse(original.replace(/^\uFEFF/, ''))
  if (!root || typeof root !== 'object' || Array.isArray(root)) throw new Error('Expected a hooks.json object.')
  if (root.hooks === undefined) root.hooks = {}
  if (!root.hooks || typeof root.hooks !== 'object' || Array.isArray(root.hooks)) throw new Error('Expected a hooks object.')
  let changed = false
  for (const event of events) {
    if (root.hooks[event] === undefined) root.hooks[event] = []
    const groups = root.hooks[event]
    if (!Array.isArray(groups)) throw new Error('Expected hook groups for ' + event)
    const entries = findBridgeHooks(groups, event, path.toLowerCase(), command)
    const keep = entries.find(entry => entry.current && !entry.stock) ?? entries.find(entry => entry.current) ?? entries[0]
    const timeout = event === 'Interrupt' ? 3 : 6
    if (!keep) {
      groups.push({ hooks: [{ type: 'command', command, timeout }] })
      changed = true
      continue
    }
    if (keep.hook.command !== command) {
      keep.hook.command = command
      changed = true
    }
    if (event === 'Interrupt' && (keep.hook.timeout === undefined || keep.hook.timeout > timeout)) {
      keep.hook.timeout = timeout
      changed = true
    }
    const duplicates = new Set(entries.filter(entry => entry !== keep && entry.stock).map(entry => entry.hook))
    if (duplicates.size) {
      for (let index = groups.length - 1; index >= 0; index--) {
        const group = groups[index]
        const remaining = group.hooks.filter(hook => !duplicates.has(hook))
        if (remaining.length === group.hooks.length) continue
        if (remaining.length) group.hooks = remaining
        else groups.splice(index, 1)
      }
      changed = true
    }
  }
  if (!changed) return
  mkdirSync(dirname(file), { recursive: true })
  const temporary = file + '.' + randomUUID() + '.tmp'
  try {
    writeFileSync(temporary, JSON.stringify(root, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    if (original === undefined) {
      copyFileSync(temporary, file, constants.COPYFILE_EXCL)
    } else {
      if (readFileSync(file, 'utf8') !== original) throw new Error('hooks.json changed during setup. Run setup again.')
      const backup = file + '.' + randomUUID() + '.bak'
      copyFileSync(file, backup, constants.COPYFILE_EXCL)
      renameSync(temporary, file)
      return backup
    }
  } finally {
    rmSync(temporary, { force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const home = process.env.CODEX_HOME || join(homedir(), '.codex')
  const file = join(home, 'hooks.json')
  const backup = configureHooks(file, fileURLToPath(new URL('./turn-channel.js', import.meta.url)))
  if (backup) console.log('Previous configuration saved to', backup)
  console.log('Review the five Codex bridge hooks using /hooks:', file)
}
