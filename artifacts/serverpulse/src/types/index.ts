export type Role = 'Owner' | 'Admin' | 'Developer' | 'Viewer';
export type ApiRecord = { id:string; name:string; baseUrl:string; description:string; status:'Healthy'|'Degraded'|'Offline'; requests:string; latency:number; uptime:number; updated:string; favorite:boolean; endpoints:number };
export type LogRecord = { id:string; method:string; path:string; status:number; duration:number; time:string; api:string; region:string };
export type Workspace = { id:string; name:string; plan:string };
export type TeamMember = { id:string; name:string; email:string; role:Role; status:string };
export type HealthCheck = { id:string; name:string; url:string; status:string; latency:number; interval:number };
export type AlertRecord = { id:string; title:string; detail:string; severity:string; time:string; acknowledged:boolean };
