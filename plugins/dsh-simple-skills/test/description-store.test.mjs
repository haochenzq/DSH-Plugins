import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDescriptions } from '../lib/description-store.js';
import { valid } from '../lib/store.js';

test('中文描述覆盖可增改清除，独立存放且不污染技能目录', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'simple-skills-zh-'));
  const file = join(dir, 'simple-skills', 'descriptions.json');
  const store = createDescriptions(file, valid);
  try {
    assert.deepEqual(await store.all(), {});
    await store.set('office', '  创建、编辑 Office 文档  ');
    assert.deepEqual(await store.all(), { office: '创建、编辑 Office 文档' });
    await store.set('office-xlsx', '读取和编辑 Excel');
    assert.deepEqual((await store.all())['office-xlsx'], '读取和编辑 Excel');
    await store.set('office', '');
    assert.deepEqual(Object.keys(await store.all()), ['office-xlsx']);
    const raw = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(Object.keys(raw), ['office-xlsx']);
    await assert.rejects(store.set('Bad Name', 'x'), /无效/);
    await assert.rejects(store.set('office', 'x'.repeat(501)), /上限/);
    await assert.rejects(store.set('office', 1), /无效/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
