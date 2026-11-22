import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { apply } from '../lib/index.js';

// 模拟宿主 ctx：只提供插件用到的 skills/connection/workspaceRegistry 接口，全部走临时 DSH_HOME。
function setup(home, options = {}) {
  const routes = new Map();
  const ctx = {
    skills: {
      snapshot: async () => ({ complete: true, skills: [
        { name: 'office', description: 'English office', source: 'bundled', provider: 'builtin' },
        { name: 'mine', description: '个人技能', source: 'personal' }
      ]}),
      get: async name => name === 'office' ? { name, source: 'bundled', content: 'system body' } : name === 'mine' ? { name, source: 'personal', content: 'user body' } : null
    },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => {}; } } },
    get(name) { return name === 'workspaceRegistry' ? options.registry : undefined; }
  };
  process.env.DSH_HOME = home;
  apply(ctx);
  const call = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const route = routes.get('/api/simple-skills/' + path);
    assert.ok(route, '未注册路由 ' + path);
    assert.ok(route.methods.includes(method), method + ' 不在 ' + path + ' 的允许方法内');
    const response = await route.fetch({ method, text: async () => JSON.stringify(body ?? {}) });
    return { status: response.status, data: await response.json() };
  };
  return { routes, call };
}

test('路由契约：系统技能只读、个人保存/开关/回收恢复、中文描述独立存放', async () => {
  const home = await mkdtemp(join(tmpdir(), 'simple-skills-route-'));
  const previous = process.env.DSH_HOME;
  try {
    const { call } = setup(home);

    let list = await call('list');
    assert.equal(list.status, 200);
    assert.deepEqual(list.data.system.map(s => s.name), ['office']);
    assert.equal(list.data.system[0].provider, 'builtin');
    assert.deepEqual(list.data.personal, []);
    assert.deepEqual(list.data.projects, [], '没有工作区注册表时不返回项目技能');
    assert.deepEqual(list.data.translations, {});
    assert.equal(list.data.complete, true);
    assert.equal(list.data.root, join(home, 'skills'));

    assert.equal((await call('system', { name: 'office' })).data.content, 'system body');
    assert.equal((await call('system', { name: 'mine' })).status, 400);
    assert.match((await call('system', { name: 'mine' })).data.error, /系统技能不存在/);

    const saved = await call('save', { name: 'demo', description: '中文描述', body: '步骤\n' });
    assert.equal(saved.status, 200);
    list = await call('list');
    assert.equal(list.data.personal.length, 1);
    const demo = list.data.personal[0];
    assert.equal(demo.name, 'demo');
    assert.equal(demo.description, '中文描述');
    assert.equal(demo.body, '步骤\n');
    assert.equal(demo.modelInvocable, true);
    assert.equal(demo.userInvocable, true);
    assert.match(await readFile(join(home, 'skills', 'demo.md'), 'utf8'), /description: 中文描述/);

    const policy = await call('policy', { id: demo.id, name: 'demo', revision: demo.revision, modelInvocable: false, userInvocable: false });
    assert.equal(policy.status, 200);
    const toggled = (await call('list')).data.personal[0];
    assert.equal(toggled.modelInvocable, false);
    assert.equal(toggled.userInvocable, false);

    const zh = await call('description', { name: 'office', description: '创建和编辑 Office 文档' });
    assert.equal(zh.status, 200);
    assert.deepEqual((await call('list')).data.translations, { office: '创建和编辑 Office 文档' });
    assert.equal((await call('description', { name: 'mine', description: 'x' })).status, 400);
    assert.match((await call('description', { name: 'office', description: 'x'.repeat(501) })).data.error, /上限/);
    const zhFile = JSON.parse(await readFile(join(home, 'simple-skills', 'descriptions.json'), 'utf8'));
    assert.deepEqual(zhFile, { office: '创建和编辑 Office 文档' });

    const trashed = await call('trash', { id: toggled.id, name: 'demo', revision: toggled.revision });
    assert.equal(trashed.status, 200);
    assert.equal((await call('list')).data.personal.length, 0);
    let bin = await call('trash');
    assert.equal(bin.data.items.length, 1);
    assert.equal(bin.data.items[0].name, 'demo');
    assert.equal(bin.data.items[0].kind, 'file');
    await call('restore', { trashId: bin.data.items[0].trashId });
    assert.equal((await call('list')).data.personal.length, 1);
    assert.deepEqual((await call('trash')).data.items, []);

    assert.equal((await call('save', { name: 'Bad Name', description: 'x', body: 'y' })).status, 400);
    assert.equal((await call('save', { name: 'demo', description: 'x', body: 'y' })).status, 400);
    assert.equal((await call('restore', { trashId: 'not-a-uuid' })).status, 400);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    await rm(home, { recursive: true, force: true });
  }
});

test('项目技能路由：来自工作区注册表，只读返回正文，拒绝未登记目录', async () => {
  const home = await mkdtemp(join(tmpdir(), 'simple-skills-route-project-'));
  const workspace = await mkdtemp(join(tmpdir(), 'simple-skills-workspace-'));
  const previous = process.env.DSH_HOME;
  try {
    await mkdir(join(workspace, '.git'), { recursive: true });
    await mkdir(join(workspace, '.dsh', 'skills', 'director'), { recursive: true });
    await writeFile(join(workspace, '.dsh', 'skills', 'director', 'SKILL.md'), '---\nname: director\ndescription: 导演流程\n---\n\n正文\n');
    await mkdir(join(workspace, '.agents', 'skills'), { recursive: true });
    await writeFile(join(workspace, '.agents', 'skills', 'helper.md'), '---\nname: helper\ndescription: 共享助手\n---\n\n步骤\n');
    const registry = { list: () => [{ path: workspace, title: '导演' }] };
    const { call } = setup(home, { registry });

    const list = await call('list');
    assert.equal(list.status, 200);
    assert.equal(list.data.projects.length, 1);
    assert.equal(list.data.projects[0].root, resolve(workspace));
    assert.deepEqual(list.data.projects[0].titles, ['导演']);
    assert.deepEqual(list.data.projects[0].skills.map(s => s.name), ['director', 'helper']);
    assert.equal(list.data.projects[0].skills[1].source, 'project-agents');

    const detail = await call('project', { root: workspace, source: 'project-dsh', id: 'director/SKILL.md' });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.name, 'director');
    assert.match(detail.data.content, /正文/);
    assert.match(detail.data.path, /director/);

    const denied = await call('project', { root: home, source: 'project-dsh', id: 'director/SKILL.md' });
    assert.equal(denied.status, 400);
    assert.match(denied.data.error, /不存在/);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    await rm(home, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});
