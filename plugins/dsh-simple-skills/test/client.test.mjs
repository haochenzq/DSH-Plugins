import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// A tiny React hook/event harness. No browser, GUI server or user skill files are touched.
const source=await readFile(new URL('../lib/client.js',import.meta.url),'utf8');
const saved={id:'demo/SKILL.md',name:'demo',description:'旧描述',body:'旧正文',content:'---\nname: demo\ndescription: 旧描述\n---\n\n旧正文',revision:'rev1',modelInvocable:true,userInvocable:false};
const response=(data,ok=true)=>({ok,json:async()=>data});
function setup(){
  let cursor=0,tree,Page,module,confirmResult=false;
  const state=[],effects=[],listeners={},requests=[],confirms=[];
  const data={system:[{name:'office-xlsx',description:'Read Excel workbooks'},{name:'custom',description:'Original unique'}],personal:[{...saved},{id:'bad.md',name:'bad',error:'格式损坏',readonly:true}],translations:{custom:'用户自定义中文'},complete:true,root:'/mock',scope:'仅模拟'};
  let trash={items:[{trashId:'trash-1',name:'old',kind:'directory'}]};
  let handler=async path=>path==='list'?response(data):path==='trash'?response(trash):path==='system'?response({content:'system content'}):response({ok:true});
  const react={Fragment:Symbol('fragment'),createElement:(type,props,...children)=>({type,props:props||{},children}),
    useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
    useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},
    useEffect(fn){const i=cursor++;if(!(i in state)){state[i]=true;effects.push(fn);}}
  };
  const window={__ModuleLoader__:{load(spec){module=spec.factory(name=>{assert.equal(name,'react');return react;});}},
    addEventListener(name,fn){listeners[name]=fn;},removeEventListener(name){delete listeners[name];},
    confirm(message){confirms.push(message);return confirmResult;}};
  const fetch=async(url,options)=>{const path=String(url).split('/').pop();const body=options.body?JSON.parse(options.body):undefined;requests.push({path,body,method:options.method||'GET'});return handler(path,body);};
  vm.runInNewContext(source,{window,document:{baseURI:'http://localhost/'},fetch,URL,console});
  module.apply({slots:{inject(_name,fn){fn();},register(spec,component){if(spec.key==='simple-skills')Page=component;}}});
  assert.ok(Page,'registered main page');
  function render(){cursor=0;tree=Page();return tree;}
  render();const cleanups=effects.splice(0).map(fn=>fn()).filter(fn=>typeof fn==='function');
  const nodes=()=>{const all=[];function visit(n){if(Array.isArray(n)){n.forEach(visit);return;}if(!n||typeof n!=='object')return;all.push(n);visit(n.children);}visit(tree);return all;};
  const text=n=>n==null?'':Array.isArray(n)?n.map(text).join(''):typeof n==='object'?text(n.children):String(n);
  const byText=(type,label)=>{const n=nodes().find(n=>n.type===type&&text(n)===label);assert.ok(n,`${type}: ${label}`);return n;};
  const byLabel=label=>{const n=nodes().find(n=>n.props['aria-label']===label);assert.ok(n,`label: ${label}`);return n;};
  const maybeText=(type,label)=>nodes().find(n=>n.type===type&&text(n)===label);
  const click=label=>{const n=byText('button',label);assert.notEqual(n.props.disabled,true,label+' disabled');const result=n.props.onClick();render();return result;};
  const change=(label,value)=>{const n=byLabel(label);assert.notEqual(n.props.disabled,true,label+' disabled');const result=n.props.onChange({target:{value,checked:value}});render();return result;};
  return {render,nodes,text,byText,byLabel,maybeText,click,change,data,requests,confirms,listeners,
    setConfirm(value){confirmResult=value;},setHandler(fn){handler=fn;},setTrash(value){trash=value;},unmount(){cleanups.forEach(fn=>fn());},
    unload(){let prevented=false;const event={preventDefault(){prevented=true;},returnValue:undefined};listeners.beforeunload(event);return {prevented,returnValue:event.returnValue};}};
}
async function settle(ui){for(let i=0;i<12;i++)await Promise.resolve();ui.render();}
async function ready(){const ui=setup();await settle(ui);return ui;}
function personal(ui){ui.click('个人技能 2');}

