const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8');
const design = fs.readFileSync(path.join(root, '../../themes/dsh-abyss-theme-design/theme.css'), 'utf8');

function harness(initial = {}) {
  const state = []; const cleanup = []; let cursor = 0; let slot;
  const react = {
    Fragment: 'fragment',
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
    useState(init) { const i = cursor++; if (!(i in state)) state[i] = typeof init === 'function' ? init() : init; return [state[i], (v) => { state[i] = v; }]; },
    useRef(init) { const i = cursor++; if (!(i in state)) state[i] = { current: init }; return state[i]; },
    useEffect(effect) { const i = cursor++; if (!(i in state)) { state[i] = true; cleanup.push(effect()); } },
  };
  const listeners = {}; const storage = { ...initial }; const attrs = {}; const styles = [];
  const events = { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: (name, fn) => { if (listeners[name] === fn) delete listeners[name]; } };
  const document = { ...events, hidden: false, documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } },
    createElement: () => ({ remove() { this.removed = true; } }), head: { append: (s) => styles.push(s) } };
  const localStorage = { getItem: (k) => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; } };
  let module;
  const window = { ...events, localStorage, __ModuleLoader__: { load: (def) => { module = def.factory(() => react); } } };
  vm.runInNewContext(source, { window, document });
  let tokens; let tokenRemoved = false;
  const ctx = { effect: (fn) => { cleanup.push(fn()); }, theme: { overrideTokens: (id, pairs) => { tokens = pairs; return () => { tokenRemoved = true; }; } },
    slots: { inject: (name, fn) => { assert.equal(name, 'shell.overlay'); fn(); }, register: (info, component) => { slot = { info, component }; } } };
  module.apply(ctx);
  const render = () => { cursor = 0; return slot.component(); };
  return { render, styles, attrs, storage, listeners, tokens, slot, cleanup, document, get tokenRemoved() { return tokenRemoved; } };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((item) => find(item, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...find(node.children || [], predicate)];
}
function byClass(tree, name) { return find(tree, (n) => (n.props.className || '').split(' ').includes(name)); }

