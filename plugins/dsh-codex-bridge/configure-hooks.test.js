import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { configureHooks } from './configure-hooks.js'

function temporaryConfig(t) {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-hooks-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return join(directory, 'hooks.json')
}

test('configure five user hooks without duplicating existing commands or replacing other hooks', t => {
  const file = temporaryConfig(t)
  const script = 'C:/Test Home/packages/0.6.8/turn-channel.js'
  const node = 'C:/PROGRA~1/nodejs/node.exe'
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'existing' }] }
  const previous = { hooks: [{ type: 'command', command: 'node.exe "' + script + '"', timeout: 6 }] }
  const original = JSON.stringify({ name: 'keep', hooks: { PostToolUse: [other, previous] } })
  writeFileSync(file, original)
  const backup = configureHooks(file, script, node)
  assert.equal(readFileSync(backup, 'utf8'), original)
  const installed = readFileSync(file, 'utf8')
  const result = JSON.parse(installed)
  assert.equal(result.name, 'keep')
  assert.equal(result.hooks.PostToolUse.length, 2)
  assert.deepEqual(result.hooks.PostToolUse[0], other)
  assert.equal(Object.keys(result.hooks).length, 5)
  assert.equal(result.hooks.Stop[0].hooks[0].command, node + ' "' + script + '"')
  assert.equal(result.hooks.PostToolUse[1].hooks[0].command, result.hooks.Stop[0].hooks[0].command)
  configureHooks(file, script, node)
  assert.equal(readFileSync(file, 'utf8'), installed)
})

const events = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Interrupt']
const pathFor = version => 'C:/Example User/AppData/Local/DSH Codex Bridge/packages/' + version + '/turn-channel.js'
const node = 'C:/PROGRA~1/nodejs/node.exe'
const hookFor = (script, timeout = 6, executable = node) => ({
  type: 'command', command: executable + ' "' + script + '"', timeout
})
const groupsFor = version => ({ hooks: [hookFor(pathFor(version))] })

test('fresh installation writes the five commands and caps Interrupt at three seconds', t => {
  const file = temporaryConfig(t)
  const current = pathFor('0.7.0')
  assert.equal(configureHooks(file, current, node), undefined)
  const bytes = readFileSync(file, 'utf8')
  const config = JSON.parse(bytes)
  assert.deepEqual(config.hooks, Object.fromEntries(events.map(event =>
    [event, [{ hooks: [hookFor(current, event === 'Interrupt' ? 3 : 6)] }]])))
  assert.equal(configureHooks(file, current, node), undefined)
  assert.equal(readFileSync(file, 'utf8'), bytes)
})

test('upgrades five installed legacy hooks without retaining duplicate bridge commands', t => {
  const file = temporaryConfig(t)
  const current = pathFor('0.7.0')
  const original = { hooks: Object.fromEntries(events.map(event => [event, [groupsFor('0.6.8')]])) }
  original.hooks.Interrupt[0].hooks[0].timeout = 3
  const originalText = '\uFEFF' + JSON.stringify(original)
  writeFileSync(file, originalText)
  const backup = configureHooks(file, current, node)
  assert.equal(readFileSync(backup, 'utf8'), originalText)
  const bytes = readFileSync(file, 'utf8')
  assert.deepEqual(JSON.parse(bytes).hooks, Object.fromEntries(events.map(event =>
    [event, [{ hooks: [hookFor(current, event === 'Interrupt' ? 3 : 6)] }]])))
  assert.equal(configureHooks(file, current, node), undefined)
  assert.equal(readFileSync(file, 'utf8'), bytes)
})

test('removes only stock duplicates and preserves custom hooks and their metadata', t => {
  const file = temporaryConfig(t)
  const current = pathFor('0.7.0')
  const customGroup = { matcher: 'Bash', ...groupsFor('0.6.8') }
  const customLegacy = { ...hookFor(pathFor('0.6.8')), statusMessage: 'Custom old hook' }
  const otherRoot = hookFor(pathFor('0.6.8').replace('Example User', 'Other User'))
  const unknownVersion = hookFor(pathFor('0.6.7'))
  const unrelated = { type: 'command', command: 'some-other-hook', timeout: 9, statusMessage: 'Keep this' }
  const customCurrent = { ...hookFor(current, 2), statusMessage: 'Preserve current settings' }
  const extraEvent = [{ hooks: [unrelated] }]
  const config = { marker: { enabled: true }, hooks: {
    SessionStart: extraEvent,
    PreToolUse: [
      customGroup,
      { hooks: [hookFor(pathFor('0.6.9').replaceAll('/', '\\').toUpperCase()), unrelated] },
      groupsFor('0.6.10'), groupsFor('0.6.11')
    ],
    PostToolUse: [
      { hooks: [hookFor(pathFor('0.6.8')), unrelated, customLegacy] },
      groupsFor('0.7.0'),
      { hooks: [otherRoot, unknownVersion] }
    ],
    Interrupt: [groupsFor('0.6.9'), { hooks: [customCurrent, hookFor(current)] }]
  } }
  const old = JSON.stringify(config)
  writeFileSync(file, old)
  const backup = configureHooks(file, current, node)
  assert.equal(readFileSync(backup, 'utf8'), old)
  const bytes = readFileSync(file, 'utf8')
  const result = JSON.parse(bytes)
  assert.deepEqual(result.marker, config.marker)
  assert.deepEqual(result.hooks.SessionStart, extraEvent)
  assert.deepEqual(result.hooks.PreToolUse, [customGroup, { hooks: [hookFor(current), unrelated] }])
  assert.deepEqual(result.hooks.PostToolUse, [{ hooks: [unrelated, customLegacy] }, groupsFor('0.7.0'), { hooks: [otherRoot, unknownVersion] }])
  assert.deepEqual(result.hooks.Interrupt, [{ hooks: [customCurrent] }])
  assert.equal(configureHooks(file, current, node), undefined)
  assert.equal(readFileSync(file, 'utf8'), bytes)
})

test('rerunning the current installer repairs only an over-limit Interrupt timeout', t => {
  const file = temporaryConfig(t)
  const current = pathFor('0.7.0')
  const original = { hooks: Object.fromEntries(events.map(event => [event, [groupsFor('0.7.0')]])) }
  const old = JSON.stringify(original)
  writeFileSync(file, old)
  const backup = configureHooks(file, current, node)
  assert.equal(readFileSync(backup, 'utf8'), old)
  const result = JSON.parse(readFileSync(file, 'utf8'))
  original.hooks.Interrupt[0].hooks[0].timeout = 3
  assert.deepEqual(result, original)
  assert.equal(configureHooks(file, current, node), undefined)
})
