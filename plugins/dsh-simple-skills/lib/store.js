import { readdir, readFile, lstat, realpath, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, join, dirname, parse, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export const valid = n => typeof n === 'string' && n.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n);
const hash = s => createHash('sha256').update(s).digest('hex');
// Reject every existing ancestor link, including Windows junctions.
async function guard(path) {
  const full=resolve(path), parts=[]; let p=full;
  while(p!==parse(p).root){parts.push(p);p=dirname(p);}
  for(const item of parts.reverse()) {
    try { if((await lstat(item)).isSymbolicLink())throw Error('不允许链接目录或文件'); }
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
}
export function createStore(base, parseYaml) {
  base=resolve(base); let queue=Promise.resolve();
  function metadata(content,name) {
    if(typeof content!=='string'||Buffer.byteLength(content)>65536)throw Error('技能内容上限64KiB');
    const m=/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
    if(!m)throw Error('缺少完整 YAML frontmatter');
    const data=parseYaml(m[1]);
    if(!data||data.name!==name||!valid(data.name)||typeof data.description!=='string'||!data.description.trim())throw Error('name 必须与技能名一致，description 不能为空');
    return data;
  }
  async function target(id) {
    if(typeof id!=='string')throw Error('技能标识无效');
    const file=resolve(base,id),rel=relative(base,file);
    if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('路径越界');
    if(!/^([a-z0-9]+(?:-[a-z0-9]+)*\.md|[a-z0-9]+(?:-[a-z0-9]+)*[\\/]SKILL\.md)$/.test(rel))throw Error('技能路径无效');
    await guard(file);return file;
  }
  async function list() {
    await guard(base);let entries;try{entries=await readdir(base,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
    const rows=[];
    for(const e of entries){
      const id=e.isDirectory()&&valid(e.name)?e.name+'/SKILL.md':e.isFile()&&e.name.endsWith('.md')&&valid(e.name.slice(0,-3))?e.name:null;
      if(!id)continue;
      try {const file=await target(id);if((await lstat(file)).size>65536)throw Error('文件超过64KiB');const content=await readFile(file,'utf8');const n=e.isDirectory()?e.name:e.name.slice(0,-3);const meta=metadata(content,n);rows.push({id,name:n,description:meta.description,content,revision:hash(content)});}
      catch(e){if(e.code!=='ENOENT')rows.push({id,name:e.name||id,error:e.message,readonly:true});}
    }
    return rows;
  }
  function save(input) {
    const run=queue.then(async()=>{
      const {name,content,revision}=input;if(!valid(name))throw Error('技能名无效');metadata(content,name);
      const id=input.id||name+'.md',file=await target(id);
      await guard(base);await mkdir(base,{recursive:true});await guard(base);
      if(!revision){
        if((await list()).some(s=>s.name===name))throw Error('同名个人技能已存在');
        await writeFile(file,content,{encoding:'utf8',flag:'wx'});return {ok:true};
      }
      const before=await readFile(file,'utf8');if(hash(before)!==revision)throw Error('文件已变化，请刷新');
      const temp=join(dirname(file),'.simple-skills-'+randomUUID()+'.tmp');
      try{await writeFile(temp,content,{encoding:'utf8',flag:'wx'});await guard(file);if(hash(await readFile(file,'utf8'))!==revision)throw Error('文件已变化，请刷新');await rename(temp,file);}
      finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
      return {ok:true};
    });queue=run.catch(()=>{});return run;
  }
  return {list,save,metadata};
}