test('列表页与新建/编辑页分离，返回与打开都保护草稿并提示 beforeunload',async()=>{
  const ui=await ready();personal(ui);
  assert.ok(ui.maybeText('button','新建技能'));assert.ok(!ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  ui.click('新建技能');
  assert.ok(ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.equal(ui.maybeText('button','新建技能'),undefined,'编辑页不应出现新建按钮');
  assert.equal(ui.unload().prevented,false,'空草稿不应提示离开');
  ui.change('技能名称','draft-one');ui.change('技能描述','中文草稿');
  assert.equal(ui.unload().prevented,true);
  ui.click('返回');assert.equal(ui.byLabel('技能描述').props.value,'中文草稿');
  assert.equal(ui.confirms.length,1);
  ui.setConfirm(true);ui.click('返回');
  assert.ok(!ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.ok(ui.maybeText('button','新建技能'));assert.equal(ui.unload().prevented,false);
  await ui.click('demo旧描述');
  assert.ok(ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.equal(ui.byLabel('技能名称').props.disabled,true);assert.equal(ui.byLabel('技能名称').props.value,'demo');
});

test('保存期间禁止编辑、切换、重复保存；失败保留草稿，成功后刷新',async()=>{
  const ui=await ready();personal(ui);ui.click('新建技能');
  ui.change('技能名称','new-skill');ui.change('技能描述','中文描述');ui.change('技能正文','执行步骤');
  let resolveSave;ui.setHandler(async path=>path==='save'?new Promise(resolve=>{resolveSave=resolve;}):path==='list'?response(ui.data):path==='trash'?response({items:[]}):response({ok:true}));
  const staleInput=ui.byLabel('技能正文').props.onChange,staleBack=ui.byText('button','返回').props.onClick;
  const saving=ui.click('保存技能');assert.equal(ui.byLabel('技能正文').props.disabled,true);assert.equal(ui.byText('button','返回').props.disabled,true);
  assert.equal(ui.unload().prevented,true);
  staleInput({target:{value:'错误覆盖'}});staleBack();ui.render();assert.equal(ui.byLabel('技能正文').props.value,'执行步骤');
  assert.deepEqual(ui.requests.find(r=>r.path==='save').body,{name:'new-skill',description:'中文描述',body:'执行步骤'});
  resolveSave(response({error:'版本冲突'},false));await saving;ui.render();assert.equal(ui.byLabel('技能正文').props.value,'执行步骤');assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/版本冲突/);
  ui.setHandler(async path=>path==='list'?response(ui.data):path==='trash'?response({items:[]}):response({ok:true}));
  await ui.click('保存技能');ui.render();assert.ok(!ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.equal(ui.unload().prevented,false);assert.ok(ui.maybeText('p','技能已保存。'));assert.equal(ui.requests.filter(r=>r.path==='list').length,2);
});

test('高级与分项草稿独立保留，提交另一模式前确认，原文协议正确',async()=>{
  const ui=await ready();personal(ui);await ui.click('demo旧描述');
  ui.change('技能正文','分项草稿');ui.click('高级原文');ui.change('技能完整原文','原文草稿');
  ui.click('分项编辑');assert.equal(ui.byLabel('技能正文').props.value,'分项草稿');
  await ui.click('保存技能');assert.match(ui.confirms.at(-1),/另一种编辑模式/);assert.equal(ui.requests.filter(r=>r.path==='save').length,0);
  ui.click('高级原文');assert.equal(ui.byLabel('技能完整原文').props.value,'原文草稿');
  ui.setConfirm(true);await ui.click('保存技能');ui.render();
  assert.deepEqual(ui.requests.find(r=>r.path==='save').body,{id:'demo/SKILL.md',name:'demo',content:'原文草稿',revision:'rev1'});
});

test('中英文搜索、系统只读与中文覆盖清除、异常只读行',async()=>{
  const ui=await ready();ui.change('搜索技能','公式');assert.ok(ui.maybeText('button','office-xlsx读取、创建、编辑并验证 Excel 工作簿、数据和公式（.xlsx）。'));
  ui.change('搜索技能','Original unique');assert.ok(ui.maybeText('button','custom用户自定义中文'));
  await ui.click('custom用户自定义中文');ui.render();assert.equal(ui.byLabel('系统技能原文').props.readOnly,true);assert.equal(ui.byLabel('中文描述覆盖').props.value,'用户自定义中文');
  ui.change('中文描述覆盖','');await ui.click('保存中文描述');ui.render();
  assert.deepEqual(ui.requests.find(r=>r.path==='description').body,{name:'custom',description:''});
  ui.change('搜索技能','');personal(ui);await ui.click('bad只读：格式损坏');ui.render();assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/格式损坏/);
});

test('两种独立开关、删除确认与回收站恢复均使用约定协议',async()=>{
  const ui=await ready();personal(ui);await ui.click('demo旧描述');
  ui.change('技能正文','未保存');await ui.change('允许模型调用',false);ui.render();assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/先保存/);assert.equal(ui.requests.filter(r=>r.path==='policy').length,0);
  ui.setConfirm(true);ui.click('返回');await ui.click('demo旧描述');
  ui.data.personal[0]={...saved,revision:'rev2',modelInvocable:false};
  await ui.change('允许模型调用',false);ui.render();
  assert.deepEqual(ui.requests.find(r=>r.path==='policy').body,{id:'demo/SKILL.md',name:'demo',revision:'rev1',modelInvocable:false,userInvocable:false});
  await ui.change('允许用户通过 / 调用',true);ui.render();
  assert.deepEqual(ui.requests.filter(r=>r.path==='policy')[1].body,{id:'demo/SKILL.md',name:'demo',revision:'rev2',modelInvocable:false,userInvocable:true});
  await ui.click('移入回收站');ui.render();assert.match(ui.confirms.at(-1),/附件/);
  assert.deepEqual(ui.requests.find(r=>r.path==='trash'&&r.method==='POST').body,{id:'demo/SKILL.md',name:'demo',revision:'rev2'});
  ui.click('回收站 1');await ui.click('恢复');ui.render();assert.deepEqual(ui.requests.find(r=>r.path==='restore').body,{trashId:'trash-1'});
  assert.ok(ui.maybeText('p','技能已恢复。'));
});

test('彻底删除须确认，不可恢复及附件风险明确，失败可重试、成功后刷新',async()=>{
  const ui=await ready();ui.click('回收站 1');
  await ui.click('彻底删除');
  assert.match(ui.confirms.at(-1),/old[\s\S]*trash-1[\s\S]*不可恢复[\s\S]*附件/);
  assert.equal(ui.requests.filter(r=>r.path==='delete-permanently').length,0,'取消不发送请求');
  ui.setConfirm(true);
  ui.setHandler(async path=>path==='delete-permanently'?response({error:'删除失败'},false):path==='list'?response(ui.data):response({items:[{trashId:'trash-1',name:'old',kind:'directory'}]}));
  await ui.click('彻底删除');ui.render();
  assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/删除失败/);
  assert.ok(ui.maybeText('button','恢复'));
  ui.setHandler(async path=>path==='list'?response(ui.data):path==='trash'?response({items:[]}):response({ok:true}));
  await ui.click('彻底删除');ui.render();
  assert.deepEqual(ui.requests.filter(r=>r.path==='delete-permanently').at(-1).body,{trashId:'trash-1'});
  assert.ok(ui.maybeText('p','技能已彻底删除，无法恢复。'));
  assert.ok(ui.maybeText('button','回收站 0'));
});

test('删除接口非 JSON 错误显示状态及相应处理建议',async()=>{
  const ui=await ready();ui.click('回收站 1');ui.setConfirm(true);
  for(const [status,expected] of [[404,/HTTP 404.*重启 DSH/],[401,/HTTP 401.*重新打开/],[500,/HTTP 500.*无法确认.*刷新/]]){
    ui.setHandler(async path=>path==='delete-permanently'?{ok:false,status,json:async()=>{throw Error('not json');}}:path==='list'?response(ui.data):response({items:[]}));
    await ui.click('彻底删除');ui.render();
    assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),expected);
    assert.ok(ui.maybeText('button','恢复'));
  }
});