test('manifest, canonical palette, and no external resources', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(pkg.exports['./client'], './lib/client.js');
  const env = harness();
  const css = env.styles[0].textContent;
  const block = design.match(/:root\s*\{\s*--ds-cosmos-base:[\s\S]*?\}/)[0];
  const matches = [...block.matchAll(/--ds-cosmos-([\w-]+):\s*([^;]+);/g)];
  assert.ok(matches.length >= 20);
  for (const [, name, value] of matches) assert.ok(css.includes(`--ds-cosmos-${name}:${value.trim()}`), name);
  const clientTokens = [...css.matchAll(/--ds-cosmos-([\w-]+):([^;{}]+)[;}]/g)];
  assert.equal(clientTokens.length, matches.length, 'client and design have exactly the same palette');
  assert.ok(Object.keys(env.tokens).length > 20);
  const luminance = (hex) => {
    const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const contrast = (luminance(env.tokens['--dsw-alias-brand-primary-invert'].dark) + .05) / (luminance(env.tokens['--dsw-alias-brand-primary'].dark) + .05);
  assert.ok(contrast >= 4.5, `primary text contrast ${contrast}`);
  assert.ok(!/https?:\/\/|\bfetch\s*\(|url\(/i.test(source));
});

test('defaults, controls, persistence, visibility and lifecycle', () => {
  const env = harness(); let tree = env.render();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  assert.equal(env.attrs['data-cosmos-applied'], pkg.version, 'client diagnostic version must match the package');
  assert.equal(env.slot.info.id, 'cosmos.starfield');
  assert.equal(byClass(tree, 'cosmos-star').length, 145);
  assert.equal(byClass(tree, 'cosmos-meteor').length, 3);
  let sky = byClass(tree, 'cosmos-sky')[0];
  assert.equal(sky.props['data-scene'], 'nebula'); assert.equal(sky.props['data-motion'], 'quiet');
  byClass(tree, 'cosmos-launcher')[0].props.onClick(); tree = env.render();
  let selects = find(tree, (n) => n.type === 'select'); assert.equal(selects.length, 2);
  selects[0].props.onChange({ target: { value: 'whale' } }); tree = env.render();
  selects = find(tree, (n) => n.type === 'select'); selects[1].props.onChange({ target: { value: 'rich' } }); tree = env.render();
  sky = byClass(tree, 'cosmos-sky')[0];
  assert.equal(sky.props['data-scene'], 'whale'); assert.equal(sky.props['data-motion'], 'rich');
  assert.deepEqual(JSON.parse(env.storage['dsh-cosmos-theme.settings']), { scene: 'whale', motion: 'rich' });
  env.storage['dsh-cosmos-theme.settings'] = '{"scene":"focus","motion":"still"}';
  env.listeners.storage({ key: 'dsh-cosmos-theme.settings' }); tree = env.render();
  assert.equal(byClass(tree, 'cosmos-sky')[0].props['data-scene'], 'focus');
  assert.equal(byClass(tree, 'cosmos-sky')[0].props['data-motion'], 'still');
  env.document.hidden = true; env.listeners.visibilitychange(); tree = env.render();
  assert.equal(byClass(tree, 'cosmos-sky')[0].props['data-hidden'], 'true');
  for (const dispose of env.cleanup.reverse()) if (typeof dispose === 'function') dispose();
  assert.equal(env.tokenRemoved, true); assert.equal(env.styles[0].removed, true);
  assert.equal(env.attrs['data-cosmos-applied'], undefined); assert.equal(Object.keys(env.listeners).length, 0);
});

test('settings validation, reduced motion, non-blocking layers and meteor policy', () => {
  const env = harness({ 'dsh-cosmos-theme.settings': '{"scene":"invalid","motion":"still"}' });
  const sky = byClass(env.render(), 'cosmos-sky')[0];
  assert.equal(sky.props['data-scene'], 'nebula'); assert.equal(sky.props['data-motion'], 'still');
  const css = env.styles[0].textContent;
  assert.match(css, /\.cosmos-sky\{[^}]*pointer-events:none!important/);
  assert.match(css, /\.cosmos-controls\{[^}]*pointer-events:none/);
  assert.match(css, /\.cosmos-controls\{[^}]*left:12px;bottom:138px/);
  assert.match(css, /\.cosmos-launcher\{[^}]*width:30px;height:30px/);
  assert.match(css, /\.cosmos-panel\{[^}]*margin-bottom:5px/);
  assert.match(css, /@media\(max-width:600px\)\{.*\.cosmos-controls\{top:64px;bottom:auto/);
  assert.match(css, /\.cosmos-controls button,\.cosmos-controls select\{[^}]*pointer-events:auto/);
  assert.match(css, /data-motion=rich\]\) \.cosmos-meteor/);
  assert.match(css, /\[data-motion=rich\] \.cosmos-star\{animation-name:cosmos-twinkle-rich;animation-duration:calc\(var\(--period\) \* \.45\)/);
  assert.match(css, /\[data-motion=rich\] \.cosmos-meteor\{animation-name:cosmos-meteor-rich/);
  assert.match(css, /@keyframes cosmos-twinkle-rich\{from\{opacity:\.04/);
  assert.match(css, /\.cosmos-meteor--3\{right:5%;top:33%/);
  assert.match(css, /data-scene=focus\] \.cosmos-meteor\{display:none/);
  const focus = '.cosmos-sky[data-scene=focus] .cosmos-cloud{opacity:.08}.cosmos-sky[data-scene=focus] .cosmos-star{opacity:.12;animation:none}';
  assert.ok(css.includes(focus), 'focus keeps clouds subdued and stars still');
  assert.ok(css.indexOf(focus) > css.indexOf('.cosmos-sky[data-motion=rich] .cosmos-star{'), 'focus must override rich star animation');
  assert.ok(css.indexOf(focus) > css.indexOf('.cosmos-sky[data-motion=rich] .cosmos-cloud{'), 'focus must override rich cloud opacity');
  assert.match(css, /prefers-reduced-motion:reduce[^}]*animation:none!important\}\.cosmos-meteor\{display:none!important/);
  assert.match(css, /data-hidden=true\] \*\{animation-play-state:paused!important/);
});
