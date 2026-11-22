import { stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { createStore } from './store.js';

// 与 DSH 的 skill-filesystem 提供方保持同一套项目根与目录约定：
// 项目根 = 含 .git 的最近祖先目录，否则工作区目录本身；
// 项目技能只在 <根>/.dsh/skills 与 <根>/.agents/skills 下发现。
export const PROJECT_ROOTS = [
  { dir: '.dsh/skills', source: 'project-dsh', label: '项目技能（.dsh）' },
  { dir: '.agents/skills', source: 'project-agents', label: '项目共享（.agents）' }
];

async function isDirectory(path) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

async function hasGit(path) {
  try { await stat(join(path, '.git')); return true; } catch { return false; }
}

export async function projectRootOf(dir) {
  const start = resolve(dir);
  let current = start;
  for (;;) {
    if (await hasGit(current)) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

const samePath = (a, b) => {
  const left = resolve(a), right = resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
};

export const matchesPath = (candidate, allowed) => typeof candidate === 'string' && typeof allowed === 'string' && samePath(candidate, allowed);

// 工作区记录里取到的目录 → 项目根；去重后按根路径排序，titles 收集映射到同一根的 Workspace 标题。
export async function projectRoots(workspaces) {
  const groups = new Map();
  for (const workspace of Array.isArray(workspaces) ? workspaces : []) {
    const dir = workspace && typeof workspace.path === 'string' ? workspace.path : '';
    if (!dir || !(await isDirectory(dir))) continue;
    const root = await projectRootOf(dir);
    const key = process.platform === 'win32' ? root.toLowerCase() : root;
    let group = groups.get(key);
    if (!group) { group = { root, titles: [] }; groups.set(key, group); }
    const title = typeof workspace.title === 'string' && workspace.title.trim() ? workspace.title.trim() : root;
    if (!group.titles.includes(title)) group.titles.push(title);
  }
  return [...groups.values()].sort((a, b) => a.root.localeCompare(b.root));
}

const strip = row => ({
  id: row.id,
  name: row.name,
  description: row.description,
  kind: row.kind,
  modelInvocable: row.modelInvocable,
  userInvocable: row.userInvocable
});

// 只读扫描：复用个人技能 store 的发现与校验，只取 list()，不触碰写入路径。
export async function listProjects(yaml, groups) {
  const projects = [];
  for (const group of groups) {
    const skills = [];
    for (const root of PROJECT_ROOTS) {
      const dir = join(group.root, ...root.dir.split('/'));
      let rows = [];
      try { rows = await createStore(dir, yaml).list(); } catch { rows = []; }
      for (const row of rows) {
        const file = join(dir, ...row.id.split('/'));
        skills.push(row.error
          ? { id: row.id, name: row.name, error: row.error, source: root.source, sourceLabel: root.label, path: file }
          : { ...strip(row), source: root.source, sourceLabel: root.label, path: file });
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    projects.push({ root: group.root, titles: group.titles, skills });
  }
  return projects;
}

// 读取一个项目技能的当前正文；root/source 必须先对得上已登记的工作区项目根。
export async function readProjectSkill(yaml, groups, input) {
  const { root, source, id } = input || {};
  const group = groups.find(item => matchesPath(root, item.root));
  if (!group) throw Error('项目技能不存在');
  const spec = PROJECT_ROOTS.find(item => item.source === source);
  if (!spec) throw Error('项目技能不存在');
  const dir = join(group.root, ...spec.dir.split('/'));
  const rows = await createStore(dir, yaml).list();
  const row = rows.find(item => item.id === id);
  if (!row) throw Error('项目技能不存在');
  if (row.error) throw Error('项目技能无法读取：' + row.error);
  return { name: row.name, description: row.description, content: row.content, kind: row.kind, source: spec.source, sourceLabel: spec.label, path: join(dir, ...row.id.split('/')) };
}