test('回收站同名条目显示唯一标识，删除成功而刷新失败时不保留旧条目',async()=>{
  const ui=await ready();
  const items=[{trashId:'id-one',name:'old',kind:'file',trashedAt:'2026-11-18T10:00:00Z'},{trashId:'id-two',name:'old',kind:'directory',trashedAt:'2026-11-18T11:00:00Z'}];
  ui.setHandler(async path=>path==='list'?response(ui.data):path==='trash'?response({items}):response({ok:true}));
  await ui.click('刷新');ui.render();ui.click('回收站 2');
  assert.ok(ui.byLabel('彻底删除 old id-one'));assert.ok(ui.byLabel('彻底删除 old id-two'));
  ui.setConfirm(true);
  ui.setHandler(async path=>path==='delete-permanently'?response({ok:true}):response({error:'刷新失败'},false));
  await ui.click('彻底删除');ui.render();
  assert.match(ui.confirms.at(-1),/id-one/);
  assert.equal(ui.nodes().some(n=>n.props['aria-label']==='彻底删除 old id-one'),false);
  assert.ok(ui.byLabel('彻底删除 old id-two'));
  assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/操作成功，但刷新失败/);
});

test('保存成功但刷新失败时明确反馈，不把已提交草稿误当成未保存',async()=>{
  const ui=await ready();personal(ui);ui.click('新建技能');ui.change('技能名称','new');ui.change('技能描述','描述');
  ui.setHandler(async path=>path==='save'?response({ok:true}):path==='list'?response({error:'暂不可用'},false):response({items:[]}));
  await ui.click('保存技能');ui.render();assert.ok(ui.maybeText('p','技能已保存。'));
  assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/操作成功，但刷新失败/);
  assert.equal(ui.unload().prevented,false);
});

