window.__ModuleLoader__.load({id:'dsh-simple-skills',factory(require){
const R=require('react'), h=R.createElement;
const descriptionsZh={
  'diagnose-windows-sandbox-acl':'排查 Windows 下异常的沙箱访问拒绝：检查目标及各级父目录，仅修复已确认的 ACL 权限问题；正常的沙箱限制无需修复。',
  'office':'创建、编辑、检查或转换 Office 文档、电子表格、演示文稿及 PDF，并选择对应的处理流程。',
  'office-docx':'创建、读取、编辑并验证 Word 文档（.docx）。',
  'office-export-pdf':'使用 LibreOffice Kit 将 Office 文档转换为 PDF。',
  'office-pptx':'创建、读取、编辑并验证 PowerPoint 演示文稿（.pptx）。',
  'office-recalculate':'使用 LibreOffice Kit 刷新电子表格公式缓存，并验证计算结果。',
  'office-render':'使用 LibreOffice Kit 将文档页面渲染为图片，或检查可视化排版。',
  'office-xlsx':'读取、创建、编辑并验证 Excel 工作簿、数据和公式（.xlsx）。'
};
const CSS=`
.ss-root{--ss-line:var(--ds-line,rgba(150,190,230,.11));--ss-line-strong:var(--ds-line-strong,rgba(160,200,240,.2));--ss-glow:var(--ds-line-glow,rgba(77,107,254,.38));--ss-surface:var(--ds-surface-3,#141C28);--ss-card:var(--ds-glass-card,rgba(9,14,23,.64));--ss-card-hover:var(--ds-glass-card-hover,rgba(16,24,38,.72));--ss-hover:var(--ds-glass-hover,rgba(24,34,48,.55));--ss-text1:var(--ds-text-1,#E9F0FA);--ss-text2:var(--ds-text-2,#A9B8CC);--ss-text3:var(--ds-text-3,#78889C);--ss-brand:var(--ds-btn-primary,#3A54E6);--ss-brand-hover:var(--ds-btn-primary-hover,#4560F0);--ss-err:var(--ds-err,#FF7A7A);--ss-ok:var(--ds-ok,#3DDC97);--ss-mono:var(--ds-font-mono,"Cascadia Code",Consolas,monospace);height:100%;overflow:auto;box-sizing:border-box;padding:clamp(16px,4vw,32px);color:var(--ss-text1);font-family:var(--ds-font-sans,inherit)}
.ss-wrap{max-width:1000px;margin:0 auto}
.ss-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.ss-title{margin:0;font-size:var(--ds-fs-28,28px);font-weight:var(--ds-fw-semi,600);letter-spacing:-.01em;line-height:1.2}
.ss-sub{margin:6px 0 0;color:var(--ss-text3);font-size:var(--ds-fs-13,13px)}
.ss-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ss-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-height:32px;box-sizing:border-box;padding:0 12px;border-radius:9px;border:1px solid var(--ss-line);background:transparent;color:var(--ss-text1);font:inherit;font-size:var(--ds-fs-13,13px);font-weight:400;line-height:1;cursor:pointer}
.ss-btn:hover:not(:disabled){background:var(--ss-hover);border-color:var(--ss-line-strong)}
.ss-btn:disabled{opacity:.45;cursor:not-allowed}
.ss-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-height:32px;box-sizing:border-box;padding:0 12px;border-radius:9px;border:1px solid transparent;background:var(--ss-brand);color:#fff;font:inherit;font-size:var(--ds-fs-13,13px);font-weight:400;line-height:1;cursor:pointer;box-shadow:var(--ds-btn-primary-glow,0 0 0 1px rgba(123,147,255,.25))}
.ss-primary:hover:not(:disabled){background:var(--ss-brand-hover)}
.ss-primary:disabled{opacity:.45;cursor:not-allowed}
.ss-danger{color:var(--ss-err);border-color:rgba(255,122,122,.32)}
.ss-danger:hover:not(:disabled){background:var(--ds-err-bg,rgba(255,122,122,.1));border-color:rgba(255,122,122,.5)}
.ss-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:18px;border-bottom:1px solid var(--ss-line);padding-bottom:8px}
.ss-tab{border:none;background:transparent;color:var(--ss-text2);padding:8px 14px;border-radius:9px;font:inherit;font-size:var(--ds-fs-14,14px);cursor:pointer}
.ss-tab:hover:not(:disabled){color:var(--ss-text1);background:var(--ss-hover)}
.ss-tab[aria-pressed="true"]{background:var(--ss-surface);color:var(--ss-text1)}
.ss-tab:disabled{opacity:.45;cursor:not-allowed}
.ss-search{position:relative;display:flex;align-items:center;margin-bottom:14px}
.ss-search>svg{position:absolute;left:15px;color:var(--ss-text3);pointer-events:none}
.ss-input{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:12px;border:1px solid var(--ss-line);background:rgba(6,10,17,.5);color:var(--ss-text1);font:inherit;font-size:var(--ds-fs-14,14px)}
.ss-input::placeholder{color:var(--ss-text3)}
.ss-input:focus{outline:none;border-color:var(--ss-glow);box-shadow:0 0 0 3px var(--ds-brand-12,rgba(77,107,254,.12))}
.ss-search .ss-input{padding-left:44px}
.ss-list{display:grid;gap:10px}
.ss-item{display:block;width:100%;text-align:left;padding:13px 16px;border-radius:12px;border:1px solid var(--ss-line);background:var(--ss-card);color:inherit;font:inherit;cursor:pointer}
.ss-item:hover:not(:disabled){background:var(--ss-card-hover);border-color:var(--ss-line-strong)}
.ss-item:disabled{opacity:.6;cursor:not-allowed}
.ss-item strong{display:block;font-size:var(--ds-fs-15,15px);font-weight:var(--ds-fw-medium,500);margin-bottom:3px}
.ss-item span{display:block;color:var(--ss-text3);font-size:var(--ds-fs-13,13px);line-height:1.55}
.ss-empty{display:flex;flex-direction:column;align-items:center;gap:14px;padding:72px 16px 64px;color:var(--ss-text3);text-align:center}
.ss-empty svg{opacity:.5}
.ss-empty p{margin:0;font-size:var(--ds-fs-14,14px)}
.ss-meta{color:var(--ss-text3);font-size:var(--ds-fs-12,12px);margin:14px 0 0;line-height:1.6}
.ss-label{display:block;color:var(--ss-text3);font-size:var(--ds-fs-12,12px);margin-top:4px}
.ss-field{width:100%;box-sizing:border-box;padding:11px 14px;margin:6px 0 16px;border-radius:12px;border:1px solid var(--ss-line);background:rgba(6,10,17,.5);color:var(--ss-text1);font:inherit;font-size:var(--ds-fs-14,14px)}
.ss-field:focus{outline:none;border-color:var(--ss-glow);box-shadow:0 0 0 3px var(--ds-brand-12,rgba(77,107,254,.12))}
textarea.ss-field{font-family:var(--ss-mono);font-size:var(--ds-fs-13,13px);line-height:1.65;resize:vertical}
.ss-field[readonly]{opacity:.85}
.ss-alert{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:var(--ds-fs-13,13px);color:var(--ss-err);background:var(--ds-err-bg,rgba(255,122,122,.1));border:1px solid rgba(255,122,122,.28)}
.ss-ok{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:var(--ds-fs-13,13px);color:var(--ss-ok);background:var(--ds-ok-bg,rgba(61,220,151,.1));border:1px solid rgba(61,220,151,.28)}
.ss-busy{margin:0 0 14px;color:var(--ss-text3);font-size:var(--ds-fs-13,13px)}
.ss-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.ss-editor-title{font-size:var(--ds-fs-20,20px);font-weight:var(--ds-fw-semi,600)}
.ss-dirty{color:var(--ds-warn,#F2B85C);font-size:var(--ds-fs-12,12px);margin:0 0 10px}
.ss-modes{display:flex;gap:8px;margin:4px 0 10px}
.ss-mode{padding:7px 14px;border-radius:9px;border:1px solid var(--ss-line);background:transparent;color:var(--ss-text2);font:inherit;font-size:var(--ds-fs-13,13px);cursor:pointer}
.ss-mode[aria-pressed="true"]{background:var(--ss-surface);color:var(--ss-text1);border-color:var(--ss-line-strong)}
.ss-switch{display:flex;align-items:center;gap:10px;padding:8px 0;color:var(--ss-text2);font-size:var(--ds-fs-13,13px);cursor:pointer}
.ss-switch input{width:16px;height:16px;accent-color:var(--ss-brand);cursor:pointer}
.ss-group{margin:18px 0;padding:14px 16px;border:1px solid var(--ss-line);border-radius:12px;background:var(--ss-card)}
.ss-group legend{padding:0 8px;color:var(--ss-text3);font-size:var(--ds-fs-12,12px)}
.ss-hint{color:var(--ss-text3);font-size:var(--ds-fs-12,12px);line-height:1.65;margin:8px 0 0}
.ss-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.ss-group-title{margin:20px 0 2px;font-size:var(--ds-fs-13,13px);color:var(--ss-text2);font-weight:var(--ds-fw-medium,500)}
.ss-group-path{margin:0 0 8px;font-family:var(--ss-mono);font-size:var(--ds-fs-11,11px);color:var(--ss-text3);word-break:break-all}
`;
const iconSearch=h('svg',{width:17,height:17,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,'aria-hidden':true},h('circle',{cx:11,cy:11,r:7}),h('path',{d:'m20 20-3.5-3.5'}));
const iconPlus=h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.4,strokeLinecap:'round','aria-hidden':true},h('path',{d:'M12 5v14M5 12h14'}));
const iconRefresh=h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round','aria-hidden':true},h('path',{d:'M20 11a8 8 0 1 0-2.3 6.1'}),h('path',{d:'M20 4v7h-7'}));
const iconEmpty=h('svg',{width:72,height:72,viewBox:'0 0 48 48',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinejoin:'round','aria-hidden':true},h('rect',{x:10,y:7,width:28,height:34,rx:4}),h('path',{d:'M17 16h14M17 22h14M17 28h9'}));
async function call(path,body){
  const options={credentials:'same-origin'};
  if(body!==undefined) Object.assign(options,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await fetch(new URL('api/simple-skills/'+path,document.baseURI),options);
  let result; try{result=await response.json();}catch{
    if(response.status===404)throw Error('接口不存在（HTTP 404）；请重启 DSH 以加载更新后的插件。');
    if(response.status===401||response.status===403)throw Error('接口访问被拒绝（HTTP '+response.status+'）；请重新打开 DSH 后重试。');
    throw Error('服务器响应无法解析（HTTP '+(response.status||'未知')+'），操作结果无法确认，请刷新检查。');
  }
  if(!response.ok) throw Error(result?.error||'请求失败');
  return result;
}
function displayDescription(item,tab,data){
  return tab==='system'?(data?.translations?.[item.name]||descriptionsZh[item.name]||item.description||'暂无描述'):(item.description||'暂无描述');
}
function newDraft(item,system,data,content){
  if(system){
    const translation=data?.translations?.[item.name]||'';
    return {item,system:true,content:content||'',translation,initialTranslation:translation};
  }
  const existing=!!item.id;
  const values={name:item.name||'',description:item.description||'',body:item.body||'',content:item.content||''};
  return {item,system:false,existing,mode:'structured',values,initial:{...values},rawInitialized:existing};
}
function dirty(draft){
  if(!draft)return false;
  if(draft.project)return false;
  if(draft.system)return draft.translation!==draft.initialTranslation;
  return Object.keys(draft.initial).some(key=>draft.values[key]!==draft.initial[key]);
}
function Page(){
  const [data,setData]=R.useState(null),[tab,setTab]=R.useState('system'),[query,setQuery]=R.useState('');
  const [draft,setDraft]=R.useState(null),[view,setView]=R.useState('list');
  const [trash,setTrash]=R.useState([]),[busy,setBusy]=R.useState(false);
  const [error,setError]=R.useState(''),[success,setSuccess]=R.useState('');
  const lock=R.useRef(false),dirtyRef=R.useRef(false);
  dirtyRef.current=dirty(draft);
  R.useEffect(()=>{
    const beforeUnload=event=>{if(dirtyRef.current||lock.current){event.preventDefault();event.returnValue='';return '';}};
    window.addEventListener('beforeunload',beforeUnload);
    return ()=>window.removeEventListener('beforeunload',beforeUnload);
  },[]);
  function acquire(){if(lock.current)return false;lock.current=true;setBusy(true);setError('');setSuccess('');return true;}
  function release(){lock.current=false;setBusy(false);}
  function mayLeave(){return !lock.current&&(!dirtyRef.current||window.confirm('当前有未保存的草稿。确定放弃修改吗？'));}
  async function reload(){
    const [list,bin]=await Promise.all([call('list'),call('trash')]);
    setData(list);setTrash(Array.isArray(bin.items)?bin.items:[]);return list;
  }
  async function refresh(){if(!acquire())return;try{await reload();setSuccess('列表已刷新。');}catch(e){setError('刷新失败：'+e.message);}finally{release();}}
  // 首次打开静默加载，不显示刷新提示。
  R.useEffect(()=>{(async()=>{if(!acquire())return;try{await reload();}catch(e){setError('读取失败：'+e.message);}finally{release();}})();},[]);
  function update(patch){if(lock.current)return;dirtyRef.current=true;setDraft(current=>current?{...current,...patch}:current);}
  function updateValue(key,value){if(lock.current)return;dirtyRef.current=true;setDraft(current=>current?{...current,values:{...current.values,[key]:value}}:current);}
  function toList(){if(lock.current)return false;if(!mayLeave())return false;dirtyRef.current=false;setDraft(null);setError('');setSuccess('');setView('list');return true;}
  function create(){if(lock.current||!toList())return;setTab('personal');dirtyRef.current=true;setDraft(newDraft({},false,data));setView('edit');}
  async function open(item,kind){
    if(lock.current)return;
    if(item.error||item.readonly){setError('此技能无法编辑：'+(item.error||'只读'));setSuccess('');return;}
    if(!mayLeave())return;
    if(kind==='system'){
      if(!acquire())return;
      try{const result=await call('system',{name:item.name});dirtyRef.current=false;setDraft(newDraft(item,true,data,result.content));setView('edit');}
      catch(e){setError('打开失败：'+e.message);}finally{release();}
    }else if(kind==='project'){
      if(!acquire())return;
      try{const result=await call('project',{root:item.root,source:item.source,id:item.id});dirtyRef.current=false;setDraft({project:true,item:{...item,...result}});setView('edit');}
      catch(e){setError('打开失败：'+e.message);}finally{release();}
    }else{dirtyRef.current=false;setError('');setSuccess('');setDraft(newDraft(item,false,data));setView('edit');}
  }
  function changeMode(mode){
    if(lock.current||!draft||draft.system||mode===draft.mode)return;
    if(mode==='raw'&&!draft.rawInitialized){
      const v=draft.values;
      const content='---\nname: '+JSON.stringify(v.name)+'\ndescription: '+JSON.stringify(v.description)+'\n---\n\n'+v.body;
      update({mode,rawInitialized:true,values:{...v,content}});
    }else update({mode});
  }
  async function operation(path,payload,message,after,failurePrefix='操作失败：'){
    if(!acquire())return;
    try{
      await call(path,payload);
      if(after)after();
      try{const list=await reload();setSuccess(message);return list;}
      catch(e){setSuccess(message);setError('操作成功，但刷新失败：'+e.message);return null;}
    }catch(e){setError(failurePrefix+e.message);return null;}
    finally{release();}
  }
  function backToList(){dirtyRef.current=false;setDraft(null);setView('list');}
  async function save(){
    if(!draft||draft.system||lock.current)return;
    const {values:v,initial,mode,item,existing}=draft;
    if(!existing&&(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.name)||v.name.length>100)){setError('技能名称须为不超过 100 个字符的小写字母、数字和短横线，且不能以短横线开头或结尾。');setSuccess('');return;}
    if(mode==='structured'&&!v.description.trim()){setError('技能描述不能为空，请填写描述。');setSuccess('');return;}
    const otherChanged=mode==='raw'?(['description','body'].some(k=>v[k]!==initial[k])):(draft.rawInitialized&&v.content!==initial.content);
    if(otherChanged&&!window.confirm('另一种编辑模式中也有草稿；保存当前模式会放弃另一模式的修改。继续吗？'))return;
    const payload={...(existing?{id:item.id,revision:item.revision}:{}),name:v.name};
    if(mode==='raw')payload.content=v.content;else Object.assign(payload,{description:v.description,body:v.body});
    await operation('save',payload,'技能已保存。',backToList);
  }
  async function saveDescription(){
    if(!draft?.system||lock.current)return;
    await operation('description',{name:draft.item.name,description:draft.translation},'中文描述已保存（空白表示清除覆盖）。',backToList);
  }
  async function setPolicy(key,value){
    if(!draft||draft.system||!draft.existing||lock.current)return;
    if(dirtyRef.current){setError('请先保存或放弃草稿，再修改调用开关。');setSuccess('');return;}
    const item=draft.item;
    const payload={id:item.id,name:item.name,revision:item.revision,modelInvocable:!!item.modelInvocable,userInvocable:!!item.userInvocable,[key]:value};
    const list=await operation('policy',payload,'调用设置已保存。',()=>{dirtyRef.current=false;});
    if(list){const updated=list.personal?.find(i=>i.id===item.id&&!i.error&&!i.readonly);if(updated)setDraft(newDraft(updated,false,list));}
  }
  async function remove(){
    if(!draft||draft.system||!draft.existing||lock.current)return;
    if(dirtyRef.current&&!window.confirm('当前有未保存的草稿；删除会放弃草稿。继续吗？'))return;
    if(!window.confirm('确定将此个人技能移入回收站？目录型技能会连同目录内全部附件一起移入，之后可从回收站恢复。'))return;
    const item=draft.item;
    await operation('trash',{id:item.id,name:item.name,revision:item.revision},'技能已移入回收站，可在回收站恢复。',backToList);
  }
  async function restore(item){
    if(lock.current)return;
    await operation('restore',{trashId:item.trashId},'技能已恢复。');
  }
  async function deletePermanently(item){
    if(lock.current)return;
    if(!window.confirm('确定彻底删除“'+item.name+'”？\n回收时间：'+(item.trashedAt||'未知')+'\n回收项标识：'+item.trashId+'\n此操作不可恢复；目录技能及其全部附件也会一并删除。'))return;
    await operation('delete-permanently',{trashId:item.trashId},'技能已彻底删除，无法恢复。',()=>setTrash(items=>items.filter(entry=>entry.trashId!==item.trashId)),'彻底删除失败，可能已删除部分文件，请刷新检查：');
  }
  const feedback=[error?h('p',{key:'e',className:'ss-alert',role:'alert'},error):null,success?h('p',{key:'s',className:'ss-ok',role:'status'},success):null,busy?h('p',{key:'b',className:'ss-busy',role:'status'},'处理中，请稍候…'):null];
  const header=h('header',{className:'ss-head'},
    h('div',null,h('h1',{className:'ss-title'},'技能管理'),h('p',{className:'ss-sub'},'系统技能只读 · 个人技能仅管理用户技能目录 · 项目技能只读')),
    h('div',{className:'ss-row'},h('button',{className:'ss-btn',disabled:busy,onClick:refresh},iconRefresh,'刷新'),h('button',{className:'ss-primary',disabled:busy,onClick:create},iconPlus,'新建技能')));
  const projectCount=(data?.projects||[]).reduce((count,project)=>count+project.skills.length,0);
  const tabs=h('div',{className:'ss-tabs'},...['system','personal','project','trash'].map(t=>h('button',{key:t,className:'ss-tab',disabled:busy,'aria-pressed':tab===t,onClick:()=>{if(!lock.current)setTab(t);}},(t==='system'?'系统自带':t==='personal'?'个人技能':t==='project'?'项目技能':'回收站')+' '+(t==='trash'?trash.length:t==='project'?projectCount:(data?.[t]?.length??0)))));
  const list=(data?.[tab]||[]).filter(item=>(item.name+' '+(item.description||'')+' '+displayDescription(item,tab,data)+' '+(tab==='system'?descriptionsZh[item.name]||'':'')).toLowerCase().includes(query.toLowerCase()));
  const projectGroups=tab==='project'?(data?.projects||[]).map(project=>({...project,skills:project.skills.filter(item=>(item.name+' '+(item.description||'')+' '+project.titles.join(' ')+' '+project.root).toLowerCase().includes(query.toLowerCase()))})).filter(project=>project.skills.length):[];
  const emptyText=!data?'正在加载技能。':tab==='personal'?'还没有个人技能，点「新建技能」开始。':'没有匹配的技能。';
  const searchBox=h('div',{className:'ss-search'},iconSearch,h('input',{className:'ss-input','aria-label':'搜索技能',placeholder:'搜索名称、中文或原始描述',value:query,onChange:e=>setQuery(e.target.value)}));
  const listBody=tab==='trash'
    ?(trash.length?h('div',{className:'ss-list'},...trash.map(item=>h('div',{key:item.trashId,className:'ss-item',style:{cursor:'default',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}},h('div',{style:{minWidth:0,overflowWrap:'anywhere'}},h('strong',null,item.name),h('span',null,item.kind==='directory'?'目录技能（含附件）':item.kind==='file'?'单文件技能':'技能'),h('span',null,'回收时间：'+(item.trashedAt||'未知')+' · 标识：'+item.trashId)),h('div',{className:'ss-row'},h('button',{className:'ss-btn',disabled:busy,'aria-label':'恢复 '+item.name+' '+item.trashId,onClick:()=>restore(item)},'恢复'),h('button',{className:'ss-btn ss-danger',disabled:busy,'aria-label':'彻底删除 '+item.name+' '+item.trashId,onClick:()=>deletePermanently(item)},'彻底删除'))))):h('div',{className:'ss-empty'},iconEmpty,h('p',null,!data?(error?'无法读取回收站，请重试。':'正在加载回收站。'):'回收站为空。'),h('p',{className:'ss-hint'},'移入回收站的技能可恢复，也可彻底删除；目录型技能包含附件。')))
    :tab==='project'
    ?h(R.Fragment,null,searchBox,
      projectGroups.length?h(R.Fragment,null,...projectGroups.map(project=>h('div',{key:project.root},
        h('p',{className:'ss-group-title'},project.titles.join(' / ')),
        h('p',{className:'ss-group-path'},project.root),
        h('div',{className:'ss-list'},...project.skills.map(item=>h('button',{key:project.root+'|'+item.source+'|'+item.id,className:'ss-item',disabled:busy,onClick:()=>open({...item,root:project.root},'project')},h('strong',null,item.name),h('span',null,item.error?'只读：'+item.error:(item.description||'暂无描述')+' · '+item.sourceLabel)))))))
      :h('div',{className:'ss-empty'},iconEmpty,h('p',null,projectCount?'没有匹配的技能。':'还没有项目技能。'),h('p',{className:'ss-hint'},'项目技能放在工作区的 .dsh/skills 或 .agents/skills 目录；把该项目作为工作区添加后这里会列出。')))
    :h(R.Fragment,null,
      searchBox,
      list.length?h('div',{className:'ss-list'},...list.map(item=>h('button',{key:item.id||item.name,className:'ss-item',disabled:busy,onClick:()=>open(item,tab)},h('strong',null,item.name),h('span',null,item.error?'只读：'+item.error:displayDescription(item,tab,data))))):h('div',{className:'ss-empty'},iconEmpty,h('p',null,emptyText)));
  const listPage=h('section',{'aria-label':'技能列表页'},header,...feedback,tabs,tab==='trash'?null:h('p',{className:'ss-meta'},(data?.scope||'')+(data?.complete?'':'；目录读取不完整，请重试')),listBody,
    h('p',{className:'ss-meta'},'个人技能支持独立 .md 和目录型技能；项目技能随项目文件维护，本插件只读显示。'));
  const label=(text,element)=>h('label',{className:'ss-label'},text,element);
  const editorPage=draft&&h('section',{'aria-label':'技能编辑器'},
    h('div',{className:'ss-editor-head'},
      h('div',{className:'ss-row'},h('button',{className:'ss-btn',disabled:busy,onClick:()=>toList()},'返回'),h('span',{className:'ss-editor-title'},draft.project?draft.item.name+' · 项目技能只读':draft.system?draft.item.name+' · 系统技能只读':draft.existing?draft.item.name+' · 个人技能':'新建个人技能')),
      h('div',{className:'ss-row'},draft.project?null:draft.system
        ?h('button',{className:'ss-primary',disabled:busy||!dirty(draft),onClick:saveDescription},'保存中文描述')
        :h(R.Fragment,null,h('button',{className:'ss-primary',disabled:busy,onClick:save},'保存技能'),draft.existing?h('button',{className:'ss-btn ss-danger',disabled:busy,onClick:remove},'移入回收站'):null))),
    ...feedback,
    dirty(draft)?h('p',{className:'ss-dirty',role:'status'},'有未保存的草稿'):null,
    draft.project?h(R.Fragment,null,
      h('p',{className:'ss-hint'},'项目技能由项目文件维护（'+(draft.item.sourceLabel||'项目目录')+'），本插件只读显示，不修改项目文件。'),
      label('文件路径',h('input',{className:'ss-field',readOnly:true,value:draft.item.path||'','aria-label':'项目技能路径'})),
      h('p',{className:'ss-hint'},'原始描述：'+(draft.item.description||'暂无描述')),
      h('h3',{className:'ss-label',style:{marginTop:20}}, '技能原文'),
      h('textarea',{className:'ss-field',style:{minHeight:320},'aria-label':'项目技能原文',readOnly:true,value:draft.item.content||''})
    ):draft.system?h(R.Fragment,null,
      h('p',{className:'ss-hint'},'系统技能原文只读。中文描述覆盖由本插件单独保存，不修改系统文件；留空可清除覆盖。'),
      h('p',{className:'ss-hint'},'原始描述：'+(draft.item.description||'暂无描述')),
      label('中文描述覆盖',h('textarea',{className:'ss-field','aria-label':'中文描述覆盖',disabled:busy,value:draft.translation,onChange:e=>update({translation:e.target.value}),style:{minHeight:80}})),
      h('h3',{className:'ss-label',style:{marginTop:20}}, '系统原文'),
      h('textarea',{className:'ss-field',style:{minHeight:280},'aria-label':'系统技能原文',readOnly:true,value:draft.content})
    ):h(R.Fragment,null,
      label('技能名称（小写字母、数字和短横线；创建后不可更改）',h('input',{className:'ss-field','aria-label':'技能名称',value:draft.values.name,disabled:busy||draft.existing,onChange:e=>updateValue('name',e.target.value)})),
      h('div',{className:'ss-modes'},h('button',{className:'ss-mode',disabled:busy,'aria-pressed':draft.mode==='structured',onClick:()=>changeMode('structured')},'分项编辑'),h('button',{className:'ss-mode',disabled:busy,'aria-pressed':draft.mode==='raw',onClick:()=>changeMode('raw')},'高级原文')),
      h('p',{className:'ss-hint'},'两种模式的草稿分别保留，不自动同步。保存只提交当前模式；另一模式若有改动会先确认。高级原文须包含与名称一致的 YAML 元数据。'),
      draft.mode==='structured'?h(R.Fragment,null,
        label('描述',h('textarea',{className:'ss-field','aria-label':'技能描述',disabled:busy,value:draft.values.description,onChange:e=>updateValue('description',e.target.value),style:{minHeight:80}})),
        label('正文',h('textarea',{className:'ss-field','aria-label':'技能正文',disabled:busy,value:draft.values.body,onChange:e=>updateValue('body',e.target.value),style:{minHeight:280}}))
      ):label('完整原文（包含 YAML 头部）',h('textarea',{className:'ss-field','aria-label':'技能完整原文',disabled:busy,value:draft.values.content,onChange:e=>updateValue('content',e.target.value),style:{minHeight:340}})),
      draft.existing?h('fieldset',{className:'ss-group',disabled:busy},h('legend',null,'调用方式'),
        h('label',{className:'ss-switch'},h('input',{type:'checkbox','aria-label':'允许模型调用',checked:!!draft.item.modelInvocable,onChange:e=>setPolicy('modelInvocable',e.target.checked)}),'允许模型调用'),
        h('label',{className:'ss-switch'},h('input',{type:'checkbox','aria-label':'允许用户通过 / 调用',checked:!!draft.item.userInvocable,onChange:e=>setPolicy('userInvocable',e.target.checked)}),'允许用户通过 / 调用'),
        h('p',{className:'ss-hint'},'分别控制模型是否可主动调用、用户是否可在 / 菜单调用；设置不是安全边界。更改后依赖宿主重新加载，已有会话或菜单可能需要重连；请先保存草稿。')):null
    ));
  return h('div',{className:'ss-root','data-simple-skills':''},h('style',null,CSS),h('div',{className:'ss-wrap'},view==='list'||!draft?listPage:editorPage));
}
function Icon({size=16}){return h('svg',{width:size,height:size,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor','aria-hidden':true},h('path',{d:'M2 2h5l1 1 1-1h5v11H9l-1 1-1-1H2z M8 3v11'}));}
return {inject:['slots'],apply(ctx){ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'simple-skills'},Page));ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'simple-skills',order:25,label:'技能管理'},Icon));}};
}});

// 本模块由 DSH 的客户端模块加载器执行，不直接访问用户文件。
