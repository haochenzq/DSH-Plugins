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
const descriptionOf=(item,tab)=>tab==='system'?(descriptionsZh[item.name]||item.description||'暂无描述'):(item.description||'个人技能');
async function call(path,body){const r=await fetch(new URL('api/simple-skills/'+path,document.baseURI),{credentials:'same-origin',...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||'读取失败');return d;}
const button={padding:'8px 14px',borderRadius:8,border:'1px solid currentColor',background:'transparent',color:'inherit',cursor:'pointer'};
function Page(){
const [data,setData]=R.useState(null),[tab,setTab]=R.useState('system'),[query,setQuery]=R.useState(''),[selected,setSelected]=R.useState(null),[content,setContent]=R.useState(''),[error,setError]=R.useState(''),[busy,setBusy]=R.useState(false);
async function load(){setBusy(true);try{setData(await call('list'));setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
R.useEffect(()=>{load();},[]);
async function open(item){if(item.error){setError(item.error);return;}if(selected&&content!==selected.content&&!confirm('放弃未保存的修改？'))return;setError('');try{const text=tab==='system'?(await call('system',{name:item.name})).content:item.content;setSelected({...item,content:text,readonly:tab==='system'});setContent(text);}catch(e){setError(e.message);}}
async function save(){setBusy(true);try{await call('save',{id:selected.id,name:selected.name,content,revision:selected.revision});setSelected(null);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
return h('div',{style:{height:'100%',overflow:'auto',padding:'32px',boxSizing:'border-box'},'data-simple-skills':''},
h('h1',null,'技能管理'),h('p',null,'系统技能只读 · 个人技能保存在用户技能目录'),
h('div',{style:{display:'flex',gap:10,flexWrap:'wrap'}},...['system','personal'].map(t=>h('button',{key:t,style:button,'aria-pressed':tab===t,onClick:()=>setTab(t)},(t==='system'?'系统自带':'个人技能')+' '+(data?.[t]?.length??0))),h('button',{style:button,disabled:busy,onClick:load},'刷新'),tab==='personal'?h('button',{style:button,onClick:()=>{const name=prompt('技能名称（小写字母、数字、短横线）');if(!name)return;setSelected({name,content:'',readonly:false});setContent('---\nname: '+name+'\ndescription: 请填写技能描述\n---\n\n# '+name+'\n\n请填写技能指令。\n');}},'新建技能'):null),
h('input',{'aria-label':'搜索技能',placeholder:'搜索技能',value:query,onChange:e=>setQuery(e.target.value),style:{margin:'20px 0',padding:10,width:'100%',boxSizing:'border-box'}}),
error?h('p',{role:'alert'},error):null,busy?h('p',{role:'status'},'处理中…'):null,
data?h('p',null,data.scope+(data.complete?'':'；目录读取不完整，请重试')):null,
h('div',{style:{display:'grid',gap:8}},...(data?.[tab]||[]).filter(i=>(i.name+' '+(i.description||'')+' '+descriptionOf(i,tab)).toLowerCase().includes(query.toLowerCase())).map(i=>h('button',{key:i.name,style:{...button,textAlign:'left'},onClick:()=>open(i)},h('strong',null,i.name),h('div',null,descriptionOf(i,tab))))),
selected?h('section',{style:{marginTop:24}},h('h2',null,selected.name+(selected.readonly?' · 只读':'')),h('textarea',{'aria-label':'技能内容',readOnly:selected.readonly,value:content,onChange:e=>setContent(e.target.value),style:{width:'100%',minHeight:360,boxSizing:'border-box',padding:12,fontFamily:'monospace'}}),!selected.readonly?h('button',{style:button,disabled:busy,onClick:save},'保存'):null,h('button',{style:button,onClick:()=>{if(content===selected.content||confirm('放弃未保存的修改？'))setSelected(null);}},'关闭')):null,
tab==='personal'?h('p',null,'支持用户目录中的独立 .md 和目录型技能；项目与共享目录暂不编辑。保存后由宿主文件监视器更新，已有 / 菜单可能需要重连。'):null);
}
function Icon({size=16}){return h('svg',{width:size,height:size,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor','aria-hidden':true},h('path',{d:'M2 2h5l1 1 1-1h5v11H9l-1 1-1-1H2z M8 3v11'}));}
return {inject:['slots'],apply(ctx){ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'simple-skills'},Page));ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'simple-skills',order:25,label:'技能管理'},Icon));}};
}});
