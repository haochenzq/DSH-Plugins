window.__ModuleLoader__.load({id:'dsh-openai-usage',factory(require){
const R=require('react'), h=R.createElement;
const BUCKETS=['input','output','cached','cacheWrite','reasoning','requests'];
const CSS=`
.ou-root{--ou-line:var(--ds-line,rgba(150,190,230,.11));--ou-line-strong:var(--ds-line-strong,rgba(160,200,240,.2));--ou-card:var(--ds-glass-card,rgba(9,14,23,.64));--ou-hover:var(--ds-glass-hover,rgba(24,34,48,.55));--ou-text1:var(--ds-text-1,#E9F0FA);--ou-text2:var(--ds-text-2,#A9B8CC);--ou-text3:var(--ds-text-3,#78889C);--ou-brand:var(--ds-btn-primary,#3A54E6);--ou-brand-hover:var(--ds-btn-primary-hover,#4560F0);--ou-ok:var(--ds-ok,#3DDC97);--ou-warn:var(--ds-warn,#F2B85C);--ou-err:var(--ds-err,#FF7A7A);--ou-mono:var(--ds-font-mono,"Cascadia Code",Consolas,monospace);height:100%;overflow:auto;box-sizing:border-box;padding:clamp(16px,4vw,32px);color:var(--ou-text1);font-family:var(--ds-font-sans,inherit)}
.ou-wrap{max-width:1000px;margin:0 auto}
.ou-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
.ou-title{margin:0;font-size:var(--ds-fs-28,28px);font-weight:var(--ds-fw-semi,600);letter-spacing:-.01em;line-height:1.2}
.ou-sub{margin:6px 0 0;color:var(--ou-text3);font-size:var(--ds-fs-13,13px);line-height:1.6}
.ou-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.ou-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-height:32px;box-sizing:border-box;padding:0 12px;border-radius:9px;border:1px solid var(--ou-line);background:transparent;color:var(--ou-text1);font:inherit;font-size:var(--ds-fs-13,13px);line-height:1;cursor:pointer;text-decoration:none}
.ou-btn:hover:not(:disabled){background:var(--ou-hover);border-color:var(--ou-line-strong)}
.ou-btn:disabled{opacity:.45;cursor:not-allowed}
.ou-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-height:32px;box-sizing:border-box;padding:0 12px;border-radius:9px;border:1px solid transparent;background:var(--ou-brand);color:#fff;font:inherit;font-size:var(--ds-fs-13,13px);line-height:1;cursor:pointer}
.ou-primary:hover:not(:disabled){background:var(--ou-brand-hover)}
.ou-primary:disabled{opacity:.45;cursor:not-allowed}
.ou-alert{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:var(--ds-fs-13,13px);color:var(--ou-err);background:var(--ds-err-bg,rgba(255,122,122,.1));border:1px solid rgba(255,122,122,.28)}
.ou-ok{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:var(--ds-fs-13,13px);color:var(--ou-ok);background:var(--ds-ok-bg,rgba(61,220,151,.1));border:1px solid rgba(61,220,151,.28)}
.ou-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}
.ou-cards-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ou-card{padding:16px 18px;border-radius:14px;border:1px solid var(--ou-line);background:var(--ou-card)}
.ou-card-label{margin:0 0 8px;color:var(--ou-text3);font-size:var(--ds-fs-12,12px);letter-spacing:.04em;display:flex;align-items:center;gap:6px;justify-content:space-between}
.ou-card-value{margin:0;font-size:var(--ds-fs-26,26px);font-weight:var(--ds-fw-semi,600);font-variant-numeric:tabular-nums;line-height:1.15}
.ou-card-value-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.ou-card-spend{color:var(--ou-text3);font-size:var(--ds-fs-13,13px);line-height:1.3;white-space:nowrap}
.ou-card-spend b{color:var(--ou-text2);font-weight:var(--ds-fw-medium,500);font-variant-numeric:tabular-nums}
.ou-card-unit{font-size:var(--ds-fs-13,13px);color:var(--ou-text3);font-weight:400;margin-left:3px}
.ou-card-sub{margin:8px 0 0;color:var(--ou-text3);font-size:var(--ds-fs-12,12px);line-height:1.6}
.ou-card-sub b{color:var(--ou-text2);font-weight:500}
.ou-break{margin:10px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:4px 14px;color:var(--ou-text2);font-size:var(--ds-fs-12,12px)}
.ou-break span{display:flex;justify-content:space-between;gap:8px;white-space:nowrap}
.ou-break b{font-weight:var(--ds-fw-medium,500);font-variant-numeric:tabular-nums;color:var(--ou-text1)}
.ou-section{margin:0 0 16px;padding:16px 18px;border-radius:14px;border:1px solid var(--ou-line);background:var(--ou-card)}
.ou-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.ou-section-title{margin:0;font-size:var(--ds-fs-15,15px);font-weight:var(--ds-fw-medium,500)}
.ou-hint{margin:0;color:var(--ou-text3);font-size:var(--ds-fs-12,12px);line-height:1.65}
.ou-hint+.ou-hint{margin-top:6px}
.ou-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--ou-line);padding-bottom:8px}
.ou-tabs-sync{margin-left:auto}
.ou-tab{border:none;background:transparent;color:var(--ou-text2);padding:7px 14px;border-radius:9px;font:inherit;font-size:var(--ds-fs-13,13px);cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.ou-tab:hover{color:var(--ou-text1);background:var(--ou-hover)}
.ou-tab[aria-pressed="true"]{background:var(--ds-surface-3,#141C28);color:var(--ou-text1)}
.ou-tab small{color:var(--ou-text3);font-size:var(--ds-fs-11,11px);font-variant-numeric:tabular-nums}
.ou-chart{display:flex;align-items:flex-end;gap:3px;height:120px;padding-top:6px}
.ou-bar{flex:1;min-width:3px;border-radius:3px 3px 1px 1px;background:var(--ds-line-glow,rgba(77,107,254,.38));min-height:2px;transition:background .15s}
.ou-bar:hover{background:var(--ou-brand)}
.ou-bar.ds{background:rgba(61,220,151,.45)}
.ou-bar.oa{background:rgba(242,184,92,.5)}
.ou-bar-stack{display:flex;flex-direction:column;overflow:hidden;background:transparent}
.ou-bar-stack>span{display:block;min-height:0}
.ou-seg-peak{background:rgba(242,184,92,.62)}
.ou-seg-off{background:rgba(61,220,151,.58)}
.ou-bar-stack:hover .ou-seg-peak{background:rgba(242,184,92,.85)}
.ou-bar-stack:hover .ou-seg-off{background:rgba(61,220,151,.8)}
.ou-dual{position:relative;height:120px;margin-top:6px}
.ou-dual-bars{position:absolute;inset:0;display:flex;align-items:flex-end;gap:3px}
.ou-dual-bars .ou-bar{flex:1;min-width:2px;border-radius:3px 3px 1px 1px;min-height:2px}
.ou-dual-bars .ou-bar.oa{background:rgba(242,184,92,.5)}
.ou-bar-stack{display:flex;flex-direction:column;overflow:hidden;background:transparent}
.ou-bar-stack>span{display:block;min-height:0}
.ou-seg-peak{background:rgba(242,184,92,.62)}
.ou-seg-off{background:rgba(61,220,151,.58)}
.ou-bar-stack:hover .ou-seg-peak{background:rgba(242,184,92,.85)}
.ou-bar-stack:hover .ou-seg-off{background:rgba(61,220,151,.8)}
.ou-dual-bars .ou-bar.oa:hover{background:rgba(242,184,92,.8)}
.ou-dual-line{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.ou-dot-cost{background:rgba(242,184,92,.8)}
.ou-dot-token{background:rgba(107,140,255,.85)}
.ou-split{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:10px 0;background:var(--ou-line)}
.ou-split span{display:block;min-width:2px}
.ou-split-off{background:rgba(61,220,151,.6)}
.ou-split-peak{background:rgba(242,184,92,.6)}
.ou-split-legend{display:flex;gap:18px;flex-wrap:wrap;margin:0;color:var(--ou-text2);font-size:var(--ds-fs-12,12px)}
.ou-split-legend span{display:inline-flex;align-items:center;gap:6px}
.ou-dot-off,.ou-dot-peak{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.ou-dot-off{background:rgba(61,220,151,.8)}
.ou-dot-peak{background:rgba(242,184,92,.8)}
.ou-dot-bar{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none;background:rgba(77,107,254,.6)}
.ou-dot-bar.ds{background:rgba(61,220,151,.7)}
.ou-sub-title{margin:14px 0 6px;color:var(--ou-text3);font-size:var(--ds-fs-12,12px)}
.ou-axis{display:flex;justify-content:space-between;margin-top:6px;color:var(--ou-text3);font-size:var(--ds-fs-11,11px)}
.ou-models{width:100%;border-collapse:collapse;font-size:var(--ds-fs-13,13px)}
.ou-models th{text-align:right;padding:6px 8px;color:var(--ou-text3);font-weight:400;border-bottom:1px solid var(--ou-line);white-space:nowrap}
.ou-models th:first-child{text-align:left}
.ou-models td{text-align:right;padding:7px 8px;border-bottom:1px solid var(--ou-line);font-variant-numeric:tabular-nums}
.ou-models td:first-child{text-align:left;font-family:var(--ou-mono);font-size:var(--ds-fs-12,12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
.ou-models tr:last-child td{border-bottom:none}
.ou-form{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.ou-input{box-sizing:border-box;width:140px;padding:7px 12px;border-radius:10px;border:1px solid var(--ou-line);background:rgba(6,10,17,.5);color:var(--ou-text1);font:inherit;font-size:var(--ds-fs-13,13px)}
.ou-input:focus{outline:none;border-color:var(--ds-line-glow,rgba(77,107,254,.38))}
.ou-status{display:inline-flex;align-items:center;gap:6px;color:var(--ou-text2);font-size:var(--ds-fs-12,12px)}
.ou-dot{width:7px;height:7px;border-radius:50%;background:var(--ou-ok);flex:none}
.ou-dot.warn{background:var(--ou-warn)}
.ou-dot.error{background:var(--ou-err)}
.ou-empty{margin:0;color:var(--ou-text3);padding:24px 0;text-align:center}
.ou-foot{margin:18px 0 0;color:var(--ou-text3);font-size:var(--ds-fs-12,12px);line-height:1.7}
.ou-foot code{font-family:var(--ou-mono);font-size:var(--ds-fs-11,11px);color:var(--ou-text2);word-break:break-all}
.ou-foot-entry{display:grid;grid-template-columns:16px max-content max-content 1fr;align-items:center;column-gap:8px;row-gap:4px;width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ou-text2);font:inherit;cursor:pointer;text-align:left}
.ou-foot-entry:hover{background:var(--ou-hover)}
.ou-foot-entry:focus-visible{outline:none;border-color:var(--ds-line-glow,rgba(77,107,254,.38))}
.ou-foot-rows{display:contents}
.ou-foot-row{display:contents}
.ou-foot-logo{display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;color:var(--ou-text3)}
.ou-foot-logo.oa{color:#10A37F}
.ou-foot-logo.ds{color:#6B8CFF}
.ou-foot-logo.volc{color:#529bf5}
.ou-foot-row-provider{color:var(--ou-text2);white-space:nowrap;font-size:var(--ds-fs-14,14px);line-height:1.3}
.ou-foot-row-suffix{color:var(--ou-text3);white-space:nowrap;font-size:var(--ds-fs-12,12px);line-height:1.3}
.ou-foot-row-value{color:var(--ou-text1);font-weight:var(--ds-fw-medium,500);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;font-size:var(--ds-fs-14,14px);line-height:1.3}
.ou-foot-icon{display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center}
.ou-foot-entry.ou-rail{display:flex;width:36px;height:36px;min-height:36px;padding:0;justify-content:center;margin:0 auto}
.ou-foot-entry.ou-rail .ou-foot-rows{display:none}
@media(min-width:601px){body:has(.ou-foot-entry:not(.ou-rail)) .cosmos-controls{bottom:160px}}
.ou-card-actions{margin-top:auto;padding-top:2px}
.ou-balance-card{display:flex;flex-direction:column}
.ou-balances{padding:0}
.ou-balance-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 18px;border-bottom:1px solid var(--ou-line);flex-wrap:wrap}
.ou-balance-row:last-child{border-bottom:none}
.ou-balance-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 240px}
.ou-balance-name{display:flex;align-items:center;gap:8px;color:var(--ou-text2);font-size:var(--ds-fs-13,13px);font-weight:500}
.ou-balance-value{color:var(--ou-text1);font-size:var(--ds-fs-24,24px);font-weight:var(--ds-fw-semi,600);font-variant-numeric:tabular-nums;line-height:1.2}
.ou-balance-meta{color:var(--ou-text3);font-size:var(--ds-fs-12,12px);line-height:1.6}
.ou-balance-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
`;
const iconRefresh=h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round','aria-hidden':true},h('path',{d:'M20 11a8 8 0 1 0-2.3 6.1'}),h('path',{d:'M20 4v7h-7'}));
const iconCoins=h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round','aria-hidden':true},h('ellipse',{cx:12,cy:6.5,rx:7,ry:3}),h('path',{d:'M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5'}),h('path',{d:'M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5'}));
const iconOpenAI=h('svg',{width:18,height:18,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor',strokeWidth:1.2,'aria-hidden':true},
  h('g',{transform:'rotate(15 8 8)'},...[0,60,120].map(deg=>h('ellipse',{key:deg,cx:8,cy:8,rx:4.7,ry:2.1,transform:'rotate('+deg+' 8 8)'}))));
const iconDeepSeek=h('svg',{width:16,height:16,viewBox:'0 0 16 16','aria-hidden':true},
  h('path',{d:'M2.6 9.7c0-2.7 2.5-4.7 5.4-4.7 2.1 0 3.9 1.1 4.7 2.7l1.7-.7-1 2.5c-.2.6-.9.9-1.5.6l-1-.5c-.7 1.3-2.1 2.1-3.8 2.1H4c-.8 0-1.4-.6-1.4-1.4z',fill:'currentColor'}),
  h('circle',{cx:10.6,cy:7.5,r:.75,fill:'var(--ou-card,#0B1220)'}));
const iconVolcano=h('svg',{width:16,height:16,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor',strokeWidth:1.4,strokeLinejoin:'round',strokeLinecap:'round','aria-hidden':true},
  h('path',{d:'M1.9 13.3h12.2L10.5 7.1 8.9 9 7.1 9 5.5 7.1z'}),
  h('path',{d:'M6.1 5.5C6.5 4.6 7.2 4.1 8 4.1s1.5.5 1.9 1.4'}));
function emptyCounters(){const out={};for(const key of BUCKETS)out[key]=0;return out}
function addCounters(target,source){if(!source)return target;for(const key of BUCKETS)target[key]=(target[key]||0)+(source[key]||0);return target}
function sumCounters(...list){const out=emptyCounters();for(const item of list)addCounters(out,item);return out}
function totalOf(c){return (c?.input||0)+(c?.output||0)+(c?.cached||0)+(c?.cacheWrite||0)}
function fmtTokens(n){n=Number(n)||0;if(n>=1e6)return (n/1e6).toFixed(n>=1e7?0:1)+'M';if(n>=1e3)return (n/1e3).toFixed(n>=1e4?0:1)+'K';return String(n)}
function fmtUsd(n){return '$'+(Number(n)||0).toFixed(2)}
function fmtWallet(wallet){const symbol=wallet.currency==='USD'?'$':'¥';const value=Number(wallet.balance);if(!Number.isFinite(value))return symbol+'—';return symbol+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtTime(iso){if(!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';const pad=v=>String(v).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())}
function dayKeyOf(iso){const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';const pad=v=>String(v).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function openaiSince(data,capturedAt){
  const family=data&&data.families&&data.families.openai;const since=dayKeyOf(capturedAt||'');
  if(!family||!since)return null;
  const days=family.days||[];
  if(days.length===0)return {total:emptyCounters()};
  if(days[0].date>since)return {stale:true};
  const total=emptyCounters();
  for(const day of days)if(day.date>=since)addCounters(total,day);
  return {total};
}
async function call(path,body){const options={credentials:'same-origin'};if(body!==undefined)Object.assign(options,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const response=await fetch(new URL('api/openai-usage/'+path,document.baseURI),options);let result;try{result=await response.json();}catch{throw Error('服务器响应无法解析');}if(!response.ok)throw Error(result?.error||'请求失败');return result}
function accountMetadata(){const version=(window.__DSH_BOOT__&&window.__DSH_BOOT__.release&&window.__DSH_BOOT__.release.version)||'0.0.0';const lang=String(navigator.language||'zh').toLowerCase();return {version,locale:lang.startsWith('zh')?'zh_CN':'en_US',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60}}
function normalizeBalanceResult(result){
  if(!result)return {status:'failed',error:'账户服务无响应'};
  if(result.ok!==true)return {status:'failed',error:'账户余额读取失败'};
  const value=result.value;
  if(value===null||value===undefined)return {status:'signed-out'};
  if(value.status!=='ready')return {status:'failed',error:'余额暂不可用'};
  return {status:'ready',wallets:value.value||[],bonus:value.bonusWallets||[],fetchedAt:new Date().toISOString()};
}
function createAccountLoader(ctx){
  let cache=null,at=0;
  return async function loadAccount(force){
    if(!force&&cache&&Date.now()-at<45000)return cache;
    try{
      const api=ctx.remote&&ctx.remote.account;
      if(!api||typeof api.getBalance!=='function')return {status:'unavailable'};
      const result=await api.getBalance(accountMetadata());
      cache=normalizeBalanceResult(result);at=Date.now();return cache;
    }catch(error){return {status:'failed',error:error instanceof Error?error.message:String(error)}}
  };
}
function primaryWallet(wallets){if(!Array.isArray(wallets)||wallets.length===0)return null;return wallets.find(w=>w.currency==='CNY')||wallets[0]}
function useSummary(intervalMs){const [data,setData]=R.useState(null);R.useEffect(()=>{let alive=true;const load=async()=>{try{const next=await call('summary');if(alive)setData(next)}catch{}};const onUpdate=()=>load();load();const timer=setInterval(load,intervalMs||30000);window.addEventListener('openai-usage:updated',onUpdate);return()=>{alive=false;clearInterval(timer);window.removeEventListener('openai-usage:updated',onUpdate)}},[intervalMs]);return data}
function useVolcOverview(){
  const [data,setData]=R.useState(null);
  R.useEffect(()=>{
    let alive=true;
    let generation=0;
    const load=async()=>{
      const requested=++generation;
      try{
        const next=await call('volcengine');
        if(alive&&requested===generation)setData(next);
      }catch{
        if(alive&&requested===generation)setData({status:'unavailable'});
      }
    };
    load();
    const timer=setInterval(load,60000);
    window.addEventListener('openai-usage:volcengine-updated',load);
    return ()=>{
      alive=false;
      clearInterval(timer);
      window.removeEventListener('openai-usage:volcengine-updated',load);
    };
  },[]);
  return data;
}
function useAccount(loadAccount,intervalMs){const [state,setState]=R.useState({status:'loading'});R.useEffect(()=>{let alive=true;const load=async(force)=>{if(!loadAccount){if(alive)setState({status:'unavailable'});return}try{const next=await loadAccount(force);if(alive)setState(next)}catch(error){if(alive)setState({status:'failed',error:String(error&&error.message||error)})}};load(false);const timer=setInterval(()=>load(false),intervalMs||60000);return()=>{alive=false;clearInterval(timer)}},[loadAccount,intervalMs]);return state}
function Breakdown({counters}){const c=counters||{};const items=[['输入',c.input],['输出',c.output],['缓存读',c.cached],['缓存写',c.cacheWrite],['请求',c.requests]];return h('p',{className:'ou-break'},...items.map(([label,value])=>h('span',{key:label},label,h('b',null,fmtTokens(value)))))}
function Card(props){return h('div',{className:'ou-card'},h('p',{className:'ou-card-label'},props.label),h('p',{className:'ou-card-value'},props.value,props.unit?h('span',{className:'ou-card-unit'},props.unit):null),props.counters?h(Breakdown,{counters:props.counters}):null,props.sub?h('p',{className:'ou-card-sub'},props.sub):null)}
function DailyChart({days,className}){const list=days||[];const values=list.map(d=>totalOf(d));const requests=list.map(d=>Number(d.requests)||0);const max=Math.max(1,...values);const maxRequests=Math.max(1,...requests);const first=list.length?list[0].date.slice(5):'';const last=list.length?list[list.length-1].date.slice(5):'';const count=list.length||1;const points=requests.map((value,index)=>((index+0.5)/count*100).toFixed(2)+','+(96-(value/maxRequests)*82).toFixed(2)).join(' ');const hasBands=list.some(d=>d&&d.bands&&(totalOf(d.bands.offpeak)+totalOf(d.bands.peak))>0);const bars=list.map((d,i)=>{const style=values[i]>0?{height:Math.max(2,Math.round(values[i]/max*100))+'%'}:{height:0,minHeight:0};if(!hasBands)return h('div',{key:d.date,className:'ou-bar '+(className||''),style,title:d.date+'：'+fmtTokens(values[i])+' tokens · '+fmtTokens(requests[i])+' 请求'});const off=totalOf(d.bands?.offpeak);const peak=totalOf(d.bands?.peak);return h('div',{key:d.date,className:'ou-bar ou-bar-stack',style,title:d.date+'：谷时 '+fmtTokens(off)+' · 峰时 '+fmtTokens(peak)+' tokens · '+fmtTokens(requests[i])+' 请求'},h('span',{className:'ou-seg-peak',style:{flex:String(peak)}}),h('span',{className:'ou-seg-off',style:{flex:String(off)}}));});const legend=hasBands?h('p',{className:'ou-split-legend'},h('span',null,h('i',{className:'ou-dot-off'}),'柱：谷时 tokens'),h('span',null,h('i',{className:'ou-dot-peak'}),'柱：峰时 tokens'),h('span',null,h('i',{className:'ou-dot-token'}),'线：每日请求')):h('p',{className:'ou-split-legend'},h('span',null,h('i',{className:'ou-dot-bar '+(className||'')}),'柱：每日 tokens'),h('span',null,h('i',{className:'ou-dot-token'}),'线：每日请求'));return h('div',null,h('div',{className:'ou-dual'},h('div',{className:'ou-dual-bars'},...bars),h('svg',{className:'ou-dual-line',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':true},h('polyline',{points,fill:'none',stroke:'rgba(107,140,255,.85)',strokeWidth:1.5,vectorEffect:'non-scaling-stroke'}))),h('div',{className:'ou-axis'},h('span',null,first),h('span',null,last)),legend)}function OfficialDailyChart({costDays,usageDays}){
  const usage=new Map((usageDays||[]).map(day=>[day.date,day]));
  const days=(costDays||[]).filter(day=>typeof day.costUsd==='number');
  if(days.length===0)return h('p',{className:'ou-hint'},'点「重新同步」后显示本月每日花费曲线。');
  const costs=days.map(day=>day.costUsd||0);
  const tokens=days.map(day=>{const row=usage.get(day.date);return (row?.inputTokens||0)+(row?.outputTokens||0)});
  const maxCost=Math.max(1e-9,...costs);
  const maxToken=Math.max(1,...tokens);
  const count=days.length;
  const points=tokens.map((value,index)=>((index+0.5)/count*100).toFixed(2)+','+(96-(value/maxToken)*82).toFixed(2)).join(' ');
  return h('div',null,
    h('div',{className:'ou-dual'},
      h('div',{className:'ou-dual-bars'},...days.map((day,index)=>h('div',{key:day.date,className:'ou-bar oa',style:costs[index]>0?{height:Math.max(2,Math.round(costs[index]/maxCost*100))+'%'}:{height:0,minHeight:0},title:day.date+'：'+fmtUsd(costs[index])+' · '+fmtTokens(tokens[index])+' tokens'}))),
      h('svg',{className:'ou-dual-line',viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':true},h('polyline',{points,fill:'none',stroke:'rgba(107,140,255,.85)',strokeWidth:1.5,vectorEffect:'non-scaling-stroke'}))),
    h('div',{className:'ou-axis'},h('span',null,days[0].date.slice(5)),h('span',null,days[count-1].date.slice(5))),
    h('p',{className:'ou-split-legend'},h('span',null,h('i',{className:'ou-dot-cost'}),'柱：每日花费（$）'),h('span',null,h('i',{className:'ou-dot-token'}),'线：每日 tokens（输入+输出）')));
}function mergedDays(families){const base=(families[0]&&families[0].days)||[];return base.map((row,index)=>{const merged={date:row.date,...emptyCounters()};for(const family of families)addCounters(merged,family.days[index]);return merged})}
function viewFor(summary,tab){
  if(!summary)return null;
  const families=[summary.families.deepseek,summary.families.openai,summary.families.other];
  if(tab==='deepseek')return summary.families.deepseek;
  if(tab==='openai')return summary.families.openai;
  return {
    today:{date:summary.today.date,...sumCounters(...families.map(f=>f.today))},
    last7:sumCounters(...families.map(f=>f.last7)),
    last30:sumCounters(...families.map(f=>f.last30)),
    allTime:sumCounters(...families.map(f=>f.allTime)),
    days:mergedDays(families),
    models:[...families.flatMap(f=>f.models)].sort((a,b)=>(b.input+b.output)-(a.input+a.output)),
  };
}
function FooterAction(props){
  const summary=useSummary(30000),account=useAccount(props.loadAccount,60000);
  const volc=useVolcOverview();
  const wallet=primaryWallet(account.wallets);
  const dsText=account.status==='ready'&&wallet?fmtWallet(wallet):null;
  const oaText=summary&&summary.balanceEstimate?fmtUsd(summary.balanceEstimate.amountUsd):null;
  const parts=[];
  if(oaText)parts.push('OpenAI 估算余额 '+oaText+(summary.balanceEstimate.error?'（同步失败）':''));
  if(dsText)parts.push('DeepSeek 余额 '+dsText);
  const volcText=volc?.balance?.value==null?null:fmtWallet({currency:'CNY',balance:volc.balance.value});
  if(volcText)parts.push('火山引擎余额 '+volcText);
  const rows=[
    {provider:'OpenAI',cls:'oa',logo:iconOpenAI,value:oaText||'—',suffix:summary?.balanceEstimate?.error?'估算!':'估算'},
    {provider:'DeepSeek',cls:'ds',logo:iconDeepSeek,value:dsText||'—'},
    {provider:'火山引擎',cls:'volc',logo:iconVolcano,value:volcText||'—'},
  ];
  const wide=props.wide!==false;
  return h('button',{type:'button',className:'ou-foot-entry'+(wide?'':' ou-rail'),title:'余额'+(parts.length?'：'+parts.join('，'):''),'aria-label':'AI 余额',onClick:()=>{try{props.open&&props.open()}catch{}}},
    h('span',{className:'ou-foot-rows'},...rows.map(row=>h('span',{key:row.provider,className:'ou-foot-row'},
      h('span',{className:'ou-foot-logo '+row.cls,'aria-hidden':true},row.logo),
      h('span',{className:'ou-foot-row-provider'},row.provider),
      h('span',{className:'ou-foot-row-suffix'},row.suffix||'余额'),
      h('span',{className:'ou-foot-row-value'},row.value)))),
    wide?null:h('span',{className:'ou-foot-icon','aria-hidden':true},iconCoins));
}
function VolcUsage({data,refresh,saveIam,busy}){
  const [accessKey,setAccessKey]=R.useState('');
  const [secretKey,setSecretKey]=R.useState('');
  const ark=data?.ark;
  const media=data?.media;
  const usage=ark?.value;
  const configured=data?.status==='configured';
  const failed=Boolean(ark?.error||media?.error);
  const state=!data?'warn':configured?(failed?'error':'ok'):data.status==='unconfigured'?'warn':'error';
  const stateText=!data?'读取中':configured?(failed?'部分同步失败':'已同步'):data.status==='unconfigured'?'未配置':'读取失败';
  async function save(){
    if(await saveIam({accessKey,secretKey})){
      setAccessKey('');
      setSecretKey('');
    }
  }
  const days=usage?.days||[];
  const dayKey=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()-offset*86400000));
  const sumSince=cutoff=>days.reduce((acc,day)=>day.date>=cutoff?{input:acc.input+(day.input||0),output:acc.output+(day.output||0),requests:acc.requests+(day.requests||0)}:acc,{input:0,output:0,requests:0});
  const todayRow=days.find(day=>day.date===dayKey(0))||{input:0,output:0,requests:0};
  const dayMap=new Map(days.map(day=>[day.date,day]));
  const chartDays=Array.from({length:30},(_,index)=>{const date=dayKey(29-index);const row=dayMap.get(date);return {date,input:row?.input||0,output:row?.output||0,requests:row?.requests||0,cached:0,cacheWrite:0};});
  const withCache=c=>({input:c.input||0,output:c.output||0,cached:0,cacheWrite:0,requests:c.requests||0});
  const card=(label,c,sub)=>h(Card,{label,value:fmtTokens((c.input||0)+(c.output||0)),unit:'tokens',counters:withCache(c),sub});
  const cards=usage?h('div',{className:'ou-cards ou-cards-4'},
    card('今日',todayRow),
    card('近 7 天',sumSince(dayKey(6))),
    card('近 30 天',sumSince(dayKey(29))),
    card('累计（官方）',{input:usage.input,output:usage.output,requests:usage.requests},data.period)):null;
  const daily=usage?h('section',{className:'ou-section'},
    h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'每日用量（近 30 天）'),h('span',{className:'ou-hint'},'悬停柱状条查看当天 tokens 与请求')),
    h(DailyChart,{days:chartDays})):null;
  const models=usage&&usage.models.length?h('section',{className:'ou-section'},
    h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'按模型（近 30 天）')),
    h('table',{className:'ou-models'},
      h('thead',null,h('tr',null,...['模型','请求','输入','输出','缓存读'].map(label=>h('th',{key:label},label)))),
      h('tbody',null,...usage.models.map(row=>h('tr',{key:row.model},
        h('td',null,row.model),h('td',null,fmtTokens(row.requests)),
        h('td',null,fmtTokens(row.input)),h('td',null,fmtTokens(row.output)),h('td',null,'0')))))):null;

  const billsTable=media&&Array.isArray(media.value)&&media.value.length?h('table',{className:'ou-models'},
    h('thead',null,h('tr',null,...['服务 / 计费项','用量','应付金额'].map(label=>h('th',{key:label},label)))),
    h('tbody',null,...media.value.map(row=>h('tr',{key:JSON.stringify([row.product,row.meter,row.unit,row.currency])},
      h('td',null,row.product+' / '+row.meter),
      h('td',null,row.quantity==null?'—':row.quantity.toLocaleString('zh-CN',{maximumFractionDigits:6})+' '+row.unit),
      h('td',null,row.amount==null?'—':row.amount.toLocaleString('zh-CN',{style:'currency',currency:row.currency,maximumFractionDigits:6})))))):null;
  const configuredBody=h(R.Fragment,null,
    h('p',{className:'ou-hint'},'本月 tokens：'+fmtTokens((usage?.input||0)+(usage?.output||0))+'；本月请求：'+fmtTokens(usage?.requests||0)+'；上次同步：'+fmtTime(ark?.syncedAt)),
    ark?.error?h('p',{className:'ou-alert'},'方舟用量同步失败：'+ark.error):null,

    media?.error?h('p',{className:'ou-alert'},'账单同步失败：'+media.error):null,
    h('p',{className:'ou-sub-title'},'豆包语音和 AI MediaKit 账单（费用中心已出账）'),
    media?.value?h('p',{className:'ou-hint'},'本月已出账数据 · 更新于 '+fmtTime(media.syncedAt)):h('p',{className:'ou-hint'},'读取中…'),
    billsTable,
    media&&Array.isArray(media.value)&&media.value.length===0?h('p',{className:'ou-hint'},'本月暂无匹配的豆包语音或 AI MediaKit 账单明细。'):null,
    h('div',{className:'ou-form'},
      h('button',{className:'ou-btn',disabled:busy,onClick:refresh},iconRefresh,'重新同步'),
      h('button',{className:'ou-btn',disabled:busy,onClick:()=>saveIam({clear:true})},'清除凭据')),
    h('p',{className:'ou-hint'},'凭据名：VOLCENGINE_USAGE_IAM（只读 IAM，保存在 DSH 凭据库）。'));
  const unconfiguredBody=h(R.Fragment,null,
    h('p',{className:'ou-hint'},'还没有可用的火山 IAM 只读凭据。使用有权查询 billing:QueryBalanceAcct、billing:ListBillDetail 和 ark:GetInferenceUsage 的只读 IAM 密钥，保存后可查看官方余额、账单和方舟用量。'),
    h('div',{className:'ou-form'},
      h('input',{className:'ou-input',style:{width:'170px'},type:'password',autoComplete:'off',placeholder:'Access Key ID',value:accessKey,disabled:busy,'aria-label':'火山 Access Key ID',onChange:e=>setAccessKey(e.target.value)}),
      h('input',{className:'ou-input',style:{width:'170px'},type:'password',autoComplete:'off',placeholder:'Secret Access Key',value:secretKey,disabled:busy,'aria-label':'火山 Secret Access Key',onChange:e=>setSecretKey(e.target.value)}),
      h('button',{className:'ou-primary',disabled:busy||!accessKey.trim()||!secretKey.trim(),onClick:save},'保存并同步')));
  const official=h('section',{className:'ou-section','data-ou-volc-usage':''},
    h('div',{className:'ou-section-head'},
      h('h2',{className:'ou-section-title'},'火山引擎官方数据（IAM，可选）'),
      h('span',{className:'ou-status'},h('span',{className:'ou-dot '+state}),stateText)),
    configured?configuredBody:unconfiguredBody);
  return h(R.Fragment,null,cards,daily,models,official);
}
function PanelView(props){
  const [tab,setTab]=R.useState('all');
  const [data,setData]=R.useState(null),[account,setAccount]=R.useState({status:'loading'});
  const [busy,setBusy]=R.useState(false),[error,setError]=R.useState(''),[notice,setNotice]=R.useState('');
  const [amount,setAmount]=R.useState(''),[adminKey,setAdminKey]=R.useState('');
  const volc=useVolcOverview();
  const lock=R.useRef(false);
  async function syncVolc(body){
    if(lock.current)return false;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      await call(body?'volcengine-iam':'volcengine-refresh',body||{});
      window.dispatchEvent(new Event('openai-usage:volcengine-updated'));
      return true;
    }catch(e){setError('火山引擎 · '+e.message);return false}
    finally{lock.current=false;setBusy(false)}
  }
  async function reload(silent,forceAccount){
    if(lock.current)return;
    lock.current=true;if(!silent)setBusy(true);if(!silent)setError('');
    try{
      const [nextData,nextAccount]=await Promise.all([
        forceAccount?call('refresh-admin',{}):call('summary'),
        props.loadAccount(forceAccount),
        forceAccount?call('volcengine-refresh',{}).catch(()=>null):null,
      ]);
      setData(nextData);setAccount(nextAccount);
      if(forceAccount){window.dispatchEvent(new Event('openai-usage:volcengine-updated'));window.dispatchEvent(new Event('openai-usage:updated'))}
    }catch(e){setError('刷新失败：'+e.message)}
    finally{lock.current=false;if(!silent)setBusy(false)}
  }
  R.useEffect(()=>{reload(true,false);const timer=setInterval(()=>reload(true,false),60000);return()=>clearInterval(timer)},[]);
  async function saveBalance(clear){
    if(lock.current)return;
    const value=clear?null:Number(amount);
    if(!clear&&(!amount.trim()||!Number.isFinite(value)||value<0)){setError('请填写不小于 0 的余额数字');return}
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{setData(await call('balance',{amountUsd:value}));setNotice(clear?'OpenAI 余额记录已清除。':'已记录当前余额和花费基准，后续自动估算。');setAmount('');window.dispatchEvent(new Event('openai-usage:updated'))}
    catch(e){setError('保存失败：'+e.message)}
    finally{lock.current=false;setBusy(false)}
  }
  async function refreshAdmin(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{const next=await call('refresh-admin',{});setData(next);window.dispatchEvent(new Event('openai-usage:updated'));const problem=next.balanceEstimate?.error||next.admin?.error;if(problem)setError('OpenAI 同步失败：'+problem);else setNotice('已同步 OpenAI 官方花费。')}
    catch(e){setError('刷新失败：'+e.message)}
    finally{lock.current=false;setBusy(false)}
  }
  async function saveAdminKey(clear){
    if(lock.current)return;
    const value=adminKey.trim();
    if(!clear&&value.length<8){setError('请粘贴完整的 Admin key');return}
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{const next=await call('admin-key',clear?{clear:true}:{apiKey:value});setData(next);window.dispatchEvent(new Event('openai-usage:updated'));setAdminKey('');if(!clear&&next.admin?.error)setError('凭据已保存，但官方同步失败：'+next.admin.error);else setNotice(clear?'已清除保存的 Admin key；请重新配置并录入余额。':'凭据已保存；请重新录入当前余额以建立花费基准。')}
    catch(e){setError('保存失败：'+e.message)}
    finally{lock.current=false;setBusy(false)}
  }
  const view=tab==='volcengine'?null:viewFor(data,tab);
  const wallet=primaryWallet(account.wallets);
  const bonus=account.status==='ready'&&Array.isArray(account.bonus)?account.bonus.filter(w=>Number(w.balance)>0):[];
  const keyInfo=data&&data.adminKeyInfo?data.adminKeyInfo:null;
  const admin=data&&data.admin?data.admin:null;
  const adminState=keyInfo?(keyInfo.configured?(admin&&admin.error?'error':'ok'):'warn'):'warn';
  const costDays=admin&&Array.isArray(admin.costDays)?admin.costDays:[];
  const usageDays=admin&&Array.isArray(admin.usageDays)?admin.usageDays:[];
  const officialChart=h(OfficialDailyChart,{costDays,usageDays});

  const officialModels=admin&&Array.isArray(admin.models)?admin.models:[];
  const officialTable=officialModels.length?h('table',{className:'ou-models'},
    h('thead',null,h('tr',null,h('th',null,'模型'),h('th',null,'请求'),h('th',null,'输入'),h('th',null,'输出'),h('th',null,'缓存读'))),
    h('tbody',null,...officialModels.map(row=>h('tr',{key:row.model},
      h('td',{title:row.model},row.model),
      h('td',null,fmtTokens(row.requests)),
      h('td',null,fmtTokens(Math.max(0,(row.inputTokens||0)-(row.cachedTokens||0)))),
      h('td',null,fmtTokens(row.outputTokens)),
      h('td',null,fmtTokens(row.cachedTokens)))))):null;
  const adminSection=data?h('section',{className:'ou-section'},
    h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'OpenAI 账户级数据（Admin key，可选）'),
      h('span',{className:'ou-status'},h('span',{className:'ou-dot '+(adminState==='ok'?'':adminState==='error'?'error':'warn')}),adminState==='ok'?'已配置':adminState==='error'?'同步失败':'未配置')),
    keyInfo&&keyInfo.configured?h(R.Fragment,null,
      admin&&admin.error?h('p',{className:'ou-alert'},'Admin API 错误：'+admin.error):null,
      admin?h('p',{className:'ou-hint'},'本月花费：'+((admin.monthCostUsd===null)?'—':fmtUsd(admin.monthCostUsd))+'；本月 tokens：'+fmtTokens((admin.monthInputTokens||0)+(admin.monthOutputTokens||0))+'；本月请求：'+fmtTokens(admin.monthRequests)+'；上次同步：'+fmtTime(admin.lastSync)):h('p',{className:'ou-hint'},'还没有同步到官方数据。'),
      h('p',{className:'ou-sub-title'},'本月每日花费与 tokens（官方；柱=花费，线=tokens）'),
      officialChart,
      officialTable?h(R.Fragment,null,h('p',{className:'ou-sub-title'},'本月按模型（官方）'),officialTable):null,
      h('div',{className:'ou-form'},h('button',{className:'ou-btn',disabled:busy,onClick:refreshAdmin},iconRefresh,'重新同步'),h('button',{className:'ou-btn',disabled:busy,onClick:()=>saveAdminKey(true)},'清除凭据')))
      :h(R.Fragment,null,
        h('p',{className:'ou-hint'},'没有 Admin key 时只能看本机统计。想显示账户级官方花费与 tokens，可在 OpenAI 设置里创建只读 Admin key（组织 Owner 才能创建），粘贴到这里；key 存在 DSH 凭据库，不写进配置或日志。'),
        h('div',{className:'ou-form'},h('input',{className:'ou-input',style:{width:'220px'},type:'password',autoComplete:'off',placeholder:'sk-admin-…',value:adminKey,disabled:busy,'aria-label':'OpenAI Admin key',onChange:e=>setAdminKey(e.target.value)}),h('button',{className:'ou-primary',disabled:busy,onClick:()=>saveAdminKey(false)},'保存并同步'))),
    h('p',{className:'ou-hint'},'凭据名：'+(data.adminKeyName||'OPENAI_ADMIN_API_KEY')+(()=>{const m=keyInfo&&keyInfo.masked;return m?('（'+(m.length>14?m.slice(0,8)+'…'+m.slice(-4):m)+'）'):''})()+(keyInfo&&keyInfo.source?'；来源：'+keyInfo.source:''))):null;
  const deepseekCard=h('div',{className:'ou-card ou-balance-card'},
    h('p',{className:'ou-card-label'},'DeepSeek 余额（官方）',h('span',{className:'ou-status'},h('span',{className:'ou-dot '+(account.status==='ready'?'':account.status==='loading'?'warn':'error')}),account.status==='ready'?'已同步':account.status==='signed-out'?'未登录':account.status==='loading'?'读取中':'不可用')),
    account.status==='ready'&&wallet?h(R.Fragment,null,
      h('p',{className:'ou-card-value'},fmtWallet(wallet)),
      h('p',{className:'ou-card-sub'},'充值余额'+(bonus.length?'；赠送：'+bonus.map(w=>fmtWallet(w)).join(' / '):'')+(account.fetchedAt?'；更新于 '+fmtTime(account.fetchedAt):'')),
      h('p',{className:'ou-card-sub'},'来自 DSH 账户服务的官方钱包，未登录时不可用。'),
      h('div',{className:'ou-form ou-card-actions'},h('a',{className:'ou-btn',href:'https://platform.deepseek.com/usage',target:'_blank',rel:'noreferrer'},'打开 DeepSeek 用量页')))
      :h(R.Fragment,null,
        h('p',{className:'ou-card-value'},'—'),
        h('p',{className:'ou-card-sub'},account.status==='signed-out'?'未登录 DeepSeek 账号，登录后在这里显示官方余额。':account.status==='failed'?('读取失败：'+(account.error||'未知错误')):account.status==='unavailable'?'当前环境没有账户服务。':'读取中…')));
  const estimate=data&&data.balanceEstimate;
  const openaiCard=h('div',{className:'ou-card ou-balance-card'},
    h('p',{className:'ou-card-label'},'OpenAI 估算余额',h('span',{className:'ou-status'},h('span',{className:'ou-dot '+(estimate&&!estimate.error?'':'warn')}),estimate?(estimate.error?'同步失败':'按官方花费估算'):'待录入')),
    h('div',{className:'ou-card-value-row'},
      h('p',{className:'ou-card-value'},estimate?fmtUsd(estimate.amountUsd):'—'),
      admin&&admin.monthCostUsd!==null&&admin.monthCostUsd!==undefined?h('span',{className:'ou-card-spend'},'本月花费 ',h('b',null,fmtUsd(admin.monthCostUsd))):null),
    estimate?h('p',{className:'ou-card-sub'},'录入 '+fmtUsd(data.balance.amountUsd)+'（'+fmtTime(data.balance.capturedAt)+'）；此后花费变化 '+fmtUsd(estimate.spentUsd)+'；同步于 '+fmtTime(estimate.lastSync)):h('p',{className:'ou-card-sub'},data&&data.balance?'旧快照缺少花费基准，请重新录入当前余额。':'录入当前余额，之后自动扣除官方花费的增加额。'),
    estimate&&estimate.error?h('p',{className:'ou-card-sub'},'花费同步失败，显示上次估算：'+estimate.error):null,
    h('div',{className:'ou-form'},
      h('input',{className:'ou-input',type:'number',min:'0',step:'0.01',placeholder:'当前余额，例如 200',value:amount,disabled:busy,'aria-label':'OpenAI 当前余额（美元）',onChange:e=>setAmount(e.target.value)}),
      h('button',{className:'ou-primary',disabled:busy,onClick:()=>saveBalance(false)},iconCoins,'记录 / 校准'),
      data&&data.balance?h('button',{className:'ou-btn',disabled:busy,onClick:()=>saveBalance(true)},'清除'):null),
    h('p',{className:'ou-card-sub'},'需在「OpenAI」标签配置 Admin key。账单可能延迟，录入前未出账的费用也可能被扣减；充值、赠金变化或偏差较大时请重新校准。'),
    h('div',{className:'ou-form ou-card-actions'},h('a',{className:'ou-btn',href:'https://platform.openai.com/settings/organization/billing/overview',target:'_blank',rel:'noreferrer'},'打开 OpenAI 账单页')));
  const volcBalance=volc?.balance;
  const volcState=!volc?'warn':volc.status==='configured'?(volc.balance?.error?'error':'ok'):volc.status==='unconfigured'?'warn':'error';
  const volcStateText=!volc?'读取中':volc.status==='configured'?(volc.balance?.error?'同步失败':'已同步'):volc.status==='unconfigured'?'未配置':'读取失败';
  const volcCard=h('div',{className:'ou-card ou-balance-card'},
    h('p',{className:'ou-card-label'},'火山引擎账户可用余额',h('span',{className:'ou-status'},h('span',{className:'ou-dot '+volcState}),volcStateText)),
    h('p',{className:'ou-card-value'},volcBalance?.value==null?'—':fmtWallet({currency:'CNY',balance:volcBalance.value})),
    volcBalance?.syncedAt?h('p',{className:'ou-card-sub'},'更新于 '+fmtTime(volcBalance.syncedAt)):null,
    h('p',{className:'ou-card-sub'},volcBalance?.error||(!volc?'读取中…':volc.status==='unconfigured'?'在「火山引擎」配置 IAM 访问密钥。':volc.status==='credential-error'?'读取火山 IAM 凭据失败。':volc.status==='unavailable'?'火山用量服务暂不可用。':'')),
    h('div',{className:'ou-form ou-card-actions'},
      h('a',{className:'ou-btn',href:'https://console.volcengine.com/finance',target:'_blank',rel:'noreferrer'},'打开火山费用中心')));
  const topSync=tab==='openai'?refreshAdmin:tab==='volcengine'?()=>syncVolc():null;
  const tabs=h('div',{className:'ou-tabs'},...[['all','全部'],['deepseek','DeepSeek'],['openai','OpenAI'],['volcengine','火山引擎']].map(([id,label])=>{
    const family=data&&id!=='volcengine'?viewFor(data,id):null;
    return h('button',{key:id,className:'ou-tab',disabled:busy,'aria-pressed':tab===id,onClick:()=>{if(!lock.current)setTab(id)}},label,family?h('small',null,fmtTokens(totalOf(family.allTime))):null);
  }),topSync?h('button',{className:'ou-btn ou-tabs-sync',disabled:busy,onClick:topSync},iconRefresh,'重新同步'):null);
  const stats=view?h('div',{className:'ou-cards'},
    h(Card,{label:'今日',value:fmtTokens(totalOf(view.today)),unit:'tokens',counters:view.today}),
    h(Card,{label:'近 7 天',value:fmtTokens(totalOf(view.last7)),unit:'tokens',counters:view.last7}),
    h(Card,{label:'近 30 天',value:fmtTokens(totalOf(view.last30)),unit:'tokens',counters:view.last30}),
    h(Card,{label:'累计（本机记录）',value:fmtTokens(totalOf(view.allTime)),unit:'tokens',counters:view.allTime})):h('p',{className:'ou-empty'},'正在读取用量数据…');
  const chart=view?h('section',{className:'ou-section'},h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'每日用量（近 30 天）'),h('span',{className:'ou-hint'},tab==='deepseek'?'DeepSeek 路由':'悬停柱状条查看当天 tokens 与请求')),h(DailyChart,{days:view.days,className:tab==='deepseek'?'ds':''})):null;
  const models=view?h('section',{className:'ou-section'},h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'按模型（近 30 天）')),
    view.models.length?h('table',{className:'ou-models'},h('thead',null,h('tr',null,h('th',null,'模型'),h('th',null,'请求'),h('th',null,'输入'),h('th',null,'输出'),h('th',null,'缓存读'))),h('tbody',null,...view.models.map(model=>h('tr',{key:model.model},h('td',{title:model.model},model.model),h('td',null,fmtTokens(model.requests)),h('td',null,fmtTokens(model.input)),h('td',null,fmtTokens(model.output)),h('td',null,fmtTokens(model.cached))))))
      :h('p',{className:'ou-empty'},'还没有记录到调用。跑一次会话或用一次工具后，这里会出现数据。')):null;
  const bands=data&&data.families&&data.families.deepseek?data.families.deepseek.bands:null;
  const bandOff=bands&&bands.last30?totalOf(bands.last30.offpeak):0;
  const bandPeak=bands&&bands.last30?totalOf(bands.last30.peak):0;
  const bandTotal=bandOff+bandPeak;
  const showBands=Boolean(data)&&(tab==='all'||tab==='deepseek');
  const peakValley=showBands?h('section',{className:'ou-section'},
    h('div',{className:'ou-section-head'},h('h2',{className:'ou-section-title'},'DeepSeek 峰谷用量（近 30 天）'),h('span',{className:'ou-hint'},'谷时 '+(data.offpeakWindow||'00:30-08:30')+'（北京时间）')),
    bandTotal>0?h(R.Fragment,null,
      h('div',{className:'ou-split'},
        h('span',{className:'ou-split-off',style:{flex:String(bandOff||1e-6)}}),
        h('span',{className:'ou-split-peak',style:{flex:String(bandPeak||1e-6)}})),
      h('p',{className:'ou-split-legend'},
        h('span',null,h('i',{className:'ou-dot-off'}),'谷时 '+fmtTokens(bandOff)+' tokens（'+Math.round(bandOff/bandTotal*100)+'%）'),
        h('span',null,h('i',{className:'ou-dot-peak'}),'峰时 '+fmtTokens(bandPeak)+' tokens（'+Math.round(bandPeak/bandTotal*100)+'%）')),
      h('p',{className:'ou-hint'},'按请求完成时间归集；谷时价格更低，具体折扣以 DeepSeek 官方定价为准。'))
      :h('p',{className:'ou-hint'},'还没有可区分峰谷的 DeepSeek 用量（升级后开始按请求时间统计）。')):null;
  const foot=data?h('p',{className:'ou-foot'},'口径：本机统计来自 DSH 的模型调用（DeepSeek 账户/官方 API、OpenAI）以及本地 OpenAI 访问工具上报的 usage，只覆盖这台机器上的 DSH；不含网页、其它应用或其它设备。DeepSeek 余额来自官方账户接口（充值 + 赠送），OpenAI 余额按手动录入金额减去官方花费变化估算，账单可能延迟；充值或赠金变化后请重新校准。数据文件：',h('code',null,data.dataFile||'')):null;
  return h('div',{className:'ou-root','data-openai-usage':''},h('div',{className:'ou-wrap'},
    h('header',{className:'ou-head'},
      h('div',null,h('h1',{className:'ou-title'},'AI 用量与余额')),
      h('div',{className:'ou-row'},h('button',{className:'ou-btn',disabled:busy,onClick:()=>reload(false,true)},iconRefresh,'刷新'))),
    error?h('p',{className:'ou-alert',role:'alert'},error):null,
    notice?h('p',{className:'ou-ok',role:'status'},notice):null,
    h('div',{className:'ou-cards'},deepseekCard,openaiCard,volcCard),
    tabs,
    tab==='volcengine'?h(VolcUsage,{data:volc,busy,refresh:()=>syncVolc(),saveIam:syncVolc}):stats,
    chart,
    peakValley,
    models,
    tab==='openai'?adminSection:null,
    foot));
}
function Icon({size=16}){return h('svg',{width:size,height:size,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor','aria-hidden':true},h('ellipse',{cx:8,cy:4.6,rx:5,ry:2.1}),h('path',{d:'M3 4.6v3.4c0 1.2 2.2 2.1 5 2.1s5-.9 5-2.1V4.6'}),h('path',{d:'M3 8v3.4c0 1.2 2.2 2.1 5 2.1s5-.9 5-2.1V8'}));}
return {inject:['slots','layout','remote','remote.account'],apply(ctx){
  const style=document.createElement('style');
  style.setAttribute('data-openai-usage','');
  style.textContent=CSS;
  document.head.appendChild(style);
  ctx.effect(()=>()=>{style.remove()});
  const loadAccount=createAccountLoader(ctx);
  const openPanel=()=>{const layout=ctx.layout||ctx.get&&ctx.get('layout');try{layout&&layout.selectPanel&&layout.selectPanel('openai-usage')}catch(error){console.warn('openai-usage: 打开面板失败',error)}};
  const Footer=(props)=>h(FooterAction,{wide:props&&props.wide,open:openPanel,loadAccount});
  const Panel=()=>h(PanelView,{loadAccount});
  ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'openai-usage'},Panel));
  ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'openai-usage',order:10,label:'AI 用量'},Footer));
}};
}});
