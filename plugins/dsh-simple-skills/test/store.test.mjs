import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as yaml from 'yaml';
import { createStore } from '../lib/store.js';

const text = (name, body = 'hello') => `---\nname: ${name}\ndescription: Example\n---\n\n${body}\n`;

async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'simple-skills-test-'));
  const base = join(dir, 'skills');
  await mkdir(base);
  return { dir, base, store: createStore(base, yaml) };
}

test('新建、目录技能、原子编辑、冲突与越界', async () => {
  const { dir, base, store } = await workspace();
  try {
    assert.deepEqual(await store.list(), []);
    await store.save({ name: 'demo', content: text('demo') });
    await assert.rejects(store.save({ name: 'demo', content: text('demo') }), /已存在/);
    await mkdir(join(base, 'bundle'));
    await writeFile(join(base, 'bundle', 'SKILL.md'), text('bundle'));
    const rows = await store.list();
    assert.equal(rows.length, 2);
    const row = rows.find(r => r.name === 'bundle');
    assert.equal(row.id, 'bundle/SKILL.md');
    assert.equal(row.kind, 'directory');
    assert.equal(row.body, 'hello\n');
    await store.save({ ...row, content: text('bundle', 'updated') });
    assert.match(await readFile(join(base, 'bundle', 'SKILL.md'), 'utf8'), /updated/);
    await assert.rejects(store.save({ ...row, content: text('bundle', 'stale') }), /变化/);
    await assert.rejects(store.save({ id: '../escape.md', name: 'escape', content: text('escape') }), /越界/);
    await assert.rejects(store.save({ name: 'bad', content: text('different') }), /一致/);
    await assert.rejects(store.save({ name: 'empty', content: '---\nname: empty\n---\n' }), /description/);
    await assert.rejects(store.save({ id: 'other.md', name: 'demo', content: text('other') }), /不一致/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('分项编辑保留未知元数据与注释，只更新描述和正文', async () => {
  const { dir, base, store } = await workspace();
  try {
    await writeFile(join(base, 'keep.md'), '---\nname: keep\ndescription: 旧描述\ncustom: 1 # 保留注释\n---\n\n旧正文\n');
    const row = (await store.list()).find(r => r.name === 'keep');
    assert.equal(row.description, '旧描述');
    assert.equal(row.body, '旧正文\n');
    await store.save({ id: row.id, name: 'keep', description: '新描述', body: '新正文\n', revision: row.revision });
    const raw = await readFile(join(base, 'keep.md'), 'utf8');
    assert.match(raw, /新描述/);
    assert.match(raw, /新正文/);
    assert.match(raw, /custom: 1/);
    assert.match(raw, /保留注释/);
    assert.doesNotMatch(raw, /旧正文/);
    const again = (await store.list()).find(r => r.name === 'keep');
    assert.equal(again.body, '新正文\n');
    assert.equal(again.description, '新描述');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('调用开关两键独立、默认允许、保留其它字段并检查修订冲突', async () => {
  const { dir, base, store } = await workspace();
  try {
    await writeFile(join(base, 'toggle.md'), '---\nname: toggle\ndescription: d\ncustom: 1 # 注释\n---\n\nbody\n');
    const row = (await store.list()).find(r => r.name === 'toggle');
    assert.equal(row.modelInvocable, true);
    assert.equal(row.userInvocable, true);
    await store.policy({ id: row.id, name: 'toggle', revision: row.revision, modelInvocable: false, userInvocable: true });
    let next = (await store.list()).find(r => r.name === 'toggle');
    assert.equal(next.modelInvocable, false);
    assert.equal(next.userInvocable, true);
    assert.match(await readFile(join(base, 'toggle.md'), 'utf8'), /disable-model-invocation: true/);
    await store.policy({ id: next.id, name: 'toggle', revision: next.revision, modelInvocable: false, userInvocable: false });
    next = (await store.list()).find(r => r.name === 'toggle');
    assert.equal(next.modelInvocable, false);
    assert.equal(next.userInvocable, false);
    assert.match(await readFile(join(base, 'toggle.md'), 'utf8'), /user-invocable: false/);
    await store.policy({ id: next.id, name: 'toggle', revision: next.revision, modelInvocable: true, userInvocable: true });
    next = (await store.list()).find(r => r.name === 'toggle');
    assert.equal(next.modelInvocable, true);
    assert.equal(next.userInvocable, true);
    const raw = await readFile(join(base, 'toggle.md'), 'utf8');
    assert.match(raw, /disable-model-invocation: false/);
    assert.match(raw, /user-invocable: true/);
    assert.match(raw, /custom: 1/);
    assert.match(raw, /注释/);
    await assert.rejects(store.policy({ id: next.id, name: 'toggle', revision: 'stale', modelInvocable: false, userInvocable: true }), /变化/);
    await assert.rejects(store.policy({ id: next.id, name: 'toggle', revision: next.revision, modelInvocable: 'no', userInvocable: true }), /布尔/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('目录技能：分项编辑与调用开关只改 SKILL.md，附件保持不动', async () => {
  const { dir, base, store } = await workspace();
  try {
    await mkdir(join(base, 'bundle'));
    await mkdir(join(base, 'bundle', 'assets'));
    await writeFile(join(base, 'bundle', 'SKILL.md'), '---\nname: bundle\ndescription: 旧\ncustom: keep # 注释\n---\n\n旧正文\n');
    await writeFile(join(base, 'bundle', 'assets', 'a.txt'), 'A');
    const row = (await store.list()).find(r => r.name === 'bundle');
    await store.save({ id: row.id, name: 'bundle', description: '新', body: '新正文\n', revision: row.revision });
    let updated = (await store.list()).find(r => r.name === 'bundle');
    assert.equal(updated.description, '新');
    assert.equal(updated.body, '新正文\n');
    assert.match(await readFile(join(base, 'bundle', 'SKILL.md'), 'utf8'), /custom: keep/);
    await store.policy({ id: updated.id, name: 'bundle', revision: updated.revision, modelInvocable: false, userInvocable: true });
    updated = (await store.list()).find(r => r.name === 'bundle');
    assert.equal(updated.modelInvocable, false);
    assert.equal(updated.userInvocable, true);
    assert.equal(await readFile(join(base, 'bundle', 'assets', 'a.txt'), 'utf8'), 'A');
    await assert.rejects(store.trash({ id: 'bundle/SKILL.md', name: 'other' }), /不一致/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('回收站：文件与目录技能连同附件移出、可恢复、不覆盖同名', async () => {
  const { dir, base, store } = await workspace();
  try {
    await store.save({ name: 'single', description: 'd', body: '正文\n' });
    const single = (await store.list()).find(r => r.name === 'single');
    assert.equal(single.kind, 'file');
    // 回收目录位于技能扫描目录之外
    await store.trash({ id: single.id, name: 'single', revision: single.revision });
    assert.deepEqual(await store.list(), []);
    let bin = await store.trashList();
    assert.equal(bin.length, 1);
    assert.equal(bin[0].name, 'single');
    assert.equal(bin[0].kind, 'file');
    const trashDirs = await readdir(join(dir, 'simple-skills-trash'));
    assert.equal(trashDirs.length, 1);
    await store.restore({ trashId: bin[0].trashId });
    assert.ok((await store.list()).some(r => r.name === 'single'));
    assert.deepEqual(await store.trashList(), []);

    // 目录技能携带附件
    await mkdir(join(base, 'bundle'));
    await writeFile(join(base, 'bundle', 'SKILL.md'), text('bundle'));
    await mkdir(join(base, 'bundle', 'assets'));
    await writeFile(join(base, 'bundle', 'assets', 'a.txt'), 'A');
    await assert.rejects(store.trash({ id: 'bundle/SKILL.md', name: 'bundle', revision: 'stale' }), /变化/);
    await store.trash({ id: 'bundle/SKILL.md', name: 'bundle' });
    assert.ok(!(await store.list()).some(r => r.name === 'bundle'));
    bin = await store.trashList();
    assert.equal(bin[0].name, 'bundle');
    assert.equal(bin[0].kind, 'directory');
    await store.restore({ trashId: bin[0].trashId });
    assert.equal(await readFile(join(base, 'bundle', 'assets', 'a.txt'), 'utf8'), 'A');

    // 恢复时同名已存在：拒绝且不覆盖，回收项保留
    await store.trash({ id: 'bundle/SKILL.md', name: 'bundle' });
    bin = await store.trashList();
    await mkdir(join(base, 'bundle'));
    await writeFile(join(base, 'bundle', 'SKILL.md'), text('bundle', '占位'));
    await assert.rejects(store.restore({ trashId: bin[0].trashId }), /同名/);
    assert.match(await readFile(join(base, 'bundle', 'SKILL.md'), 'utf8'), /占位/);
    assert.equal((await store.trashList()).length, 1);
    await assert.rejects(store.restore({ trashId: '../../etc' }), /无效/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