test('组件卸载清理 beforeunload 监听器',async()=>{const ui=await ready();assert.equal(typeof ui.listeners.beforeunload,'function');ui.unmount();assert.equal(ui.listeners.beforeunload,undefined);});

test('取消删除、恢复失败和系统原文请求失败有反馈',async()=>{
  const ui=await ready();personal(ui);await ui.click('demo旧描述');
  await ui.click('移入回收站');assert.equal(ui.requests.filter(r=>r.path==='trash'&&r.method==='POST').length,0);
  ui.click('返回');ui.click('回收站 1');ui.setHandler(async path=>path==='restore'?response({error:'名称冲突'},false):path==='system'?response({error:'不可读取'},false):path==='list'?response(ui.data):response({items:[]}));
  await ui.click('恢复');ui.render();assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/名称冲突/);
  ui.click('系统自带 2');await ui.click('custom用户自定义中文');ui.render();assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/不可读取/);
  assert.ok(!ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.ok(ui.maybeText('button','新建技能'),'新建按钮常驻');
});

test('新建名称及分项描述在提交前校验',async()=>{
  const ui=await ready();personal(ui);ui.click('新建技能');
  for(const name of ['','ABC','-abc','a--b','中文','a'.repeat(101)]){
    ui.change('技能名称',name);await ui.click('保存技能');assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/技能名称/);
  }
  ui.change('技能名称','valid-name');ui.change('技能描述','   ');await ui.click('保存技能');
  assert.match(ui.nodes().find(n=>n.props.role==='alert').children.join(''),/技能描述不能为空/);assert.equal(ui.requests.filter(r=>r.path==='save').length,0);
  ui.change('技能描述','中文描述');await ui.click('保存技能');assert.equal(ui.requests.filter(r=>r.path==='save').length,1);
});

