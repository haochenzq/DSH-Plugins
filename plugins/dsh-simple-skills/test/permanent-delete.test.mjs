import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as yaml from 'yaml';
import { createStore } from '../lib/store.js';
import { apply } from '../lib/index.js';

const doc = name => `---\nname: ${name}\ndescription: Test\n---\n\ncontent\n`;
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'simple-skills-delete-test-'));
  const base = join(home, 'skills');
  await mkdir(base);
  return { home, base, bin: join(home, 'simple-skills-trash'), store: createStore(base, yaml) };
}
async function exists(path) {
  try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

// 所有被删除路径均来自 mkdtemp；绝不访问真实用户回收站。
test('永久删除单文件和带附件目录，保留其他回收项并拒绝重复删除', async () => {
  const f = await fixture();
  try {
    await f.store.save({ name: 'single', content: doc('single') });
    const single = await f.store.trash({ id: 'single.md', name: 'single' });
    await mkdir(join(f.base, 'bundle', 'assets'), { recursive: true });
    await writeFile(join(f.base, 'bundle', 'SKILL.md'), doc('bundle'));
    await writeFile(join(f.base, 'bundle', 'assets', 'attachment.txt'), 'attachment');
    const bundle = await f.store.trash({ id: 'bundle/SKILL.md', name: 'bundle' });
    assert.deepEqual(await f.store.deletePermanently({ trashId: single.trashId }), { ok: true });
    assert.equal(await exists(join(f.bin, single.trashId)), false);
    assert.equal(await readFile(join(f.bin, bundle.trashId, 'payload', 'assets', 'attachment.txt'), 'utf8'), 'attachment');
    assert.deepEqual((await f.store.trashList()).map(item => item.trashId), [bundle.trashId]);
    await assert.rejects(f.store.deletePermanently({ trashId: single.trashId }), /不存在/);
    await assert.rejects(f.store.restore({ trashId: single.trashId }));
    assert.deepEqual(await f.store.deletePermanently({ trashId: bundle.trashId }), { ok: true });
    assert.deepEqual(await readdir(f.bin), []);
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('拒绝路径穿越、错误标识、非目录及不存在项，错误不阻塞后续操作', async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    for (const value of [undefined, null, 1, '', '../skills', id + '/..', id + '\n', 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', 'C:\\outside']) {
      await assert.rejects(f.store.deletePermanently({ trashId: value }), /标识无效/);
    }
    await assert.rejects(f.store.deletePermanently(null), /标识无效/);
    await assert.rejects(f.store.deletePermanently({ trashId: id }), /不存在/);
    await writeFile(f.bin, 'not a directory');
    await assert.rejects(f.store.deletePermanently({ trashId: id }), e => e.code === 'ENOTDIR' || /不存在/.test(e.message));
    assert.equal(await readFile(f.bin, 'utf8'), 'not a directory');
    await rm(f.bin);
    await mkdir(f.bin);
    await writeFile(join(f.bin, id), 'not a directory');
    await assert.rejects(f.store.deletePermanently({ trashId: id }), /不是目录/);
    assert.equal(await readFile(join(f.bin, id), 'utf8'), 'not a directory');
    // 元数据即使损坏也可删除受限回收项，不读取或信任其中的路径。
    const broken = randomUUID();
    await mkdir(join(f.bin, broken));
    await writeFile(join(f.bin, broken, 'meta.json'), '{invalid');
    assert.deepEqual(await f.store.deletePermanently({ trashId: broken }), { ok: true });
    assert.equal(await exists(join(f.bin, broken)), false);
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('拒绝回收站及回收项链接，条目内部 junction 不跟随且外部目标保留', async () => {
  const f = await fixture();
  try {
    const outside = join(f.home, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'keep.txt'), 'keep');
    const id = randomUUID();
    await symlink(outside, f.bin, 'junction');
    await assert.rejects(f.store.deletePermanently({ trashId: id }), /不允许链接/);
    assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep');
    await rm(f.bin);
    await mkdir(f.bin);
    await symlink(outside, join(f.bin, id), 'junction');
    await assert.rejects(f.store.deletePermanently({ trashId: id }), /不允许链接/);
    assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep');
    await rm(join(f.bin, id));
    await mkdir(join(f.bin, id, 'payload'), { recursive: true });
    await symlink(outside, join(f.bin, id, 'payload', 'linked-dir'), 'junction');
    assert.deepEqual(await f.store.deletePermanently({ trashId: id }), { ok: true });
    assert.equal(await exists(join(f.bin, id)), false);
    assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'keep');
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('回收站恢复与彻底删除串行执行，不会重复成功', async () => {
  const f = await fixture();
  try {
    await f.store.save({ name: 'serial', content: doc('serial') });
    const { trashId } = await f.store.trash({ id: 'serial.md', name: 'serial' });
    const [deleted, restored] = await Promise.allSettled([
      f.store.deletePermanently({ trashId }), f.store.restore({ trashId })
    ]);
    assert.deepEqual(deleted, { status: 'fulfilled', value: { ok: true } });
    assert.equal(restored.status, 'rejected');
    assert.equal(await exists(join(f.base, 'serial.md')), false);
  } finally { await rm(f.home, { recursive: true, force: true }); }
});

test('宿主 POST 永久删除路由返回成功或 HTTP 400，错误后仍可使用', async () => {
  const f = await fixture();
  const previous = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = f.home;
    const routes = new Map();
    apply({
      skills: { snapshot: async () => ({ complete: true, skills: [] }) },
      connection: { fetch: { register: route => routes.set(route.path, route) } }
    });
    const route = routes.get('/api/simple-skills/delete-permanently');
    assert.ok(route);
    assert.deepEqual(route.methods, ['POST']);
    const call = async payload => {
      const response = await route.fetch({ method: 'POST', text: async () => payload });
      return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
    };
    const invalid = await call(JSON.stringify({ trashId: '../outside' }));
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /无效/);
    assert.equal(invalid.cache, 'no-store');
    assert.equal((await call('{invalid')).status, 400);
    assert.equal((await call(' '.repeat(200001))).status, 400);
    const callHost = async (path, method, payload) => {
      const response = await routes.get('/api/simple-skills/' + path).fetch({ method, text: async () => JSON.stringify(payload) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await callHost('save', 'POST', { name: 'route', content: doc('route') })).status, 200);
    const trashed = await callHost('trash', 'POST', { id: 'route.md', name: 'route' });
    assert.equal(trashed.status, 200);
    const { trashId } = trashed.body;
    assert.equal((await callHost('trash', 'GET')).body.items[0].trashId, trashId);
    const result = await call(JSON.stringify({ trashId }));
    assert.deepEqual(result, { status: 200, body: { ok: true }, cache: 'no-store' });
    assert.deepEqual((await callHost('trash', 'GET')).body.items, []);
    assert.equal((await call(JSON.stringify({ trashId }))).status, 400);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    await rm(f.home, { recursive: true, force: true });
  }
});
