import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { apply } from '../lib/index.js';

// 端到端契约测试：真实客户端代码 → 真实宿主路由 → 临时 DSH_HOME 中的真实文件。
// 不使用浏览器、不读写真实个人技能或 profile。
const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function setup(home) {
  const routes = new Map();
  const ctx = {
    skills: {
      snapshot: async () => ({ complete: true, skills: [
        { name: 'test-bundled', description: 'Read me', source: 'bundled', provider: 'builtin' },
        { name: 'mine', description: '个人', source: 'personal' }
      ]}),
      get: async name => name === 'test-bundled' ? { name, source: 'bundled', content: 'system body' } : null
    },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => {}; } } }
  };
  process.env.DSH_HOME = home;
  apply(ctx);

  const fetchImpl = async (url, options = {}) => {
    const route = routes.get(new URL(url).pathname);
    if (!route) return { ok: false, json: async () => ({ error: '接口不存在' }) };
    const response = await route.fetch({ method: options.method || 'GET', text: async () => options.body || '' });
    const data = await response.json();
    return { ok: response.ok, json: async () => data };
  };

  let cursor = 0, tree, Page, module;
  const state = [], effects = [], listeners = {};
  const react = {
    Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useEffect(fn) { const i = cursor++; if (!(i in state)) { state[i] = true; effects.push(fn); } }
  };
  const window = {
    __ModuleLoader__: { load(spec) { module = spec.factory(name => { assert.equal(name, 'react'); return react; }); } },
    addEventListener(name, fn) { listeners[name] = fn; },
    removeEventListener(name) { delete listeners[name]; },
    confirm: () => true
  };
  vm.runInNewContext(source, { window, document: { baseURI: 'http://localhost/' }, fetch: fetchImpl, URL, console });
  module.apply({ slots: { inject(_n, fn) { fn(); }, register(spec, component) { if (spec.key === 'simple-skills') Page = component; } } });
  assert.ok(Page, '未注册主页面');

  const ui = {
    render() { cursor = 0; tree = Page(); return tree; },
    nodes() { const all = []; const visit = n => { if (Array.isArray(n)) return n.forEach(visit); if (!n || typeof n !== 'object') return; all.push(n); visit(n.children); }; visit(tree); return all; },
    text(n) { return n == null ? '' : Array.isArray(n) ? n.map(x => ui.text(x)).join('') : typeof n === 'object' ? ui.text(n.children) : String(n); },
    byText(type, label) { const n = ui.nodes().find(x => x.type === type && ui.text(x) === label); assert.ok(n, `未找到 ${type}: ${label}`); return n; },
    byLabel(label) { const n = ui.nodes().find(x => x.props['aria-label'] === label); assert.ok(n, `未找到 ${label}`); return n; },
    maybeText(type, label) { return ui.nodes().find(x => x.type === type && ui.text(x) === label); },
    async click(label) { const n = ui.byText('button', label); assert.notEqual(n.props.disabled, true, label + ' 不可点击'); const r = n.props.onClick(); ui.render(); return r; },
    async change(label, value) { const n = ui.byLabel(label); assert.notEqual(n.props.disabled, true, label + ' 被禁用'); const r = n.props.onChange({ target: { value, checked: value } }); ui.render(); return r; },
    // 用 setImmediate 推进微任务与文件 I/O；界面文本连续多轮不变即视为稳定。
    async flush() {
      let stable = 0, last = null;
      for (let i = 0; i < 3000; i++) {
        await new Promise(r => setImmediate(r));
        ui.render();
        const now = ui.text(tree);
        if (now === last) { if (++stable >= 100) return; } else { stable = 0; last = now; }
      }
      assert.fail('界面在限定轮次内未稳定');
    },
    listeners
  };
  ui.render();
  effects.splice(0).forEach(fn => fn());
  return { ui, home };
}

test('真实客户端 ↔ 真实路由 ↔ 真实文件：中文覆盖、新建、开关、回收恢复全链路', async () => {
  const home = await mkdtemp(join(tmpdir(), 'simple-skills-e2e-'));
  const previous = process.env.DSH_HOME;
  let ui;
  try {
    ({ ui } = setup(home));
    await ui.flush();
    assert.ok(ui.maybeText('button', '系统自带 1'), '系统技能计数');

    // 系统技能：只读正文 + 中文描述覆盖写入独立文件
    await ui.click('test-bundledRead me');
    await ui.flush();
    assert.equal(ui.byLabel('系统技能原文').props.value, 'system body');
    assert.equal(ui.byLabel('系统技能原文').props.readOnly, true);
    await ui.change('中文描述覆盖', '中文覆盖描述');
    await ui.click('保存中文描述');
    await ui.flush();
    const zhFile = JSON.parse(await readFile(join(home, 'simple-skills', 'descriptions.json'), 'utf8'));
    assert.deepEqual(zhFile, { 'test-bundled': '中文覆盖描述' });
    assert.ok(ui.maybeText('button', '系统自带 1'));

    // 个人技能：新建 → 落盘 → 列表出现
    await ui.click('个人技能 0');
    ui.render();
    await ui.click('新建技能');
    await ui.change('技能名称', 'demo');
    await ui.change('技能描述', '个人描述');
    await ui.change('技能正文', '执行步骤\n');
    await ui.click('保存技能');
    await ui.flush();
    const saved = await readFile(join(home, 'skills', 'demo.md'), 'utf8');
    assert.match(saved, /name: demo/);
    assert.match(saved, /description: 个人描述/);
    assert.match(saved, /执行步骤/);
    assert.ok(ui.maybeText('button', '个人技能 1'));

    // 调用开关：只写 frontmatter 对应键
    await ui.click('demo个人描述');
    ui.render();
    await ui.change('允许模型调用', false);
    await ui.flush();
    const toggled = await readFile(join(home, 'skills', 'demo.md'), 'utf8');
    assert.match(toggled, /disable-model-invocation: true/);
    assert.match(toggled, /description: 个人描述/);
    assert.equal(ui.byLabel('允许模型调用').props.checked, false);

    // 删除 → 回收站 → 恢复
    await ui.click('移入回收站');
    await ui.flush();
    assert.deepEqual(await readdir(join(home, 'skills')), []);
    const trashEntries = await readdir(join(home, 'simple-skills-trash'));
    assert.equal(trashEntries.length, 1);
    await ui.click('回收站 1');
    ui.render();
    await ui.click('恢复');
    await ui.flush();
    assert.deepEqual(await readdir(join(home, 'skills')), ['demo.md']);
    assert.deepEqual(await readdir(join(home, 'simple-skills-trash')), []);
    assert.match(await readFile(join(home, 'skills', 'demo.md'), 'utf8'), /disable-model-invocation: true/);
    // 再次移入回收站，走真实客户端、路由和临时文件彻底删除。
    await ui.click('个人技能 1');
    await ui.click('demo个人描述');
    await ui.click('移入回收站');
    await ui.flush();
    await ui.click('回收站 1');
    await ui.click('彻底删除');
    await ui.flush();
    assert.deepEqual(await readdir(join(home, 'simple-skills-trash')), []);
    assert.deepEqual(await readdir(join(home, 'skills')), []);
    assert.ok(ui.maybeText('p', '技能已彻底删除，无法恢复。'));
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    await rm(home, { recursive: true, force: true });
  }
});
