import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as yaml from 'yaml';
import { projectRootOf, projectRoots, listProjects, readProjectSkill } from '../lib/projects.js';

const skill = (name, description, body = '步骤') => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

async function workspaceTree() {
  const base = await mkdtemp(join(tmpdir(), 'simple-skills-project-'));
  const repo = join(base, 'repo');
  await mkdir(join(repo, '.git'), { recursive: true });
  await mkdir(join(repo, '.dsh', 'skills', 'director'), { recursive: true });
  await writeFile(join(repo, '.dsh', 'skills', 'director', 'SKILL.md'), skill('director', '导演流程', '正文内容'));
  await mkdir(join(repo, '.agents', 'skills'), { recursive: true });
  await writeFile(join(repo, '.agents', 'skills', 'helper.md'), skill('helper', '共享助手'));
  await mkdir(join(repo, 'sub'), { recursive: true });
  const loose = join(base, 'loose');
  await mkdir(join(loose, '.dsh', 'skills', 'plain'), { recursive: true });
  await writeFile(join(loose, '.dsh', 'skills', 'plain', 'SKILL.md'), skill('plain', '无版本库项目'));
  return { base, repo, loose, sub: join(repo, 'sub') };
}

test('项目根：取含 .git 的最近祖先，否则目录本身；同一根去重并收集标题', async () => {
  const tree = await workspaceTree();
  try {
    assert.equal(await projectRootOf(tree.sub), resolve(tree.repo));
    assert.equal(await projectRootOf(tree.loose), resolve(tree.loose));
    const groups = await projectRoots([
      { path: tree.sub, title: '导演（子目录）' },
      { path: tree.repo, title: '导演' },
      { path: tree.loose, title: '散装项目' },
      { path: join(tree.base, 'missing'), title: '不存在的目录' },
      { path: 42, title: '无效记录' }
    ]);
    assert.equal(groups.length, 2);
    const repo = groups.find(group => group.root === resolve(tree.repo));
    assert.deepEqual(repo.titles, ['导演（子目录）', '导演']);
    assert.ok(groups.some(group => group.root === resolve(tree.loose)));
  } finally { await rm(tree.base, { recursive: true, force: true }); }
});

test('项目技能：同时发现 .dsh/skills 与 .agents/skills，附带来源与路径', async () => {
  const tree = await workspaceTree();
  try {
    const groups = await projectRoots([{ path: tree.repo, title: '导演' }]);
    const projects = await listProjects(yaml, groups);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].root, resolve(tree.repo));
    assert.deepEqual(projects[0].titles, ['导演']);
    const byName = Object.fromEntries(projects[0].skills.map(row => [row.name, row]));
    assert.deepEqual(Object.keys(byName).sort(), ['director', 'helper']);
    assert.equal(byName.director.source, 'project-dsh');
    assert.equal(byName.director.kind, 'directory');
    assert.equal(byName.director.path, join(tree.repo, '.dsh', 'skills', 'director', 'SKILL.md'));
    assert.equal(byName.helper.source, 'project-agents');
    assert.equal(byName.helper.description, '共享助手');
    assert.equal(byName.director.content, undefined, '列表不返回正文');
  } finally { await rm(tree.base, { recursive: true, force: true }); }
});

test('项目技能只读读取：仅接受已登记项目根，不越界', async () => {
  const tree = await workspaceTree();
  try {
    const groups = await projectRoots([{ path: tree.repo, title: '导演' }]);
    const detail = await readProjectSkill(yaml, groups, { root: tree.repo, source: 'project-dsh', id: 'director/SKILL.md' });
    assert.equal(detail.name, 'director');
    assert.match(detail.content, /正文内容/);
    assert.equal(detail.source, 'project-dsh');
    assert.equal(detail.path, join(tree.repo, '.dsh', 'skills', 'director', 'SKILL.md'));

    await assert.rejects(readProjectSkill(yaml, groups, { root: tree.loose, source: 'project-dsh', id: 'plain/SKILL.md' }), /不存在/);
    await assert.rejects(readProjectSkill(yaml, groups, { root: tree.repo, source: 'personal', id: 'director/SKILL.md' }), /不存在/);
    await assert.rejects(readProjectSkill(yaml, groups, { root: tree.repo, source: 'project-dsh', id: '../../director/SKILL.md' }), /不存在/);
  } finally { await rm(tree.base, { recursive: true, force: true }); }
});

test('没有技能目录的项目仍返回分组，损坏技能以错误行显示', async () => {
  const tree = await workspaceTree();
  try {
    await mkdir(join(tree.loose, '.dsh', 'skills'), { recursive: true });
    await writeFile(join(tree.loose, '.dsh', 'skills', 'broken.md'), 'no frontmatter\n');
    const groups = await projectRoots([{ path: tree.loose, title: '散装项目' }]);
    const projects = await listProjects(yaml, groups);
    assert.equal(projects.length, 1);
    const broken = projects[0].skills.find(row => row.name === 'broken');
    assert.match(broken.error, /frontmatter/);
    assert.equal(broken.source, 'project-dsh');
  } finally { await rm(tree.base, { recursive: true, force: true }); }
});
