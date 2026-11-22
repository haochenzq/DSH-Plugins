import { readdir, readFile, lstat, mkdir, writeFile, rename, unlink, copyFile, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve, join, dirname, parse, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const valid = n => typeof n === 'string' && n.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n);
const hash = s => createHash('sha256').update(s).digest('hex');
const FM = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const TRASH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const bodyOf = rest => rest.replace(/^[\r\n]+/, '');

// 拒绝目标及全部祖先中的符号链接与 junction，避免越界写入。
async function guard(path) {
  const full = resolve(path), parts = []; let p = full;
  while (p !== parse(p).root) { parts.push(p); p = dirname(p); }
  for (const item of parts.reverse()) {
    try { if ((await lstat(item)).isSymbolicLink()) throw Error('不允许链接目录或文件'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

// 复制子树：目标已存在即失败（不覆盖），并拒绝任何链接节点。
async function copyTree(src, dst) {
  const info = await lstat(src);
  if (info.isSymbolicLink()) throw Error('不允许链接目录或文件');
  if (info.isDirectory()) {
    await mkdir(dst);
    for (const entry of await readdir(src)) await copyTree(join(src, entry), join(dst, entry));
  } else if (info.isFile()) {
    await copyFile(src, dst, fsConstants.COPYFILE_EXCL);
  } else {
    throw Error('不支持的技能文件类型');
  }
}

function newDoc(yaml, name, description) {
  const doc = yaml.parseDocument('');
  doc.set('name', name);
  doc.set('description', typeof description === 'string' ? description : '');
  return doc;
}

export function createStore(base, yaml) {
  base = resolve(base);
  // 回收目录位于技能扫描目录之外，避免被当作技能读取。
  const trashRoot = resolve(dirname(base), 'simple-skills-trash');
  let queue = Promise.resolve();
  const serial = fn => { const run = queue.then(fn); queue = run.then(() => {}, () => {}); return run; };

  function readFront(content) {
    if (typeof content !== 'string' || Buffer.byteLength(content) > 65536) throw Error('技能内容上限64KiB');
    const m = FM.exec(content);
    if (!m) throw Error('缺少完整 YAML frontmatter');
    const doc = yaml.parseDocument(m[1], { uniqueKeys: true });
    if (doc.errors.length) throw Error('YAML 格式有误：' + doc.errors[0].message);
    const data = doc.toJS({ maxAliasCount: 10 });
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('技能元数据必须是映射');
    return { doc, data, rest: content.slice(m[0].length) };
  }
  function metadata(content, name) {
    const { data } = readFront(content);
    if (data.name !== name || !valid(data.name) || typeof data.description !== 'string' || !data.description.trim()) throw Error('name 必须与技能名一致，description 不能为空');
    return data;
  }
  const invocable = data => ({ modelInvocable: data['disable-model-invocation'] !== true, userInvocable: data['user-invocable'] !== false });
  function compose(doc, body) {
    const head = '---\n' + doc.toString().replace(/\r?\n$/, '') + '\n---\n';
    const rest = bodyOf(typeof body === 'string' ? body : '');
    return rest ? head + '\n' + rest : head;
  }
  async function target(id) {
    if (typeof id !== 'string') throw Error('技能标识无效');
    const file = resolve(base, id), rel = relative(base, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('路径越界');
    if (!/^([a-z0-9]+(?:-[a-z0-9]+)*\.md|[a-z0-9]+(?:-[a-z0-9]+)*[\\/]SKILL\.md)$/.test(rel)) throw Error('技能路径无效');
    await guard(file); return file;
  }
  async function atomic(file, content, revision) {
    const temp = join(dirname(file), '.simple-skills-' + randomUUID() + '.tmp');
    try {
      await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' });
      await guard(file);
      if (hash(await readFile(file, 'utf8')) !== revision) throw Error('文件已变化，请刷新');
      await rename(temp, file);
    } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }

  async function list() {
    await guard(base);
    let entries; try { entries = await readdir(base, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const rows = [];
    for (const e of entries) {
      const dir = e.isDirectory() && valid(e.name);
      const id = dir ? e.name + '/SKILL.md' : e.isFile() && e.name.endsWith('.md') && valid(e.name.slice(0, -3)) ? e.name : null;
      if (!id) continue;
      const name = dir ? e.name : e.name.slice(0, -3);
      try {
        const file = await target(id);
        if ((await lstat(file)).size > 65536) throw Error('文件超过64KiB');
        const content = await readFile(file, 'utf8');
        const { data, rest } = readFront(content);
        if (data.name !== name || typeof data.description !== 'string' || !data.description.trim()) throw Error('name 必须与技能名一致，description 不能为空');
        rows.push({ id, name, description: data.description, body: bodyOf(rest), content, revision: hash(content), kind: dir ? 'directory' : 'file', ...invocable(data) });
      } catch (err) { if (err.code !== 'ENOENT') rows.push({ id, name, error: err.message, readonly: true }); }
    }
    return rows;
  }

  function save(input) {
    return serial(async () => {
      const { name, revision } = input || {};
      if (!valid(name)) throw Error('技能名无效');
      const raw = typeof input.content === 'string';
      const id = input.id || name + '.md';
      const file = await target(id);
      const first = relative(base, file).split(/[\\/]/)[0];
      if (first.replace(/\.md$/, '') !== name) throw Error('技能标识与名称不一致');
      if (!revision) {
        if ((await list()).some(s => s.name === name)) throw Error('同名个人技能已存在');
        const content = raw ? input.content : compose(newDoc(yaml, name, input.description), input.body);
        metadata(content, name);
        await guard(base); await mkdir(base, { recursive: true }); await guard(base);
        await writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
        return { ok: true };
      }
      const before = await readFile(file, 'utf8');
      if (hash(before) !== revision) throw Error('文件已变化，请刷新');
      let content;
      if (raw) content = input.content;
      else {
        const { doc, rest } = readFront(before);
        doc.set('description', typeof input.description === 'string' ? input.description : '');
        content = compose(doc, typeof input.body === 'string' ? input.body : bodyOf(rest));
      }
      metadata(content, name);
      await atomic(file, content, revision);
      return { ok: true };
    });
  }

  function policy(input) {
    return serial(async () => {
      const { id, name, revision } = input || {};
      if (typeof input.modelInvocable !== 'boolean' || typeof input.userInvocable !== 'boolean') throw Error('调用设置必须是布尔值');
      if (!valid(name)) throw Error('技能名无效');
      const file = await target(id);
      const before = await readFile(file, 'utf8');
      if (hash(before) !== revision) throw Error('文件已变化，请刷新');
      const { doc, data, rest } = readFront(before);
      if (data.name !== name) throw Error('技能标识与名称不一致');
      // 只动这两个键，其余字段与注释保持原样；已是默认状态的省略写法不被强行写出。
      if (doc.has('disable-model-invocation')) doc.set('disable-model-invocation', !input.modelInvocable);
      else if (!input.modelInvocable) doc.set('disable-model-invocation', true);
      if (doc.has('user-invocable')) doc.set('user-invocable', input.userInvocable);
      else if (!input.userInvocable) doc.set('user-invocable', false);
      const content = compose(doc, bodyOf(rest));
      metadata(content, name);
      await atomic(file, content, revision);
      return { ok: true };
    });
  }

  function trash(input) {
    return serial(async () => {
      const { id, name, revision } = input || {};
      if (!valid(name)) throw Error('技能名无效');
      const file = await target(id);
      if (id.split(/[\\/]/)[0].replace(/\.md$/, '') !== name) throw Error('技能标识与名称不一致');
      const dirSkill = id.endsWith('/SKILL.md');
      const item = dirSkill ? dirname(file) : file;
      await guard(dirname(item));
      const info = await lstat(item);
      if (dirSkill && !info.isDirectory()) throw Error('目录技能不存在');
      if (!dirSkill && !info.isFile()) throw Error('技能文件不存在');
      if (revision && hash(await readFile(file, 'utf8')) !== revision) throw Error('文件已变化，请刷新');
      await mkdir(trashRoot, { recursive: true });
      await guard(trashRoot);
      const trashId = randomUUID();
      const dir = join(trashRoot, trashId);
      await mkdir(dir);
      await rename(item, join(dir, 'payload'));
      await writeFile(join(dir, 'meta.json'), JSON.stringify({ id, name, kind: dirSkill ? 'directory' : 'file', trashedAt: new Date().toISOString() }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
      return { ok: true, trashId };
    });
  }

  async function trashList() {
    await guard(trashRoot);
    let entries; try { entries = await readdir(trashRoot, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const items = [];
    for (const e of entries) {
      if (!e.isDirectory() || !TRASH_ID.test(e.name)) continue;
      try {
        const meta = JSON.parse(await readFile(join(trashRoot, e.name, 'meta.json'), 'utf8'));
        if (!meta || typeof meta.name !== 'string' || !valid(meta.name) || typeof meta.id !== 'string') continue;
        items.push({ trashId: e.name, name: meta.name, kind: meta.kind === 'directory' ? 'directory' : 'file', trashedAt: String(meta.trashedAt || '') });
      } catch { /* 跳过损坏的回收项，不中断列表 */ }
    }
    items.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
    return items;
  }

  function deletePermanently(input) {
    return serial(async () => {
      const trashId = input && input.trashId;
      if (typeof trashId !== 'string' || trashId.length !== 36 || !TRASH_ID.test(trashId)) throw Error('回收站标识无效');
      const dir = join(trashRoot, trashId);
      // 仅允许删除回收站内以 UUID 命名的真实目录；拒绝祖先及目标链接。
      await guard(dir);
      let info;
      try { info = await lstat(dir); }
      catch (e) { if (e.code === 'ENOENT') throw Error('回收项不存在'); throw e; }
      if (!info.isDirectory()) throw Error('回收项不是目录');
      // rm 不跟随目录内的符号链接：只删除链接本身，保留其目标。
      await rm(dir, { recursive: true });
      return { ok: true };
    });
  }

  function restore(input) {
    return serial(async () => {
      const trashId = input && input.trashId;
      if (typeof trashId !== 'string' || !TRASH_ID.test(trashId)) throw Error('回收站标识无效');
      const dir = join(trashRoot, trashId);
      await guard(trashRoot); await guard(dir);
      const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
      if (!meta || !valid(meta.name)) throw Error('回收项已损坏');
      const file = await target(meta.id);
      const directory = meta.kind === 'directory';
      const destination = directory ? dirname(file) : file;
      await guard(destination); await mkdir(dirname(destination), { recursive: true });
      const payload = join(dir, 'payload');
      let created = false;
      try {
        if (directory) {
          await mkdir(destination); // 排他创建：同名存在即失败，不覆盖
          created = true;
          for (const entry of await readdir(payload)) await copyTree(join(payload, entry), join(destination, entry));
          await rm(payload, { recursive: true, force: true });
        } else {
          await copyFile(payload, destination, fsConstants.COPYFILE_EXCL);
          await unlink(payload);
        }
      } catch (e) {
        if (created) await rm(destination, { recursive: true, force: true }).catch(() => {});
        throw e.code === 'EEXIST' ? Error('同名技能已存在，未覆盖') : e;
      }
      await rm(dir, { recursive: true, force: true });
      return { ok: true, name: meta.name };
    });
  }

  return { list, save, policy, trash, trashList, restore, deletePermanently, metadata };
}
