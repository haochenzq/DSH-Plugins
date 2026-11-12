import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { parseDocument } from 'yaml';
import { createStore } from './store.js';
export const name='simple-skills';
export const inject=['skills','connection'];
export function apply(ctx) {
  const root=resolve(process.env.DSH_HOME||join(homedir(),'.dsh'),'skills');
  const store=createStore(root,text=>{const doc=parseDocument(text,{uniqueKeys:true});if(doc.errors.length)throw Error('YAML 格式有误：'+doc.errors[0].message);return doc.toJS({maxAliasCount:10});});
  const route=(path,methods,fn)=>ctx.connection.fetch.register({path:'/api/simple-skills/'+path,methods,requestBody:'buffered',fetch:async request=>{
    try{return Response.json(await fn(request),{headers:{'cache-control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:400,headers:{'cache-control':'no-store'}});}
  }});
  const body=async request=>{const text=await request.text();if(Buffer.byteLength(text)>100000)throw Error('请求过大');return JSON.parse(text);};
  route('list',['GET'],async()=>{const snapshot=await ctx.skills.snapshot({cwd:process.cwd()});return {system:snapshot.skills.filter(s=>s.source==='bundled').map(({name,description,provider})=>({name,description,provider})),personal:await store.list(),complete:snapshot.complete,root,scope:'宿主全局视图，不包含预设专属技能；个人技能仅含用户 DSH 目录'};});
  route('system',['POST'],async request=>{const b=await body(request);const s=await ctx.skills.get(b.name,{cwd:process.cwd()});if(!s||s.source!=='bundled')throw Error('系统技能不存在');return {content:s.content};});
  route('save',['POST'],async request=>store.save(await body(request)));
}