test('列表页切换标签不影响数据；编辑页为独立页面，不显示标签与新建按钮',async()=>{
  const ui=await ready();personal(ui);
  ui.click('系统自带 2');assert.ok(ui.maybeText('button','office-xlsx读取、创建、编辑并验证 Excel 工作簿、数据和公式（.xlsx）。'));
  ui.click('回收站 1');assert.ok(ui.maybeText('p','回收站为空。')===undefined);
  ui.click('个人技能 2');assert.ok(ui.maybeText('button','新建技能'));
  ui.click('新建技能');assert.equal(ui.confirms.length,0);
  assert.equal(ui.maybeText('button','系统自带 2'),undefined);
  assert.equal(ui.maybeText('button','回收站 1'),undefined);
  assert.equal(ui.maybeText('button','新建技能'),undefined);
  ui.change('技能名称','draft');assert.ok(ui.maybeText('p','有未保存的草稿'));
});

test('新建技能原文模式保留分项输入并产生可编辑 YAML',async()=>{
  const ui=await ready();personal(ui);ui.click('新建技能');ui.change('技能名称','new-skill');ui.change('技能描述','中文描述');ui.change('技能正文','中文正文');
  ui.click('高级原文');assert.match(ui.byLabel('技能完整原文').props.value,/name: "new-skill"/);assert.match(ui.byLabel('技能完整原文').props.value,/中文描述/);
  ui.change('技能完整原文','高级草稿');ui.click('分项编辑');assert.equal(ui.byLabel('技能正文').props.value,'中文正文');
  ui.click('高级原文');assert.equal(ui.byLabel('技能完整原文').props.value,'高级草稿');
});

test('项目技能分类：按工作区分组、只读打开、可搜索',async()=>{
  const ui=await ready();
  ui.data.projects=[{root:'D:\\proj\\导演',titles:['导演'],skills:[
    {id:'director/SKILL.md',name:'director',description:'导演流程',source:'project-dsh',sourceLabel:'项目技能（.dsh）',path:'D:\\proj\\导演\\.dsh\\skills\\director\\SKILL.md'},
    {id:'helper.md',name:'helper',description:'共享助手',source:'project-agents',sourceLabel:'项目共享（.agents）',path:'D:\\proj\\导演\\.agents\\skills\\helper.md'}
  ]}];
  ui.setHandler(async path=>path==='list'?response(ui.data):path==='trash'?response({items:[]}):path==='project'?response({name:'director',description:'导演流程',content:'---\nname: director\ndescription: 导演流程\n---\n\n正文步骤',path:'D:\\proj\\导演\\.dsh\\skills\\director\\SKILL.md'}):response({ok:true}));
  ui.render();
  ui.click('项目技能 2');
  assert.ok(ui.maybeText('p','导演'),'项目标题');
  assert.ok(ui.maybeText('p','D:\\proj\\导演'),'项目路径');
  assert.ok(ui.maybeText('button','helper共享助手 · 项目共享（.agents）'));
  await ui.click('director导演流程 · 项目技能（.dsh）');
  ui.render();
  assert.ok(ui.nodes().some(n=>n.props['aria-label']==='技能编辑器'));
  assert.equal(ui.byLabel('项目技能原文').props.readOnly,true);
  assert.match(ui.byLabel('项目技能原文').props.value,/正文步骤/);
  assert.equal(ui.byLabel('项目技能路径').props.readOnly,true);
  assert.match(ui.byLabel('项目技能路径').props.value,/director/);
  assert.equal(ui.maybeText('button','保存技能'),undefined);
  assert.equal(ui.maybeText('button','保存中文描述'),undefined);
  assert.equal(ui.unload().prevented,false,'只读页不应阻止离开');
  ui.click('返回');
  ui.change('搜索技能','helper');
  assert.ok(ui.maybeText('button','helper共享助手 · 项目共享（.agents）'));
  assert.equal(ui.maybeText('button','director导演流程 · 项目技能（.dsh）'),undefined);
  ui.change('搜索技能','');
  assert.ok(ui.maybeText('button','director导演流程 · 项目技能（.dsh）'));
});

test('没有项目技能时显示引导空状态',async()=>{
  const ui=await ready();
  ui.data.projects=[];
  ui.render();
  ui.click('项目技能 0');
  assert.ok(ui.maybeText('p','还没有项目技能。'));
  assert.ok(ui.maybeText('button','新建技能'),'新建按钮仍常驻');
});
