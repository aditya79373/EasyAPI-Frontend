import { useCallback, useEffect, useState,useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { addRequest,useRealRequests, buildStats } from '../lib/requestStore';
import { useMonitor, checkNow, timeAgo, fmtDur, fmtWhen,saveMonitorPrefs } from '../lib/monitorStore';
import { onLive } from '../lib/live';
import axios from 'axios';
import { motion } from 'framer-motion';
import { fetchTeam, readTeam } from '../lib/teamCache';
import { Dropdown } from '../components/ui/Dropdown';
import { useNavigate } from 'react-router-dom';   // useNavigate add karo
import { ArrowLeft} from 'lucide-react';   // ArrowLeft add karo
import { Logo } from '../App'; 
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
    XCircle,
  AlertTriangle,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  FileClock,
  Globe2,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  UserRound,
  UsersRound,
  Webhook,
  X,
  Zap,
 EyeOff 
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import { useLiveAlerts } from '../lib/liveAlerts';
import { service } from '../services/mock';
import { OrbitLoader } from '../components/ui/OrbitLoader';
import { useResource } from '../hooks/useResource';
import type { HealthCheck, Role, TeamMember } from '../types';

const Button = ({
  children,
  onClick,
  kind = 'secondary',
  className = '',
  type = 'button',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`btn btn-${kind} ${className}`}
  >
    {children}
  </button>
);
const Card = ({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => (
  <section id={id} className={`panel card ${className}`}>
    {children}
  </section>
);
const Heading = ({
  title,
  desc,
  eyebrow,
  action,
}: {
  title: string;
  desc: string;
  eyebrow: string;
  action?: React.ReactNode;
}) => (
  <div className="page-heading">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
    {action && <div className="heading-action">{action}</div>}
  </div>
);
const chart = [
  { time: '00:00', requests: 31, errors: 2 },
  { time: '02:00', requests: 24, errors: 1 },
  { time: '04:00', requests: 19, errors: 1 },
  { time: '06:00', requests: 43, errors: 3 },
  { time: '08:00', requests: 68, errors: 4 },
  { time: '10:00', requests: 82, errors: 3 },
  { time: '12:00', requests: 74, errors: 5 },
  { time: '14:00', requests: 96, errors: 7 },
  { time: '16:00', requests: 88, errors: 4 },
  { time: '18:00', requests: 71, errors: 3 },
  { time: '20:00', requests: 53, errors: 2 },
  { time: '22:00', requests: 42, errors: 2 },
];
function saveDownload(text: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function Pill({ children, tone }: { children: string; tone?: string }) {
  return (
    <span className={`status-pill ${tone || children.toLowerCase()}`}>
      <i />
      {children}
    </span>
  );
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <CircleHelp />
      </div>
      <b>{title}</b>
      <p>{copy}</p>
    </div>
  );
}

export function Analytics() {
  const [range, setRange] = useState('7 days');
  const real = useRealRequests();
  const rangeMs = (range === '7 days' ? 168 : range === '30 days' ? 720 : 24) * 3600e3;
  const scoped = real.filter((r) => r.ts >= Date.now() - rangeMs);
  const stats = buildStats(real, range);
  const chart = stats.buckets;
  const total = scoped.length;
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0') + '%';
  const sortedMs = scoped.map((r) => r.duration).sort((a, b) => a - b);
  const p95 = sortedMs.length
    ? sortedMs[Math.max(0, Math.ceil(sortedMs.length * 0.95) - 1)]
    : 0;
  const hostOf = (p: string) => {
    try {
      return new URL(p).host;
    } catch {
      return p.split('/')[0] || 'unknown';
    }
  };
  const pathOf = (p: string) => {
    try {
      return new URL(p).pathname;
    } catch {
      return p;
    }
  };
  const byHost = new Map<string, number>();
  scoped.forEach((r) => byHost.set(hostOf(r.path), (byHost.get(hostOf(r.path)) || 0) + 1));
  const topServices = Array.from(byHost, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const endpoints = new Set(scoped.map((r) => hostOf(r.path) + pathOf(r.path))).size;
  const codeRows: [string, number, string][] = [
    ['2xx', scoped.filter((r) => r.status >= 200 && r.status < 300).length, 'good'],
    ['3xx', scoped.filter((r) => r.status >= 300 && r.status < 400).length, 'cyan'],
    ['4xx', scoped.filter((r) => r.status >= 400 && r.status < 500).length, 'warn'],
    ['5xx', scoped.filter((r) => r.status >= 500).length, 'bad'],
    ['Network', scoped.filter((r) => r.status === 0).length, 'bad'],
  ];
  return (
    <>
      <Heading
        eyebrow="TRAFFIC & PERFORMANCE"
        title="Analytics"
        desc="Understand what is changing across your API surface."
        action={
          <>
            <Dropdown value={range} onChange={setRange} options={['24 hours', '7 days', '30 days']} />
            <Button
              onClick={() =>
                saveDownload(
                  'time,requests,errors\n' +
                    chart.map((x) => `${x.time},${x.requests},${x.errors}`).join('\n'),
                  'easyapi-analytics.csv',
                  'text/csv',
                )
              }
            >
              <ArrowDownToLine size={15} /> Export CSV
            </Button>
          </>
        }
      />
            <div className="metric-grid">
        <Metric
          title="Total requests"
          value={total.toLocaleString()}
          change={`Last ${range}`}
          icon={<Activity />}
        />
        <Metric
          title="Success rate"
          value={total ? `${stats.successRate.toFixed(2)}%` : '—'}
          change={`${stats.errors} failed`}
          icon={<CheckCircle2 />}
        />
        <Metric
          title="p95 response time"
          value={total ? `${p95} ms` : '—'}
          change={total ? `Avg ${stats.avg} ms` : 'No data yet'}
          icon={<Zap />}
        />
        <Metric
          title="Unique endpoints"
          value={String(endpoints)}
          change={`Across ${byHost.size} services`}
          icon={<Radio />}
        />
      </div>
      <Card className="analytics-chart">
        <div className="card-head">
          <div>
            <h3>Traffic over time</h3>
            <p>Request volume and failed requests · {range}</p>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-violet" />
              Requests
            </span>
            <span>
              <i className="legend-cyan" />
              Errors
            </span>
          </div>
        </div>
        <div className="chart-wrap tall">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="extra-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b7cff" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b7cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
             <XAxis
  dataKey="time"
  axisLine={false}
  tickLine={false}
  tickMargin={14}
  minTickGap={24}
  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
/>
<YAxis
  axisLine={false}
  tickLine={false}
  tickMargin={10}
  width={44}
  allowDecimals={false}
  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
/>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#8b7cff"
                fill="url(#extra-grad)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="#54ced7"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="detail-two">
        <Card>
          <div className="card-head">
            <div>
              <h3>Top services</h3>
              <p>By request volume</p>
            </div>
          </div>
          {topServices.length === 0 && <p className="muted-copy">No requests in this range.</p>}
          {topServices.map((s) => (
            <div
  className="rank-row"
  key={s.name}
  style={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) 44px minmax(70px, 1fr) 52px',
    alignItems: 'center',
    gap: 12,
  }}
>
  <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
    {s.name}
  </b>
  <span style={{ textAlign: 'right' }}>{s.count.toLocaleString()}</span>
  <div className="rank-track">
    <i style={{ width: pct(s.count) }} />
  </div>
  <small style={{ textAlign: 'right' }}>{pct(s.count)}</small>
</div>
          ))}
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h3>Response codes</h3>
              <p>Request distribution</p>
            </div>
          </div>
          {codeRows.map(([n, count, c]) => (
            <div
  className="code-row"
  key={n}
  style={{
    display: 'grid',
    gridTemplateColumns: '10px 72px minmax(0, 1fr) 60px',
    alignItems: 'center',
    gap: 12,
  }}
>
  <span className={`code-mark ${c}`} />
  <b>{n}</b>
  <div className="rank-track">
    <i className={c} style={{ width: pct(count) }} />
  </div>
  <strong style={{ textAlign: 'right' }}>{pct(count)}</strong>
</div>
          ))}
        </Card>
      </div>
    </>
  );
}
function Metric({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="metric-card">
      <div className="metric-icon violet">{icon}</div>
      <span className="metric-label">{title}</span>
      <b className="metric-value">{value}</b>
      <span className="metric-change">{change}</span>
    </Card>
  );
}

export function Monitoring() {
  const [sec, setSec] = useState(30),
    [paused, setPaused] = useState(false),
    [checking, setChecking] = useState<string | null>(null),
    [, setTick] = useState(0);
  const { data, error, loading, refresh } = useMonitor(paused ? 30 : sec, true);
  useEffect(() => {
    if (data) setSec(data.intervalSec);
  }, [data?.intervalSec]);
  useEffect(() => {
    if (data) setPaused(data.paused);
  }, [data?.paused]);
  const changeInterval = async (v: number) => {
    setSec(v);
    try {
      await saveMonitorPrefs({ monitorInterval: v });
    } catch {}
    void refresh();
  };
  const togglePaused = async () => {
    const next = !paused;
    setPaused(next);
    try {
      await saveMonitorPrefs({ monitorPaused: next });
    } catch {}
    void refresh();
  };

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000); // "x sec ago" taaza rahe
    return () => clearInterval(t);
  }, []);

  const runNow = async (id: string) => {
    if (checking) return;
    setChecking(id);
    try {
      await Promise.all([checkNow(id), new Promise((r) => setTimeout(r, 800))]);
    } catch {}
    await refresh();
    setChecking(null);
  };

  const apis = data?.apis || [];
  const incidents = data?.incidents || [];
  const bad = apis.filter((a) => a.status === 'Degraded' || a.status === 'Down');
  const checked = apis.filter((a) => a.lastCheckedAt);
  const lastAt = Math.max(0, ...apis.map((a) => a.lastCheckedAt || 0));
  const every = data?.intervalSec || 60;
  const level = apis.some((a) => a.status === 'Down') ? 'bad' : bad.length ? 'warn' : '';
  const title = !apis.length
    ? 'No services monitored'
    : !checked.length
      ? 'Waiting for the first check'
      : !bad.length
        ? 'All services operational'
        : bad.length === apis.length
          ? 'All services need attention'
          : 'Most services operational';
  const sub = !apis.length
    ? 'Add an API in the inventory to start monitoring it.'
    : !checked.length
      ? `The server checks every ${every} seconds.`
      : `${bad.length ? `${bad.length} ${bad.length === 1 ? 'service needs' : 'services need'} attention. ` : ''}Last checked ${timeAgo(lastAt)}. ${paused ? 'Checks are paused.' : `Server checks every ${every}s.`}`;

  return (
    <>
      <Heading
        eyebrow="UPTIME & HEALTH"
        title="Monitoring"
        desc="Health checks for the services your team depends on."
        action={
          <>
                      <Dropdown ariaLabel="Check interval" value={sec}
  onChange={(v) => void changeInterval(Number(v))}
  options={[
    { value: '15', label: 'Check every 15s' },
    { value: '30', label: 'Check every 30s' },
    { value: '60', label: 'Check every 60s' },
  ]} />
            <Button kind={paused ? 'primary' : 'secondary'} onClick={() => void togglePaused()}>
              {paused ? <Play size={15} /> : <Pause size={15} />}{' '}
              {paused ? 'Resume checks' : 'Pause checks'}
            </Button>
          </>
        }
      />
      <div className={`status-banner ${level}`}>
        <div className="banner-check">
          <CheckCircle2 size={19} />
        </div>
        <div>
          <b>{title}</b>
          <p>{sub}</p>
        </div>
{paused ? (
  <Pill tone="paused">Checks paused</Pill>
) : (
  <Pill tone="healthy">Checks running</Pill>
)}
      </div>

      <div className="monitor-grid">
        {loading ? (
          <div className="skeleton skeleton-block" />
        ) : error && !data ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <b>Could not load monitoring data</b>
            <p>Check that the backend is running.</p>
            <Button onClick={() => void refresh()}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        ) : apis.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-icon">
              <Globe2 />
            </div>
            <b>No services to monitor</b>
            <p>APIs you add to the inventory are health-checked automatically.</p>
            <Link className="btn btn-secondary" to="/apis">
              Open API inventory
            </Link>
          </div>
        ) : (
          apis.map((c) => (
            <Card key={c.id} className="monitor-card">
              <div className="monitor-card-head">
                <div
                  className={`monitor-icon ${
                    c.status === 'Operational'
                      ? 'good'
                      : c.status === 'Degraded'
                        ? 'warn'
                        : c.status === 'Down'
                          ? 'bad'
                          : 'idle'
                  }`}
                >
                  <Globe2 size={18} />
                </div>
                <Pill tone={c.status === 'Operational' ? 'healthy' : c.status.toLowerCase()}>
                  {c.status}
                </Pill>
                <button
                  className="icon-btn"
                  onClick={() => void runNow(c.id)}
                  aria-label="Check now"
                  title="Check now"
                >
                  <RefreshCw size={14} className={checking === c.id ? 'spin' : ''} />
                </button>
              </div>
                            <h3 title={c.name}>{c.name}</h3>
              <p className="mono" title={c.baseUrl}>
                {c.baseUrl}
              </p>
              {c.status === 'Down' && c.error && (
                <p style={{ color: '#e37c79', marginTop: 6 }}>{c.error}</p>
              )}
                            <div className="uptime-bars">
                                {Array.from({ length: 24 }, (_, i) => {
                  const b = c.bars[i - (24 - c.bars.length)];
                  const fill = c.bars.length ? c.bars[c.bars.length - 1].state : 'none';
                  return b ? (
                    <i
                      key={i}
                      className={b.state}
                      title={`${fmtWhen(b.ts)} · ${b.state === 'down' ? 'Down' : `${b.latency} ms`}`}
                    />
                  ) : (
                    <i key={i} className={fill} />
                  );
                })}
              </div>
              <div className="uptime-range" style={{ marginBottom: 10 }}>
                <span>Older</span>
                <span>{c.lastCheckedAt ? `Checked ${timeAgo(c.lastCheckedAt)}` : 'Not checked yet'}</span>
                <span>Latest</span>
              </div>
              <div className="monitor-foot">
                <span>
                  <small>LATENCY</small>
                  <b>
                    {c.latency
                      ? `${c.latency} ms`
                      : c.status === 'Down'
                        ? c.statusCode
                          ? `HTTP ${c.statusCode}`
                          : 'Unreachable'
                        : '—'}
                  </b>
                </span>
                <span>
                  <small>UPTIME 24H</small>
                  <b>{c.uptime === null ? '—' : `${c.uptime}%`}</b>
                </span>
                <Link to={`/apis/${c.id}`}>
                  Details <ArrowRight size={13} />
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="history-card">
        <div className="card-head">
          <div>
            <h3>Incident history</h3>
            <p>Recent interruptions and recoveries</p>
          </div>
         
        </div>
        {incidents.length === 0 ? (
          <div className="history-empty" style={{ padding: '18px 0' }}>
            No incidents recorded yet.
          </div>
        ) : (
          incidents.map((i) => {
            const open = i.resolvedAt === null;
            return (
              <div className="incident-line" key={i.id}>
                                <span
                  className={`incident-symbol ${open ? (i.kind === 'Down' ? 'bad' : 'warn') : 'good'}`}
                >
                  {open ? (
                    i.kind === 'Down' ? <XCircle size={16} /> : <AlertTriangle size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                </span>
                <div>
                  <b>
                    {open
                      ? i.kind === 'Down'
                        ? `Service down · ${i.apiName}`
                        : `Elevated latency · ${i.apiName}`
                      : `${i.apiName} recovered`}
                  </b>
                  <p>{i.detail}</p>
                  <small>
                    {open
                      ? `Investigating · Started ${timeAgo(i.startedAt)}`
                      : `Resolved · ${fmtWhen(i.resolvedAt!)} · lasted ${fmtDur(i.resolvedAt! - i.startedAt)}`}
                  </small>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}



export function Alerts() {
  const { alerts, acknowledge, acknowledgeAll } = useLiveAlerts();
  const [filter, setFilter] = useState('All');

  const open = alerts.filter((a) => !a.acknowledged);
  const count = (s: string) => open.filter((a) => a.severity === s).length;
  const shown = alerts.filter(
    (a) => filter === 'All' || (filter === 'Open' ? !a.acknowledged : a.acknowledged),
  );

  return (
    <>
      <Heading
        eyebrow="SIGNALS & NOTIFICATIONS"
        title="Alerts"
        desc="Signals that need a human decision, with context to act."
        action={
          <>
            <Dropdown value={filter} onChange={setFilter} options={['All', 'Open', 'Acknowledged']} />
            {open.length > 0 && (
              <Button onClick={acknowledgeAll}>
                <Check size={14} /> Acknowledge all
              </Button>
            )}
          </>
        }
      />
      <div className="alert-overview">
        <span className="alert-overview-icon">
          <Bell size={19} />
        </span>
        <div>
          <b>{open.length} open alerts</b>
          <small>Across your API inventory</small>
        </div>
        <div className="alert-breakdown">
          <span>
            <i className="severity critical" />
            {count('Critical')} critical
          </span>
          <span>
            <i className="severity warning" />
            {count('Warning')} warning
          </span>
          <span>
            <i className="severity info" />
            {count('Info')} informational
          </span>
        </div>
      </div>
      <div className="alerts-list">
        {shown.length === 0 ? (
          <Card>
            <div className="empty-state">
              <b>{alerts.length ? 'Nothing in this filter' : 'All clear'}</b>
              <p>
                {alerts.length
                  ? 'Try a different filter.'
                  : 'No alerts right now. Send requests from the tester to see live signals.'}
              </p>
            </div>
          </Card>
        ) : (
          shown.map((a) => (
            <Card className={`alert-card ${a.acknowledged ? 'acknowledged' : ''}`} key={a.id}>
              <div className={`alert-marker large ${a.severity.toLowerCase()}`} />
              <div className="alert-card-content">
                <div className="alert-title-row">
                  <span className={`severity-label ${a.severity.toLowerCase()}`}>{a.severity}</span>
                  <span>{a.time}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
                <div className="alert-actions">
                  <Link to={a.link}>
                    View details <ArrowRight size={13} />
                  </Link>
                  {a.acknowledged ? (
                    <span className="ack-label">
                      <Check size={14} /> Acknowledged
                    </span>
                  ) : (
                    <Button onClick={() => acknowledge(a.id)}>
                      <Check size={14} /> Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

type Member = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'Active' | 'Invited' | 'Rejected';
  kind: 'owner' | 'member' | 'invite';
  joinedAt: number | null;
};
const teamCfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});

export function Team() {
    const [cache] = useState(readTeam);
  const [list, setList] = useState<Member[]>((cache?.list as Member[]) || []);
  const [myRole, setMyRole] = useState(cache?.myRole || 'Owner');
  const [loading, setLoading] = useState(!cache);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
  if (refreshing) return;
  setRefreshing(true);
  await Promise.all([load(), new Promise((r) => setTimeout(r, 2000))]);
  setRefreshing(false);
};
  const load = useCallback(async () => {
    const d = await fetchTeam();
    if (d) {
      setList(d.list as Member[]);
      setMyRole(d.myRole);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const off = onLive(load);
    const t = setInterval(load, 15000);
    return () => {
      off();
      clearInterval(t);
    };
  }, [load]);

  const canManage = myRole === 'Owner' || myRole === 'Admin';
  const fail = (e: unknown) =>
    setErr(
      axios.isAxiosError(e)
        ? e.response?.data?.message || 'Could not reach the server'
        : 'Something went wrong',
    );

const invite = async (e: React.FormEvent) => {
  e.preventDefault();
  setErr('');
  setBusy(true);
  try {
    // request aur 3 sec ka minimum delay saath chalenge
    await Promise.all([
      axios.post(`${API}/api/team/invite`, { email, role }, teamCfg()),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    setNotice(`Invitation sent to ${email}`);
    setTimeout(() => setNotice(''), 3000);
    setEmail('');
    await load();
  } catch (e2) {
    fail(e2);
  } finally {
    setBusy(false);
  }
};
  const myEmail = (() => {
    try {
      return JSON.parse(localStorage.getItem('sp_user') || '{}').email || '';
    } catch {
      return '';
    }
  })();
  const openDash = (m: Member) => {
    if (m.kind === 'invite') {
      setNotice('Accept karne ke baad dashboard dekh sakte ho');
      setTimeout(() => setNotice(''), 3000);
      return;
    }
    if (m.email === myEmail) {
      localStorage.removeItem('sp_view');
      localStorage.removeItem('sp_viewname');
    } else {
      localStorage.setItem('sp_view', m.id);
      localStorage.setItem('sp_viewname', m.name);
    }
    window.location.href = '/dashboard';
  };
  const remove = async (m: Member) => {
  
    setErr('');
    try {
      await axios.delete(`${API}/api/team/${m.id}`, teamCfg());
      await load();
    } catch (e2) {
      fail(e2);
    }
  };
  const leave = async () => {
    if (!confirm('Disconnect from this workspace? Both of you will lose access to each other.')) return;
    try {
      await axios.post(
        `${API}/api/membership/leave`,
        { id: localStorage.getItem('sp_view') },
        teamCfg(),
      );
      localStorage.removeItem('sp_view');
      window.location.href = '/dashboard';
    } catch (e2) {
      fail(e2);
    }
  };

  return (
    <>
      <Heading
        eyebrow="PEOPLE & PERMISSIONS"
        title="Team"
        desc="Manage workspace access with roles that stay understandable."
        action={
          <>
        <span
  className="count-badge"
  style={{
    background: '#f5b83d',
    color: '#3d2a00',
    fontWeight: 600,
    border: '1px solid #d99a1c',
  }}
>
  {list.filter((m) => m.status === 'Active').length} members
</span>
{localStorage.getItem('sp_view') && <Button onClick={leave}>Disconnect</Button>}
          </>
        }
      />
      {canManage && (
        <Card className="invite-card">
          <div>
            <h3>Invite someone to your workspace</h3>
            <p>They will get a notification on the bell and can accept it.</p>
          </div>
          <form onSubmit={invite}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              aria-label="Email to invite"
            />
           
            <button type="submit" className="btn btn-primary pw-btn" disabled={busy}>
  {busy ? <OrbitLoader size={16} /> : <Plus size={15} />}
  {busy ? 'Sending' : 'Invite'}
</button>
          </form>
        </Card>
      )}
      {notice && (
        <div className="notice">
          <Check size={15} />
          {notice}
        </div>
      )}
      {err && (
        <div className="notice" style={{ color: '#e5736f', borderColor: 'rgba(229,115,111,.35)' }}>
          {err}
        </div>
      )}
      <Card className="team-card">
     <div className="table-toolbar">
  <b>Workspace members</b>
  <Button onClick={refresh}>
    <motion.span
      style={{ display: 'inline-flex' }}
      animate={{ rotate: refreshing ? 360 : 0 }}
      transition={
        refreshing
          ? { repeat: Infinity, duration: 0.8, ease: 'linear' }
          : { duration: 0 }
      }
    >
      <RefreshCw size={15} />
       </motion.span>
  </Button>
</div>
        <div className="logs-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                                <th>Dashboard</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
                            {loading && (
                <tr>
                                                   <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0' }}>
                    <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
                      <OrbitLoader size={32} />
                      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                        Loading
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {refreshing && (
  <tr>
    <td colSpan={5}>
      <div style={{ display: 'grid', gap: 16, padding: '12px 4px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer-line" />
        ))}
      </div>
    </td>
  </tr>
)}
{!refreshing && list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="member-cell">
                     <span className="user-avatar" style={{ overflow: 'hidden', padding: 0 }}>
  {m.avatar ? (
    <img
      src={m.avatar}
      alt={m.name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
    />
  ) : (
    m.name
      .split(' ')
      .filter(Boolean)
      .map((x) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  )}
</span>
                      <span>
                        <b>{m.name}</b>
                        <small className="table-sub">{m.email}</small>
                      </span>
                    </div>
                  </td>
                                   <td>
                  <button
  className={`btn ${m.email === myEmail ? 'btn-primary' : 'btn-secondary'} dash-switch`}
  style={{
  minHeight: 0,
  height: 24,
  padding: '0 10px',
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1,
  borderRadius: 6,
  boxShadow: 'none',
  whiteSpace: 'nowrap',
}}
  onClick={() => openDash(m)}
>
                      {m.email === myEmail ? 'My Dashboard' : 'Show dashboard'}
                    </button>
                  </td>
               <td>
{m.status === 'Rejected' ? (
  <span className="pill-rejected">
    <Pill tone="warning">Rejected</Pill>
  </span>
) : (
    <Pill tone={m.status === 'Active' ? 'healthy' : 'warning'}>{m.status}</Pill>
  )}
</td>
                  <td>
                    {m.joinedAt
                      ? new Date(m.joinedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                         : m.status === 'Rejected' ? 'Declined' : 'Pending'}
                  </td>
                  <td>
                    {canManage && m.kind !== 'owner' && (
                      <button
                        className="icon-btn danger-icon"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => remove(m)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
    </>
  );
}
export function Webhooks() {
  const [hooks, setHooks] = useState<any[]>(
    () =>
      JSON.parse(localStorage.getItem('sp_hooks') || 'null') || [
        {
          id: 'wh_01',
          url: 'https://hooks.acme.dev/serverpulse',
          events: ['incident.created', 'incident.resolved'],
          status: 'Active',
          last: '2 min ago',
          code: 200,
        },
        {
          id: 'wh_02',
          url: 'https://ci.acme.dev/api/events',
          events: ['api.updated'],
          status: 'Active',
          last: '18 min ago',
          code: 500,
        },
      ],
  );
  const [toast, setToast] = useState('');
  const save = (n: any[]) => {
    setHooks(n);
    localStorage.setItem('sp_hooks', JSON.stringify(n));
  };
  return (
    <>
      <Heading
        eyebrow="EVENT DELIVERY"
        title="Webhooks"
        desc="Send workspace events to the tools your team already uses."
        action={
          <Button
            kind="primary"
            onClick={() => {
              const u = prompt('Webhook destination URL', 'https://');
              if (u)
                save([
                  {
                    id: `wh_${Date.now()}`,
                    url: u,
                    events: ['incident.created'],
                    status: 'Active',
                    last: 'Never',
                    code: 0,
                  },
                  ...hooks,
                ]);
            }}
          >
            <Plus size={15} /> Add endpoint
          </Button>
        }
      />
      <div className="webhook-callout">
        <Webhook size={18} />
        <span>Delivery attempts are simulated locally in demo mode.</span>
        <Link to="/docs">
          View event reference <ArrowRight size={14} />
        </Link>
      </div>
      <div className="webhook-list">
        {hooks.map((h) => (
          <Card className="webhook-card" key={h.id}>
            <div className="webhook-icon">
              <Webhook size={18} />
            </div>
            <div className="webhook-main">
              <b>{h.url}</b>
              <div className="webhook-events">
                {h.events.map((e: string) => (
                  <span className="tag" key={e}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <span className={`http-code ${h.code >= 500 ? 'bad' : 'good'}`}>{h.code || '—'}</span>
            <div className="webhook-meta">
              <small>Last delivery</small>
              <b>{h.last}</b>
            </div>
            <Pill>{h.status}</Pill>
            <Button
              onClick={() => {
                save(hooks.map((x) => (x.id === h.id ? { ...x, last: 'just now', code: 200 } : x)));
                setToast('Webhook delivery retried successfully');
                setTimeout(() => setToast(''), 2600);
              }}
            >
              <RefreshCw size={14} /> Retry
            </Button>
            <button
              className="icon-btn danger-icon"
              aria-label="Delete webhook"
              onClick={() => {
                if (confirm('Delete webhook endpoint?')) save(hooks.filter((x) => x.id !== h.id));
              }}
            >
              <Trash2 size={14} />
            </button>
          </Card>
        ))}
      </div>
      {toast && <div className="toast-message">{toast}</div>}
      <Card className="event-card">
        <div className="card-head">
          <div>
            <h3>Available events</h3>
            <p>Subscribe only to the signals you need.</p>
          </div>
        </div>
        <div className="event-tags">
          {[
            'incident.created',
            'incident.updated',
            'incident.resolved',
            'api.updated',
            'key.created',
            'key.revoked',
            'team.member.invited',
          ].map((e) => (
            <span className="tag mono" key={e}>
              {e}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

export function GenericPage({ page }: { page: string }) {
  let u = { name: '', email: '' };
  try {
    u = JSON.parse(localStorage.getItem('sp_user') || '') || u;
  } catch {}
  const fullName = u.name || (u.email ? u.email.split('@')[0] : 'Guest');
  const workspaceName = localStorage.getItem('sp_workspace') || 'My Workspace';
  const role = localStorage.getItem('sp_role') || 'Owner';

  const definitions: Record<
    string,
    { title: string; eyebrow: string; desc: string; cards: [string, string, string][] }
  > = {
    audit: {
      title: 'Audit trail',
      eyebrow: 'WORKSPACE ACTIVITY',
      desc: 'A reliable record of changes made across your workspace.',
      cards: [
        [
          'API configuration updated',
          'Maya Chen updated Core Platform API base URL.',
          '2 minutes ago',
        ],
        ['Access key created', 'A new CI integration key was issued by Jonas Reed.', 'Yesterday'],
        ['Member invited', 'Sam Rivera was invited as Viewer.', 'Oct 18, 2025'],
      ],
    },
    docs: {
      title: 'Documentation',
      eyebrow: 'REFERENCE & GUIDES',
      desc: 'A clear guide to working with APIs in this workspace.',
      cards: [
        [
          'Getting started',
          'Add an API, send your first request, and see traffic arrive.',
          '5 min read',
        ],
        ['Authentication', 'Bearer tokens, scopes, rotation, and safe key storage.', '7 min read'],
        [
          'OpenAPI import',
          'Bring an existing OpenAPI or Postman collection into inventory.',
          '4 min read',
        ],
      ],
    },
   
    profile: {
      title: 'My profile',
      eyebrow: 'PERSONAL ACCOUNT',
      desc: 'Your identity and preferences for this workspace.',
     cards: [
  [fullName, u.email || 'No email added', role],
  ['Display name', fullName, 'Visible to workspace members'],
  ['Workspace', workspaceName, 'Your current workspace'],
],
    },
  };
  const d = definitions[page];
  return (
    <>
      <Heading eyebrow={d.eyebrow} title={d.title} desc={d.desc} />
      <div className="generic-grid">
        {d.cards.map(([a, b, c], i) => (
          <Card className="generic-card" key={a}>
            <div className="generic-icon">
              {page === 'audit' ? (
                <ShieldCheck size={17} />
              ) : page === 'docs' ? (
                <BookOpen size={17} />
              ) : page === 'billing' ? (
                <CreditCard size={17} />
              ) : (
                <UserRound size={17} />
              )}
            </div>
            <div className="generic-content">
              <h3>{a}</h3>
              <p>{b}</p>
              <span>{c}</span>
            </div>
            {page === 'docs' ? (
              <Link className="generic-action" to={i === 0 ? '/apis' : '/tester'}>
                <ArrowRight size={15} />
              </Link>
            ) : page === 'billing' && i === 0 ? (
              <Button onClick={() => alert('Billing actions are simulated in demo mode.')}>
                Manage plan
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
      {page === 'billing' && (
        <Card className="billing-usage">
          <div className="card-head">
            <div>
              <h3>Monthly request usage</h3>
              <p>Current cycle · Oct 21 – Nov 21, 2025</p>
            </div>
            <b>6.8M / 10M</b>
          </div>
          <div className="usage-meter large-meter">
            <i style={{ width: '68%' }} />
          </div>
          <div className="usage-copy">
            <span>3.2 million requests remaining</span>
            <span>68%</span>
          </div>
        </Card>
      )}
      {page === 'docs' && (
        <Card className="tab-content">
          <div className="card-head">
            <div>
              <h3>Example: send a request</h3>
              <p>Use the request tester to try a real endpoint.</p>
            </div>
            <Link className="btn btn-primary" to="/tester">
              <TerminalSquare size={15} /> Open tester
            </Link>
          </div>
          <pre className="code-block">
            curl -X GET https://api.serverpulse.dev/v2/health \\{'\n'} -H "Authorization: Bearer
            $SERVERPULSE_KEY"
          </pre>
        </Card>
      )}
    </>
  );
}
const SectionHeading = ({ title }: { title: string }) => (
  <h3 style={{ margin: '0 0 10px 4px', fontSize: 15, fontWeight: 700 }}>{title}</h3>
);

export function SettingsPage() {
  const [theme, setThemeState] = useState(localStorage.getItem('sp_theme') || 'dark');
  const [role, setRole] = useState('');
  const [noLogs, setNoLogs] = useState(false);
  const [wsSaved, setWsSaved] = useState('');
  const [wsDraft, setWsDraft] = useState('');
  const [interval, setIntervalSec] = useState(30);
  const [paused, setPaused] = useState(false);
  const [liveOn, setLiveOn] = useState(true);
  const [msg, setMsg] = useState('');
  const [showPw, setShowPw] = useState(false);
const [showPw2, setShowPw2] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
const [clearing, setClearing] = useState(false);
  const inView = !!localStorage.getItem('sp_view');
  const [avatar, setAvatar] = useState('');
const [uploading, setUploading] = useState(false);
const fileRef = useRef<HTMLInputElement>(null);
const [pw, setPw] = useState('');
const [pw2, setPw2] = useState('');

const [pwBusy, setPwBusy] = useState(false);

const syncAvatar = (a: string) => {
  setAvatar(a);
  window.dispatchEvent(new CustomEvent('sp-avatar-changed', { detail: a }));
};

const uploadAvatar = async (file?: File) => {
  if (!file) return;
  if (!file.type.startsWith('image/')) return setErr('Please choose an image file');
  if (file.size > 3 * 1024 * 1024) return setErr('Image must be under 3 MB');
  setUploading(true);
  try {
    const fd = new FormData();
    fd.append('avatar', file);
    const { data } = await axios.post(`${API}/api/auth/avatar`, fd, cfg());
    syncAvatar(data.user.avatar || '');
    flash('Photo updated');
  } catch (e) {
    fail(e);
  } finally {
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }
};

const removeAvatar = async () => {
  try {
    const { data } = await axios.put(`${API}/api/auth/profile`, { avatar: '' }, cfg());
    syncAvatar(data.user.avatar || '');
    flash('Photo removed');
  } catch (e) {
    fail(e);
  }
};

  const cfg = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
  });
  const flash = (t: string) => {
    setMsg(t);
    setErr('');
    setTimeout(() => setMsg(''), 3000);
  };
  const fail = (e: unknown) =>
    setErr(
      axios.isAxiosError(e)
        ? e.response?.data?.message || 'Could not reach the server'
        : 'Something went wrong',
    );

  useEffect(() => {
    axios
      .get(`${API}/api/auth/me`, cfg())
      .then(({ data }) => {
        const u = data.user;
        const p = u.prefs || {};
        setRole(u.role || 'Owner');
        setAvatar(u.avatar || '');
        setWsSaved(u.workspace || '');
        setWsDraft(u.workspace || '');
        setIntervalSec(p.monitorInterval || 30);
        setPaused(!!p.monitorPaused);
        setLiveOn(p.logsPausedAt == null);
      })
      .catch(() => {});
  }, []);

  const changeTheme = (t: string) => {
    setThemeState(t);
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem('sp_theme', t);
    window.dispatchEvent(new CustomEvent('sp-theme-changed', { detail: t }));
  };

  const savePrefs = async (patch: Record<string, unknown>, ok: string) => {
    try {
      await axios.put(`${API}/api/auth/prefs`, patch, cfg());
      flash(ok);
    } catch (e) {
      fail(e);
    }
  };

  const saveWorkspace = async () => {
    const v = wsDraft.trim();
    if (!v || v === wsSaved) return setWsDraft(wsSaved);
    try {
      const { data } = await axios.put(`${API}/api/auth/profile`, { workspace: v }, cfg());
      localStorage.setItem('sp_workspace', data.user.workspace);
      setWsSaved(data.user.workspace);
      flash('Workspace name updated');
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      fail(e);
    }
  };

const doClear = async () => {
  try {
    // pehle check karo, khali ho to spinner chalao hi mat
    const { data } = await axios.get(`${API}/api/requests`, cfg());
    if (!Array.isArray(data) || data.length === 0) {
      setNoLogs(true);
      return;
    }
    setClearing(true);
    await Promise.all([
      axios.delete(`${API}/api/requests`, cfg()),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    setConfirmDel(false);
    flash('Request logs deleted');
  } catch (e) {
    setConfirmDel(false);
    fail(e);
  } finally {
    setClearing(false);
  }
};
const savePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setErr('');
  setMsg('');
  if (pw.length < 6) return setErr('Password must be at least 6 characters');
  if (pw !== pw2) return setErr('Passwords do not match');
  setPwBusy(true);
  try {
    await Promise.all([
      axios.put(`${API}/api/auth/password`, { password: pw, confirm: pw2 }, cfg()),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    setPw('');
    setPw2('');
    flash('Password updated');
  } catch (e) {
    fail(e);
  } finally {
    setPwBusy(false);
  }
};

  return (
    <>
      <Heading
        eyebrow="WORKSPACE PREFERENCES"
        title="Settings"
        desc="Changes are saved automatically."
      />
      {msg && (
        <div className="notice">
          <Check size={15} />
          {msg}
        </div>
      )}
      {err && (
        <div className="notice" style={{ color: '#e5736f', borderColor: 'rgba(229,115,111,.35)' }}>
          {err}
        </div>
      )}
      <div className="settings-layout" style={{ display: 'block' }}>
        <div
          className="settings-content"
          style={{ display: 'grid', gap: 28, maxWidth: 860, margin: '0 auto' }}
        >
                  <div>
  <SectionHeading title="General" />
  <Card className="settings-card" id="settings-0">
    <div className="setting-row" style={{ alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
  <span
    style={{
      width: 56,
      height: 56,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(99,91,255,.15)',
      color: '#6b5cff',
    }}
  >
    {avatar ? (
      <img
        src={avatar}
        alt="Profile"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ) : (
      <UserRound size={24} />
    )}
  </span>
<span style={{ display: 'flex', flexDirection: 'column' }}>
  <b style={{ fontSize: 12 }}>Profile photo</b>
</span>
</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => uploadAvatar(e.target.files?.[0])}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <OrbitLoader size={16} /> : null}
          {uploading ? ' Uploading' : avatar ? 'Change photo' : 'Upload photo'}
        </button>
        {avatar && !uploading && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ background: '#e5484d', borderColor: '#e5484d', color: '#fff' }}
            onClick={removeAvatar}
          >
            Remove
          </button>
        )}
      </div>
    </div>

    <div className="setting-row">
      <span>
        <b>Workspace name</b>
        <small>Shown in the sidebar. Press Enter or click away to save.</small>
      </span>
      <input
        value={wsDraft}
        maxLength={40}
        onChange={(e) => setWsDraft(e.target.value)}
        onBlur={saveWorkspace}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>

    <div className="setting-row">
      <span>
        <b>Access</b>
        <small>
          {inView
            ? "You are viewing someone else's workspace."
            : 'You have full control of your workspace.'}
        </small>
      </span>
      <span
        className="count-badge"
        style={{
          background: '#f5b83d',
          color: '#3d2a00',
          fontWeight: 600,
          border: '1px solid #d99a1c',
        }}
      >
        {inView ? 'View only' : 'Full access'}
      </span>
    </div>
    
  </Card>
</div>
<div>
  <SectionHeading title="Security" />
  <Card className="profile-password">
    <div className="card-head">
      <div>
        <h3>Change password</h3>
        <p>Choose a new password for your account.</p>
      </div>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setShowPw(!showPw)}
        aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
      >
        {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
    <form onSubmit={savePassword}>
      <label>
        New password
        <input
          type={showPw ? 'text' : 'password'}
          required
          minLength={6}
          value={pw}
          autoComplete="new-password"
          onChange={(e) => setPw(e.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          type={showPw ? 'text' : 'password'}
          required
          minLength={6}
          value={pw2}
          autoComplete="new-password"
          onChange={(e) => setPw2(e.target.value)}
        />
      </label>
      <Button kind="primary" type="submit" disabled={pwBusy || inView} className="pw-btn">
        {pwBusy && <OrbitLoader size={16} />}
        {pwBusy ? 'Updating' : 'Update password'}
      </Button>
    </form>
  </Card>
</div>

          <div>
            <SectionHeading title="Monitoring" />
            <Card className="settings-card" id="settings-1">
              <label className="setting-row">
                <span>
                  <b>Check interval</b>
                  <small>Time between uptime checks for each API.</small>
                </span>
                <Dropdown className="dd-w150" value={interval}
  onChange={(v) => {
    const n = Number(v);
    setIntervalSec(n);
    savePrefs({ monitorInterval: n }, `Checking every ${n} sec`);
  }}
  options={[
    { value: '15', label: 'Every 15 sec' },
    { value: '30', label: 'Every 30 sec' },
    { value: '60', label: 'Every 60 sec' },
  ]} />
              </label>
              <label className="setting-row">
                <span>
                  <b>Pause monitoring</b>
                  <small>Stop all automatic checks until you turn it back on.</small>
                </span>
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={paused}
                  onChange={(e) => {
                    setPaused(e.target.checked);
                    savePrefs(
                      { monitorPaused: e.target.checked },
                      e.target.checked ? 'Monitoring paused' : 'Monitoring resumed',
                    );
                  }}
                />
              </label>
            </Card>
          </div>

          <div>
            <SectionHeading title="Appearance" />
            <Card className="settings-card" id="settings-2">
              <div className="theme-options">
                {['dark', 'light'].map((t) => (
                  <button
                    key={t}
                    onClick={() => changeTheme(t)}
                    className={`theme-option ${theme === t ? 'selected' : ''}`}
                  >
                    <div className={`theme-preview ${t}`}>
                      <i />
                      <i />
                      <i />
                    </div>
                    <span>{t === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <SectionHeading title="Clear data" />
            <Card className="settings-card danger-zone" id="settings-3">
              <div
  className="settings-title"
  style={{
    border: 'none',
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    alignItems: 'center',
  }}
>
                <div>
                  <h3>Delete request logs</h3>
                  <p>Permanently removes all saved request history from the tester.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ background: '#e5484d', borderColor: '#e5484d', color: '#fff' }}
onClick={() => setConfirmDel(true)}
>
  <Trash2 size={15} /> Delete logs
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
      {confirmDel && (
  <div
    className="modal-backdrop"
    onMouseDown={(e) => {
   if (e.target === e.currentTarget && !clearing) {
  setConfirmDel(false);
  setNoLogs(false);
}
    }}
  >
    <div className="modal logout-modal" role="dialog" aria-modal="true">
      <div className={`logout-content ${clearing ? 'logout-hide' : ''}`}>
  <div
    className="logout-icon"
    style={{ color: '#e5484d', background: 'rgba(229,72,77,.12)' }}
  >
    <Trash2 size={22} />
  </div>
  {noLogs ? (
    <>
      <h2>No logs found</h2>
      <p>There are no request logs to delete right now.</p>
      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setNoLogs(false);
            setConfirmDel(false);
          }}
        >
          OK
        </button>
      </div>
    </>
  ) : (
    <>
      <h2>Delete all logs?</h2>
      <p>Do you want to delete all request logs? This cannot be undone.</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setConfirmDel(false)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ background: '#e5484d', borderColor: '#e5484d', color: '#fff' }}
          onClick={doClear}
        >
          Delete
        </button>
      </div>
    </>
  )}
</div>
      {clearing && (
        <div className="logout-loading">
          <OrbitLoader color="#e5484d" />
          <p>Deleting logs…</p>
        </div>
      )}
    </div>
  </div>
)}
    </>
  );
}
function WinLoader({ color, size }: { color?: string; size?: number }) {
  return <OrbitLoader color={color} size={size} />;
}

  export function Tester() {
    const [method, setMethod] = useState('GET'),
      [url, setUrl] = useState(
        sessionStorage.getItem('sp_replay') || '',
      ),
      [tab, setTab] = useState('Params'),
      [params, setParams] = useState([{ key: '', value: '' }]),
      [headers, setHeaders] = useState([{ key: 'Accept', value: 'application/json' }]),
      [body, setBody] = useState(
        '{\n  "workspace_id": "ws_acme",\n  "include": ["status", "latency"]\n}',
      ),
      [auth, setAuth] = useState('None'),
      [token, setToken] = useState(''),
      [response, setResponse] = useState<any>(null),
      [loading, setLoading] = useState(false),
      [error, setError] = useState(''),
      [elapsed, setElapsed] = useState(0),
      [history, setHistory] = useState<string[]>(() =>
        JSON.parse(localStorage.getItem('sp_tester_history') || '[]'),
      );
    const send = async () => {
      setLoading(true);
      setError('');
      setResponse(null);
         const start = Date.now();
    const MIN_DELAY = 2000;
    try {
      const requestHeaders: Record<string, string> = {};
        headers.forEach((h) => {
          if (h.key) requestHeaders[h.key] = h.value;
        });
        if (auth === 'Bearer token' && token) requestHeaders.Authorization = `Bearer ${token}`;
        const query = new URLSearchParams();
        params.forEach((p) => {
          if (p.key) query.set(p.key, p.value);
        });
        const target = url + (query.size ? (url.includes('?') ? '&' : '?') + query.toString() : '');
        const res = await axios({
          url: target,
          method: method.toLowerCase(),
          headers: requestHeaders,
          data: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
          timeout: 15000,
        });
      setResponse(res);
      setElapsed(Date.now() - start);
      addRequest({
        method,
        path: target,
        status: res.status,
        duration: Date.now() - start,
      });
      const next = [`${method} ${url}`, ...history].slice(0, 8);
        setHistory(next);
        localStorage.setItem('sp_tester_history', JSON.stringify(next));
         } catch (e) {
      const ex = e as any;
      setElapsed(Date.now() - start);
      addRequest({
        method,
        path: url,
        status: ex.response?.status || 0,
        duration: Date.now() - start,
      });
        setError(
          ex.response
            ? `Request failed with status ${ex.response.status}.`
            : 'Network or CORS error. The destination may not allow browser requests. Check the URL and Access-Control-Allow-Origin policy.',
        );
        if (ex.response) setResponse(ex.response);
          } finally {
      const remaining = MIN_DELAY - (Date.now() - start);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setLoading(false);
    }
    };
    const snippet = `curl -X ${method} '${url}' \\\n  -H 'Accept: application/json'`;
    return (
      <>
        <Heading
          eyebrow="SEND REAL HTTP REQUESTS"
          title="API tester"
          desc="Try endpoints with real browser requests. CORS restrictions apply."
         
        />
        <div className="tester-layout">
          <div className="tester-main">
            <Card className="request-card">
              <div className="request-line">
              <Dropdown className="dd-method" ariaLabel="Request method" value={method}
  onChange={setMethod} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} />
                <input
                  className="request-url mono"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void send();
                  }}
                  aria-label="Request URL"
                  data-testid="input-request-url"
                />
                <Button
                  kind="primary"
                  onClick={send}
                  data-testid="button-send-request"
                  className="send-btn"
                >
{loading ? (
  <WinLoader
    size={16}
    color={document.documentElement.classList.contains('light') ? '#ffffff' : '#111111'}
  />
) : (
  <Send size={15} />
)} Send
                </Button>
              </div>
              <div className="request-tabs">
                {['Params', 'Headers', 'Authorization', 'Body'].map((t) => (
                  <button onClick={() => setTab(t)} className={tab === t ? 'selected' : ''} key={t}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="request-editor">
                {tab === 'Params' || tab === 'Headers' ? (
                  <>
                    <div className="editor-table-head">
                      <span>KEY</span>
                      <span>VALUE</span>
                      <span />
                    </div>
                    {(tab === 'Params' ? params : headers).map((p, i) => (
                      <div className="editor-row" key={i}>
                        <input
                          placeholder="Key"
                          value={p.key}
                          onChange={(e) => {
                            const arr = tab === 'Params' ? [...params] : [...headers];
                            arr[i] = { ...p, key: e.target.value };
                            tab === 'Params' ? setParams(arr) : setHeaders(arr);
                          }}
                        />
                        <input
                          placeholder="Value"
                          value={p.value}
                          onChange={(e) => {
                            const arr = tab === 'Params' ? [...params] : [...headers];
                            arr[i] = { ...p, value: e.target.value };
                            tab === 'Params' ? setParams(arr) : setHeaders(arr);
                          }}
                        />
                        <button
                          className="icon-btn"
                          aria-label="Remove row"
                          onClick={() =>
                            tab === 'Params'
                              ? setParams(params.filter((_, j) => j !== i))
                              : setHeaders(headers.filter((_, j) => j !== i))
                          }
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="add-row"
                      onClick={() =>
                        tab === 'Params'
                          ? setParams([...params, { key: '', value: '' }])
                          : setHeaders([...headers, { key: '', value: '' }])
                      }
                    >
                      <Plus size={14} /> Add {tab === 'Params' ? 'parameter' : 'header'}
                    </button>
                  </>
                ) : tab === 'Authorization' ? (
                  <div className="auth-editor">
                    <label>
                      Authorization type
                      <Dropdown value={auth} onChange={setAuth} options={['None', 'Bearer token']} />
                    </label>
                    {auth !== 'None' && (
                      <label>
                        Token
                        <input
                          type="password"
                          placeholder="Paste token"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="body-toolbar">
                     <Dropdown className="dd-w120" value="JSON" onChange={() => {}} options={['JSON', 'Text']} />
                      <span>application/json</span>
                    </div>
                    <textarea
                      className="body-editor mono"
                      spellCheck={false}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </>
                )}
              </div>
              <div className="request-foot">
                <span>
                  <Shield size={13} /> Requests are sent directly from your browser
                </span>
                <span>15s timeout</span>
              </div>
            </Card>
            <Card className="response-card">
              <div className="response-head">
                <div>
                  <h3>Response</h3>
                  <p>
                    {response
                      ? 'Received from endpoint'
                      : error
                        ? 'Request could not complete'
                        : 'Send a request to inspect the response'}
                  </p>
                </div>
                {response && (
                  <div className="response-meta">
                    <span className={`response-code ${response.status < 400 ? 'good' : 'bad'}`}>
                      {response.status} {response.statusText}
                    </span>
                    <span>
                      <Clock3 size={13} />
                      {elapsed} ms
                    </span>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="response-placeholder">
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-block" />
                  <span>Waiting for response…</span>
                </div>
              ) : error ? (
                <div className="request-error">
                  <div>
                    <CircleHelp size={17} />
                  </div>
                  <b>Request failed</b>
                  <p>{error}</p>
                </div>
              ) : response ? (
                <pre className="response-codeblock mono">
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              ) : (
                <div className="response-placeholder">
                  <div className="response-empty-icon">
                    <ArrowRight size={19} />
                  </div>
                  <b>Ready when you are</b>
                  <p>Browser access may depend on CORS settings.</p>
                </div>
              )}
            </Card>
          </div>
          <aside className="tester-side">
            <Card>
              <div className="card-head">
                <div>
                  <h3>History</h3>
                  <p>Recent requests from this browser</p>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Clear request history"
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('sp_tester_history');
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {history.length === 0 ? (
                <div className="history-empty">Your requests will show here.</div>
              ) : (
                history.map((h, i) => (
                  <button
                    className="history-item"
                    onClick={() => {
                      const [m, ...u] = h.split(' ');
                      setMethod(m);
                      setUrl(u.join(' '));
                    }}
                    key={`${h}-${i}`}
                  >
                    <span className={`method method-${h.split(' ')[0].toLowerCase()}`}>
                      {h.split(' ')[0]}
                    </span>
                    <span className="mono">{h.split(' ').slice(1).join(' ')}</span>
                    <ChevronRight size={13} />
                  </button>
                ))
              )}
            </Card>
            <Card className="tester-tip">
              <div className="tip-icon">
                <CircleHelp size={17} />
              </div>
              <b>Browser request note</b>
              <p>
                The tester sends real requests from this page. CORS failures are access-policy errors,
                not necessarily API availability.
              </p>
            </Card>
          </aside>
        </div>
      </>
    );
  }

type Svc = 'operational' | 'degraded' | 'outage';
interface StatusData {
  services: { name: string; status: Svc }[];
  uptime90: number | null;
  days: { date: string; status: 'up' | 'slow' | 'down' | 'none' }[];
  checkedAt: number;
}

const LABEL: Record<Svc, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  outage: 'Outage',
};
const DOT: Record<Svc, string> = { operational: 'good', degraded: 'warn', outage: 'bad' };



export function PublicStatus() {
  const navigate = useNavigate();
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState(false);
    const goBack = () => {
    // agar user seedha is page pe aaya (history nahi), to home pe bhejo
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  useEffect(() => {
    const load = () =>
      fetch(`${API}/api/public-status`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d) => { setData(d); setError(false); })
        .catch((e) => { console.error('status fetch failed:', e); setError(true); });
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

if (!data) {
  return (
    <div
      className="public-status"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <OrbitLoader color="currentColor" size={56} />
      <span style={{ fontSize: 14, letterSpacing: 0.3 }}>Loading</span>
    </div>
  );
}

  const hasOutage = data.services.some((s) => s.status === 'outage');
  const hasDegraded = data.services.some((s) => s.status === 'degraded');
  const headline = hasOutage
    ? 'Service disruption'
    : hasDegraded
      ? 'Some systems are degraded'
      : 'All systems operational';
  const sub = hasOutage
    ? 'We are investigating an issue.'
    : hasDegraded
      ? 'Some services are slower than usual.'
      : 'All services are operating normally.';

  return (
    <div className="public-status">
   <header>
  <div className="status-header-left">
    <Link to="/" className="status-back-link">
      <ArrowLeft size={15} /> Back
    </Link>
  
  </div>
  <Link className="status-back" to="/login">
    Workspace sign in <ArrowRight size={14} />
  </Link>
</header>

      <div className="public-status-content">
        <div className="public-status-head">
          <div className="status-big-icon">
            <Check size={25} />
          </div>
          <div className="eyebrow">EasyAPI SYSTEM STATUS</div>
          <h1>{headline}</h1>
          <p>{sub}</p>
          <span>
  Last updated{' '}
{new Date(data.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
  {error && ' (connection issue, showing last data)'}
</span>
        </div>

        <Card className="public-service-list">
          <div className="public-services-head">
            <b>Services</b>
            <span>Current status</span>
          </div>
          {data.services.map((s) => (
            <div className="public-service-row" key={s.name}>
              <span>{s.name}</span>
              <span>
                <i className={`status-dot ${DOT[s.status]}`} />
                {LABEL[s.status]}
              </span>
            </div>
          ))}
        </Card>

        <Card className="uptime-card">
          <div className="card-head">
            <div>
              <h3>Uptime over the past 90 days</h3>
              <p>
                Current uptime <b>{data.uptime90 === null ? '—' : `${data.uptime90}%`}</b>
              </p>
            </div>
          </div>
          <div className="uptime-bars public-bars">
          {[...data.days].reverse().map((d) => (
  <i key={d.date} className={d.status === 'up' ? 'up' : d.status} title={d.date} />
))}
          </div>
          <div className="uptime-range">
            <span>Today</span>
            <span>90 days ago</span>
          </div>
        </Card>
      </div>

      <footer className="public-status-foot">
        <span>
          Powered by <b>EasyAPI</b>
        </span>
      </footer>
    </div>
  );
}