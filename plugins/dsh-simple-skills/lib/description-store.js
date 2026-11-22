import { readFile, writeFile, mkdir, rename, unlink, lstat } from 'node:fs/promises';
import { resolve, dirname, join, parse } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX = 500;

async function guard(path) {
  const full = resolve(path), parts = []; let p = full;
  while (p !== parse(p).root) { parts.push(p); p = dirname(p); }
  for (const item of parts.reverse()) {
    try { if ((await lstat(item)).isSymbolicLink()) throw Error('不允许链接目录或文件'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

// 系统技能的中文显示描述，单独存于插件自己的目录，不修改系统技能文件。
export function createDescriptions(file, valid) {
  file = resolve(file);
  let queue = Promise.resolve();
  const serial = fn => { const run = queue.then(fn); queue = run.then(() => {}, () => {}); return run; };

  async function all() {
    let text; try { text = await readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
    let data; try { data = JSON.parse(text); } catch { throw Error('中文描述文件已损坏，请检查 ' + file); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('中文描述文件格式无效');
    const out = {};
    for (const [key, value] of Object.entries(data)) if (valid(key) && typeof value === 'string' && value.trim()) out[key] = value;
    return out;
  }

  function set(name, description) {
    return serial(async () => {
      if (!valid(name)) throw Error('技能名无效');
      if (typeof description !== 'string') throw Error('中文描述无效');
      const text = description.trim();
      if (text.length > MAX) throw Error('中文描述上限' + MAX + '字');
      const data = await all();
      if (text) data[name] = text; else delete data[name];
      await guard(file);
      await mkdir(dirname(file), { recursive: true });
      await guard(file);
      const temp = join(dirname(file), '.descriptions-' + randomUUID() + '.tmp');
      try {
        await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        await rename(temp, file);
      } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
      return { ok: true, description: text };
    });
  }

  return { all, set };
}
