import type { ApiRecord, AlertRecord, HealthCheck, LogRecord, TeamMember, Workspace } from '../types';

const wait = (ms=420) => new Promise<void>(resolve => setTimeout(resolve, ms));
const seedApis:ApiRecord[] = [
 {id:'api_01',name:'Core Platform API',baseUrl:'https://api.serverpulse.dev/v2',description:'Identity, workspaces, and core product operations.',status:'Healthy',requests:'1.28M',latency:84,uptime:99.98,updated:'2 min ago',favorite:true,endpoints:42},
 {id:'api_02',name:'Billing & Usage',baseUrl:'https://billing.serverpulse.dev',description:'Plans, metering, invoices, and payment lifecycle.',status:'Healthy',requests:'428K',latency:116,uptime:99.96,updated:'8 min ago',favorite:false,endpoints:18},
 {id:'api_03',name:'Edge Gateway',baseUrl:'https://edge.serverpulse.dev/v1',description:'Low-latency edge routing and configuration delivery.',status:'Degraded',requests:'892K',latency:247,uptime:98.72,updated:'1 min ago',favorite:true,endpoints:27},
 {id:'api_04',name:'Events Stream',baseUrl:'https://events.serverpulse.dev',description:'Reliable event ingestion and delivery endpoints.',status:'Healthy',requests:'2.04M',latency:63,uptime:99.99,updated:'12 min ago',favorite:false,endpoints:13},
 {id:'api_05',name:'Legacy Reports',baseUrl:'https://reports.serverpulse.dev/v1',description:'Scheduled exports and historical reporting.',status:'Offline',requests:'74K',latency:0,uptime:96.41,updated:'24 min ago',favorite:false,endpoints:9}
];
const seedLogs:LogRecord[] = Array.from({length:32},(_,i)=>({id:`req_${String(4821-i).padStart(5,'0')}`,method:['GET','POST','GET','PATCH','DELETE'][i%5],path:['/v2/users','/v2/projects','/v1/events/ingest','/v2/keys','/v1/reports'][i%5],status:[200,200,201,200,429,503][i%6],duration:[42,87,113,56,282,921][i%6],time:`${i+1}m ago`,api:['Core Platform API','Events Stream','Billing & Usage'][i%3],region:['iad1','sfo1','fra1'][i%3]}));
const seedAlerts:AlertRecord[]=[{id:'alt_01',title:'Elevated latency on Edge Gateway',detail:'p95 response time exceeded 220ms for 8 minutes.',severity:'Warning',time:'4 min ago',acknowledged:false},{id:'alt_02',title:'Legacy Reports health check failed',detail:'Connection timed out from 2 of 3 regions.',severity:'Critical',time:'19 min ago',acknowledged:false},{id:'alt_03',title:'Unusual 429 response volume',detail:'Rate limit responses increased 18% over baseline.',severity:'Info',time:'1 hour ago',acknowledged:true}];
const seedChecks:HealthCheck[]=[{id:'hc_1',name:'Core API · US East',url:'api.serverpulse.dev/health',status:'Operational',latency:82,interval:30},{id:'hc_2',name:'Edge Gateway · Europe',url:'edge.serverpulse.dev/health',status:'Degraded',latency:241,interval:60},{id:'hc_3',name:'Reports · US West',url:'reports.serverpulse.dev/health',status:'Down',latency:0,interval:30}];
const seedTeam:TeamMember[]=[{id:'u1',name:'Maya Chen',email:'maya@serverpulse.dev',role:'Owner',status:'Active'},{id:'u2',name:'Jonas Reed',email:'jonas@serverpulse.dev',role:'Admin',status:'Active'},{id:'u3',name:'Ari Patel',email:'ari@serverpulse.dev',role:'Developer',status:'Active'},{id:'u4',name:'Sam Rivera',email:'sam@serverpulse.dev',role:'Viewer',status:'Invited'}];
function read<T>(key:string,seed:T):T { try { const storageKey=`sp_${key}`; const value=localStorage.getItem(storageKey); if(value)return JSON.parse(value) as T; localStorage.setItem(storageKey,JSON.stringify(seed)); return seed; } catch { return seed; } }
function save<T>(key:string,value:T){localStorage.setItem(`sp_${key}`,JSON.stringify(value));}
export const service={
 async apis(){await wait();return read<ApiRecord[]>('apis',seedApis);},
 async saveApi(api:ApiRecord){await wait(360);const all=read<ApiRecord[]>('apis',seedApis);const next=all.some(x=>x.id===api.id)?all.map(x=>x.id===api.id?api:x):[api,...all];save('apis',next);return next;},
 async deleteApi(id:string){await wait(320);const next=read<ApiRecord[]>('apis',seedApis).filter(x=>x.id!==id);save('apis',next);return next;},
 async toggleFavorite(id:string){const all=read<ApiRecord[]>('apis',seedApis).map(x=>x.id===id?{...x,favorite:!x.favorite}:x);save('apis',all);return all;},
 async logs(){await wait(520);return read<LogRecord[]>('logs',seedLogs);},
 async alerts(){await wait();return read<AlertRecord[]>('alerts',seedAlerts);},
 async acknowledge(id:string){const next=read<AlertRecord[]>('alerts',seedAlerts).map(a=>a.id===id?{...a,acknowledged:true}:a);save('alerts',next);return next;},
 async checks(){await wait();return read<HealthCheck[]>('checks',seedChecks);},
 async team(){await wait();return read<TeamMember[]>('team',seedTeam);},
 async saveTeam(m:TeamMember){await wait(350);const list=read<TeamMember[]>('team',seedTeam);const next=list.some(x=>x.id===m.id)?list.map(x=>x.id===m.id?m:x):[...list,m];save('team',next);return next;},
 async workspaces(){await wait(220);return read<Workspace[]>('workspaces',[{id:'w1',name:'Acme Engineering',plan:'Growth'},{id:'w2',name:'Sandbox workspace',plan:'Free'}]);},
 async reset(){['apis','logs','alerts','checks','team','keys','hooks','settings','workspaces'].forEach(k=>localStorage.removeItem(`sp_${k}`));await wait(300);}
};
