import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import * as yaml from 'yaml';
import { createStore, valid } from './store.js';
import { createDescriptions } from './description-store.js';
import { projectRoots, listProjects, readProjectSkill } from './projects.js';
export const name = 'simple-skills';
export const inject = ['skills', 'connection'];
export function apply(ctx) {
  const home = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'));
  const root = join(home, 'skills');
  const store = createStore(root, yaml);
  const descriptions = createDescriptions(join(home, 'simple-skills', 'descriptions.json'), valid);
  // 工作区注册表可选：没有它时项目技能为空，不影响系统与个人技能。
  const service = serviceName => { try { return typeof ctx.get === 'function' ? ctx.get(serviceName) : undefined; } catch { return undefined; } };
  const projectGroups = async () => {
    const registry = service('workspaceRegistry');
    if (!registry || typeof registry.list !== 'function') return [];
    let workspaces;
    try { workspaces = registry.list(); if (workspaces && typeof workspaces.then === 'function') workspaces = await workspaces; } catch { return []; }
    return projectRoots(workspaces);
  };
  const system = async () => {
    const snapshot = await ctx.skills.snapshot({ cwd: process.cwd() });
    return { snapshot, skills: snapshot.skills.filter(s => s.source === 'bundled').map(({ name, description, provider }) => ({ name, description, provider })) };
  };
  const route = (path, methods, fn) => ctx.connection.fetch.register({ path: '/api/simple-skills/' + path, methods, requestBody: 'buffered', fetch: async request => {
    try { return Response.json(await fn(request), { headers: { 'cache-control': 'no-store' } }); }
    catch (e) { return Response.json({ error: e.message }, { status: 400, headers: { 'cache-control': 'no-store' } }); }
  }});
  const body = async request => {
    const text = await request.text();
    if (Buffer.byteLength(text) > 200000) throw Error('请求过大');
    return JSON.parse(text);
  };
  route('list', ['GET'], async () => {
    const { snapshot, skills } = await system();
    const groups = await projectGroups();
    return {
      system: skills,
      personal: await store.list(),
      projects: await listProjects(yaml, groups),
      translations: await descriptions.all(),
      complete: snapshot.complete,
      root,
      scope: '系统为宿主全局视图；个人技能仅含用户 DSH 目录；项目技能来自已登记工作区的 .dsh/skills 与 .agents/skills（只读）'
    };
  });
  route('project', ['POST'], async request => readProjectSkill(yaml, await projectGroups(), await body(request)));
  route('system', ['POST'], async request => {
    const b = await body(request);
    const skill = await ctx.skills.get(b.name, { cwd: process.cwd() });
    if (!skill || skill.source !== 'bundled') throw Error('系统技能不存在');
    return { content: skill.content };
  });
  route('save', ['POST'], async request => store.save(await body(request)));
  route('policy', ['POST'], async request => store.policy(await body(request)));
  route('trash', ['GET', 'POST'], async request => request.method === 'GET' ? { items: await store.trashList() } : store.trash(await body(request)));
  route('restore', ['POST'], async request => store.restore(await body(request)));
  route('delete-permanently', ['POST'], async request => store.deletePermanently(await body(request)));
  route('description', ['POST'], async request => {
    const b = await body(request);
    const { skills } = await system();
    if (!skills.some(s => s.name === b.name)) throw Error('系统技能不存在');
    return descriptions.set(b.name, b.description);
  });
}
