import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState,type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Dropdown } from './components/ui/Dropdown';
import { onLive, startLive, stopLive } from './lib/live';
import { fetchTeam } from './lib/teamCache';
import { motion, AnimatePresence } from 'framer-motion';

import {
  useRealRequests,
  buildStats,
  deleteRequest,
  clearRequests,
  type RealRequest,
} from './lib/requestStore';
import {
  useApis,
  saveApi,
  toggleFavorite,
  deleteApi,
  parseImport,
  type EndpointItem,
  type ApiView,
} from './lib/apiStore';
import { useMonitor, useApiHistory, timeAgo } from './lib/monitorStore';
import axios, { type AxiosResponse } from 'axios';
import { showReadOnly } from './lib/readonly';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Box,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileClock,
  FileJson2,
  Filter,
  Globe2,
  Heart,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TerminalSquare,
  Trash2,
  UserRound,
  UsersRound,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { useInvites, useWorkspaces } from './lib/invites';
import { useResource } from './hooks/useResource';
import { useLiveAlerts } from './lib/liveAlerts';
import { service } from './services/mock';
import type { ApiRecord, AlertRecord, HealthCheck, LogRecord, Role, TeamMember } from './types';
import NotFound from './pages/not-found';
import './app.css';
import './app-extra.css';
import { OrbitLoader } from './components/ui/OrbitLoader';


const Analytics = lazy(() =>
  import('./pages/ExtraPages').then((page) => ({ default: page.Analytics })),
);
const Monitoring = lazy(() =>
  import('./pages/ExtraPages').then((page) => ({ default: page.Monitoring })),
);

const Alerts = lazy(() => import('./pages/ExtraPages').then((page) => ({ default: page.Alerts })));
const Team = lazy(() => import('./pages/ExtraPages').then((page) => ({ default: page.Team })));

const GenericPage = lazy(() =>
  import('./pages/ExtraPages').then((page) => ({ default: page.GenericPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/ExtraPages').then((page) => ({ default: page.SettingsPage })),
);
const Tester = lazy(() => import('./pages/ExtraPages').then((page) => ({ default: page.Tester })));
const PublicStatus = lazy(() =>
  import('./pages/ExtraPages').then((page) => ({ default: page.PublicStatus })),
);

type IconType = typeof Activity;
const navGroups: { label: string; items: { label: string; path: string; icon: IconType }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
      { label: 'API inventory', path: '/apis', icon: Box },
      { label: 'API tester', path: '/tester', icon: TerminalSquare },
      { label: 'Request logs', path: '/logs', icon: FileClock },
      { label: 'Analytics', path: '/analytics', icon: Activity },
      { label: 'Monitoring', path: '/monitoring', icon: Radio },
    ],
  },
  {
    label: 'Manage',
    items: [
      
      { label: 'Alerts', path: '/alerts', icon: Bell },
      { label: 'Team', path: '/team', icon: UsersRound },
      
      
    ],
  },
  {
    label: 'Resources',
    items: [
      { label: 'Documentation', path: '/docs', icon: BookOpen },
      
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];
const pageTitles: Record<string, string> = {
  dashboard: 'Overview',
  apis: 'API inventory',
  tester: 'API tester',
  logs: 'Request logs',
  analytics: 'Analytics',
  monitoring: 'Monitoring',
  keys: 'Access keys',
  alerts: 'Alerts',
  team: 'Team',
  
  docs: 'Documentation',
  billing: 'Billing',
  settings: 'Settings',
  profile: 'My profile',
};
const greeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};
const displayName = (u: { name: string; email: string }) =>
  u.name || (u.email ? u.email.split('@')[0] : 'there');
const initials = (n: string) =>
  n.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const Button = ({
  children,
  onClick,
  kind = 'secondary',
  className = '',
  type = 'button',
  disabled = false,                 // 1. destructure mein
  'data-testid': testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  'data-testid'?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;               // 2. type mein
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}             // 3. asli <button> par
    data-testid={testId}
    className={`btn btn-${kind} ${className}`}
  >
    {children}
  </button>
);
export function Logo({ small = false }: { small?: boolean }) {
  const size = small ? 30 : 35;

  return (
    <div className="brand">
      <svg
        width={size}
        height={size}
        viewBox="25 25 295 280"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="EasyAPI logo"
        role="img"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="easyapi-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b57bff" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="easyapi-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9a52f2" />
            <stop offset="1" stopColor="#5b1fb5" />
          </linearGradient>
          <linearGradient id="easyapi-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8d3fe8" />
            <stop offset="1" stopColor="#4c1695" />
          </linearGradient>
          <linearGradient id="easyapi-d" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#6d28d9" />
            <stop offset="1" stopColor="#b57bff" />
          </linearGradient>
        </defs>

        {/* spine bands */}
        <path fill="url(#easyapi-a)" d="M168 36 C98 48 38 95 38 162 C38 208 62 244 102 266 C68 228 60 186 72 140 C86 90 124 54 168 36Z" />
        <path fill="url(#easyapi-b)" d="M200 46 C140 58 90 100 81 150 C76 192 90 226 122 250 C104 216 101 180 111 145 C123 104 156 66 200 46Z" />

        {/* top bar */}
        <path fill="url(#easyapi-a)" d="M138 82 C165 50 230 38 304 34 C286 58 225 66 138 84Z" />
        <path fill="url(#easyapi-b)" d="M126 108 C136 88 190 80 240 76 C264 74 288 64 300 48 C292 82 256 96 215 96 C175 96 146 98 126 108Z" />

        {/* middle swoosh + arrow */}
        <path fill="url(#easyapi-b)" d="M60 210 C92 164 165 180 216 154 L244 174 C196 204 125 198 76 228Z" />
        <path fill="url(#easyapi-c)" d="M78 240 C112 204 178 212 238 182 L254 196 C198 234 136 226 98 256Z" />
        <path fill="url(#easyapi-a)" d="M276 128 L210 150 L252 192Z" />

        {/* bottom bar */}
        <path fill="url(#easyapi-d)" d="M106 232 C124 266 165 280 215 280 C256 279 286 268 297 242 C268 256 235 256 200 252 C160 248 124 242 106 232Z" />
        <path fill="url(#easyapi-c)" d="M96 264 C130 296 185 304 225 300 C264 296 290 282 300 262 C276 280 240 290 205 290 C160 290 120 280 96 264Z" />
      </svg>

      {!small && (
        <span>
          Easy<span>API</span>
        </span>
      )}
    </div>
  );
}
function StatusPill({ children, tone }: { children: string; tone?: string }) {
  return (
    <span className={`status-pill ${tone || children.toLowerCase()}`}>
      <i />
      {children}
    </span>
  );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel card ${className}`}>{children}</section>;
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
function ProfileCard({
  label,
  value,
  note,
  editing,
  draft,
  placeholder,
  onEdit,
  onCancel,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  note?: string;
  editing: boolean;
  draft: string;
  placeholder: string;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Card className="generic-card profile-card">
      <div className="generic-icon">
        <UserRound size={17} />
      </div>
      <div className="generic-content">
        <h3>{label}</h3>
        {editing ? (
          <form
            className="profile-edit"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <input
              autoFocus
              required
              value={draft}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="profile-edit-actions">
              <Button onClick={onCancel}>Cancel</Button>
              <Button kind="primary" type="submit">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p>{value}</p>
            {note && <span>{note}</span>}
          </>
        )}
      </div>
      {!editing && (
        <button
          className="icon-btn profile-edit-btn"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
        >
          <Pencil size={15} />
        </button>
      )}
    </Card>
  );
}
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-wrap">
      <div className="code-bar">
        <button
          type="button"
          className="code-copy"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="mono"
        style={{
          margin: 0,
          padding: '16px 18px',
          overflowX: 'auto',
          fontSize: 13,
          lineHeight: 1.7,
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          background: 'hsl(var(--background))',
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function DocsPage() {
  const [open, setOpen] = useState('start');

  const guides = [
    { id: 'start', title: 'Getting started', copy: 'Add an API, send your first request, and see traffic arrive.' },
    { id: 'auth', title: 'Authentication', copy: 'How login, tokens and password reset work in EasyAPI.' },
    { id: 'import', title: 'Import & export', copy: 'Move your API inventory in and out using JSON files.' },
  ];

  const h = { margin: '22px 0 6px', fontSize: 16 } as const;
  const p = { margin: '0 0 8px', color: 'hsl(var(--muted-foreground))', lineHeight: 1.7 } as const;

  return (
    <>
      <PageHeading
        eyebrow="REFERENCE & GUIDES"
        title="Documentation"
        description="A clear guide to working with APIs in this workspace."
        action={
          <Link to="/tester" className="btn btn-primary">
            <TerminalSquare size={15} /> Open tester
          </Link>
        }
      />

      <div className="generic-grid">
        {guides.map((g) => (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(g.id)}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(g.id)}
            style={{ cursor: 'pointer' }}
          >
            <Card
              className={`generic-card ${open === g.id ? 'docs-active' : ''}`}
            >
              <div className="generic-icon">
                <BookOpen size={17} />
              </div>
              <div className="generic-content">
                <h3>{g.title}</h3>
                <p>{g.copy}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <Card className="docs-body" >
        {open === 'start' && (
          <>
            <h2 style={{ margin: 0 }}>Getting started</h2>
            <p style={p}>Four steps from empty workspace to live monitoring.</p>

            <h3 style={h}>1. Add an API</h3>
            <p style={p}>
              Go to <b>API inventory</b> → <b>Add API</b>. Enter a service name and a public
              http(s) base URL. Private addresses like localhost are blocked from monitoring.
            </p>
            <CodeBlock code={'Name:      Posts API\nBase URL:  https://jsonplaceholder.typicode.com'} />

            <h3 style={h}>2. Send a request</h3>
            <p style={p}>
              Open <b>API tester</b>, pick a method, paste a URL and send. Every request is saved
              to your account with its status and duration.
            </p>
            <CodeBlock code={'GET https://jsonplaceholder.typicode.com/posts/1'} />

            <h3 style={h}>3. Watch the signals</h3>
            <p style={p}>
              <b>Dashboard</b> shows traffic and service health. <b>Request logs</b> lists every
              call and can be filtered by method or status. <b>Monitoring</b> pings your APIs every
              15, 30 or 60 seconds and records incidents.
            </p>

            <h3 style={h}>4. Get alerted</h3>
            <p style={p}>
              A 5xx or network error raises a <b>Critical</b> alert. More than 30% failures in the
              last 10 requests raises a <b>Warning</b>. Average latency above 1000 ms raises an{' '}
              <b>Info</b> alert. The bell blinks until you open the Alerts page.
            </p>
            <CodeBlock code={'GET https://httpbin.org/status/500   # Critical alert'} />
          </>
        )}

        {open === 'auth' && (
          <>
            <h2 style={{ margin: 0 }}>Authentication</h2>
            <p style={p}>
              EasyAPI uses JWT tokens. Sign in once and the token is sent with every request.
            </p>

            <h3 style={h}>Sign in</h3>
            <CodeBlock
              code={`curl -X POST ${API}/api/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d '{"email":"you@example.com","password":"your-password"}'`}
            />
            <p style={p}>The response contains a <b>token</b> that stays valid for 7 days.</p>

            <h3 style={h}>Use the token</h3>
            <CodeBlock
              code={`curl ${API}/api/auth/me \\\n  -H "Authorization: Bearer <your-token>"`}
            />

            <h3 style={h}>Forgot password</h3>
            <p style={p}>
              Enter your email on the sign-in page. A 6-digit code is sent to you and expires in
              10 minutes. After 5 wrong attempts you must request a new code.
            </p>

            <h3 style={h}>Good to know</h3>
            <p style={p}>
              Passwords are stored hashed, and your data (APIs, requests, alerts) is visible only
              to your account.
            </p>
          </>
        )}

        {open === 'import' && (
          <>
            <h2 style={{ margin: 0 }}>Import & export</h2>
            <p style={p}>
              Use <b>Export</b> on the API inventory page to download your services as JSON, and{' '}
              <b>Import</b> to load them back or bring in an OpenAPI, Swagger or Postman file.
            </p>

            <h3 style={h}>Export format</h3>
            <CodeBlock
              code={`{
  "app": "EasyAPI",
  "type": "api-inventory",
  "apis": [
    {
      "name": "Posts API",
      "baseUrl": "https://jsonplaceholder.typicode.com",
      "description": "Fake REST API",
      "endpoints": [
        { "method": "GET", "path": "/posts", "summary": "List posts" }
      ]
    }
  ]
}`}
            />

            <h3 style={h}>Tips</h3>
            <p style={p}>
              The file must be valid JSON. Imported endpoints appear in the Endpoints tab of each
              API, and each one has a button that opens it in the tester.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
function ProfilePage() {
  const { user, setUser, workspace, setWorkspace } = useAuth();
  const [editing, setEditing] = useState<'' | 'name' | 'display' | 'workspace'>('');
  const [nameDraft, setNameDraft] = useState('');
  const [wsDraft, setWsDraft] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [avatar, setAvatar] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };
  const authCfg = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
  });
  const fail = (e: unknown) =>
    setErr(
      axios.isAxiosError(e)
        ? e.response?.data?.message || 'Could not reach the server'
        : 'Something went wrong',
    );
    const syncAvatar = (a: string) => {   // <- yahan paste karo
  setAvatar(a);
  window.dispatchEvent(new CustomEvent('sp-avatar-changed', { detail: a }));
};
  // Page khulte hi backend se photo lao
  useEffect(() => {
    axios
      .get(`${API}/api/auth/me`, authCfg())
      .then(({ data }) => syncAvatar(data.user.avatar || ''))
      .catch(() => {});
  }, []);

  const saveProfile = async (patch: { name?: string; workspace?: string; avatar?: string }) => {
    setErr('');
    setMsg('');
    try {
      const { data } = await axios.put(`${API}/api/auth/profile`, patch, authCfg());
      const u = { name: data.user.name || '', email: data.user.email };
      localStorage.setItem('sp_user', JSON.stringify(u));
      localStorage.setItem('sp_workspace', data.user.workspace);
      setUser(u);
      setWorkspace(data.user.workspace);
      syncAvatar(data.user.avatar || '');
      setEditing('');
      flash('Profile updated');
    } catch (e) {
      fail(e);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setErr('');
    if (!file.type.startsWith('image/')) return setErr('Please choose an image file');
    if (file.size > 3 * 1024 * 1024) return setErr('Image must be under 3 MB');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await axios.post(`${API}/api/auth/avatar`, fd, authCfg());
      syncAvatar(data.user.avatar || '');
      flash('Photo updated');
    } catch (e) {
      fail(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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
    // request aur 3 sec ka minimum delay saath chalenge
    await Promise.all([
      axios.put(`${API}/api/auth/password`, { password: pw, confirm: pw2 }, authCfg()),
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

  const fullName = displayName(user);
  const startNameEdit = (which: 'name' | 'display') => {
    setNameDraft(user.name || '');
    setEditing(which);
  };
const initials = (fullName || user.email || '?')
  .split(/[\s@._-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0])
  .join('')
  .toUpperCase();

  return (
    <>
      <PageHeading
        eyebrow="PERSONAL ACCOUNT"
        title="My profile"
        description="Your identity and preferences for this workspace."
      />
      {msg && (
        <div className="notice">
          <Check size={16} />
          {msg}
        </div>
      )}
      {err && (
        <div className="notice" style={{ color: '#e5736f', borderColor: 'rgba(229,115,111,.35)' }}>
          {err}
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
      <Card className="profile-photo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              fontWeight: 700,
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
  <UserRound size={30} />
)}
          </span>
          <div>
            <h3>Profile photo</h3>
            
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
  {uploading ? <OrbitLoader size={16} /> : null}
  {uploading ? ' Uploading' : avatar ? 'Change photo' : 'Upload photo'}
</Button>
              {avatar && !uploading && (
  <button
    type="button"
    className="btn btn-secondary"
    style={{ background: '#e5484d', borderColor: '#e5484d', color: '#fff' }}
    onClick={() => saveProfile({ avatar: '' })}
  >
    Remove
  </button>
)}
            </div>
          </div>
        </div>
      </Card>
      </div>

      <div className="generic-grid">
        <ProfileCard
          label="Full name"
          value={fullName}
          note={`${user.email}`}
          editing={editing === 'name'}
          draft={nameDraft}
          placeholder="Your name"
          onEdit={() => startNameEdit('name')}
          onCancel={() => setEditing('')}
          onChange={setNameDraft}
          onSave={() => saveProfile({ name: nameDraft })}
        />
        <ProfileCard
          label="Display name"
          value={fullName}
          note="Visible to workspace members"
          editing={editing === 'display'}
          draft={nameDraft}
          placeholder="Your name"
          onEdit={() => startNameEdit('display')}
          onCancel={() => setEditing('')}
          onChange={setNameDraft}
          onSave={() => saveProfile({ name: nameDraft })}
        />
        <ProfileCard
          label="Workspace"
          value={workspace}
          note="Your current workspace"
          editing={editing === 'workspace'}
          draft={wsDraft}
          placeholder="Workspace name"
          onEdit={() => {
            setWsDraft(workspace);
            setEditing('workspace');
          }}
          onCancel={() => setEditing('')}
          onChange={setWsDraft}
          onSave={() => saveProfile({ workspace: wsDraft })}
        />
      </div>

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
              onChange={(e) => setPw2(e.target.value)}
            />
          </label>
<Button kind="primary" type="submit" disabled={pwBusy} className="pw-btn">
  {pwBusy && <OrbitLoader size={16} />}
  {pwBusy ? 'Updating' : 'Update password'}
</Button>
        </form>
      </Card>
    </>
  );
}
function App() {
  const [theme, setTheme] = useState(localStorage.getItem('sp_theme') || 'dark');
  const [authed, setAuthed] = useState(localStorage.getItem('sp_demo_auth') === 'yes');
  const [role, setRole] = useState<Role>((localStorage.getItem('sp_role') as Role) || 'Owner');
  const [user, setUser] = useState<{ name: string; email: string }>(() => {
  try {
    return JSON.parse(localStorage.getItem('sp_user') || '');
  } catch {
    return { name: '', email: '' };
  }
});
  const [workspace, setWorkspace] = useState(
    localStorage.getItem('sp_workspace') || 'Acme Engineering',
  );
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('sp_theme', theme);
  }, [theme]);
  useEffect(() => {
    const onTheme = (event: Event) => setTheme((event as CustomEvent<string>).detail);
    const onRole = (event: Event) => setRole((event as CustomEvent<Role>).detail);
    window.addEventListener('sp-theme-changed', onTheme);
    window.addEventListener('sp-role-changed', onRole);
    return () => {
      window.removeEventListener('sp-theme-changed', onTheme);
      window.removeEventListener('sp-role-changed', onRole);
    };
  }, []);
    const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!authed) {
      setSynced(false);
      return;
    }
    let alive = true;
const sync = async () => {
  try {
    const { data } = await axios.get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sp_token')}` },
    });
    if (!alive) return;
    const u = {
      name: data.user.name || '',
      email: data.user.email || '',
      avatar: data.user.avatar || '',
    };
    localStorage.setItem('sp_user', JSON.stringify(u));
    localStorage.setItem('sp_workspace', data.user.workspace);
    setUser(u);
    setWorkspace(data.user.workspace);
    if (data.user.role) {
      setRole(data.user.role);
      localStorage.setItem('sp_role', data.user.role);
    }
    // Agar owner ne member ko hata diya ya link toot gaya, to apne workspace mein wapas bhejo
    const prevView = localStorage.getItem('sp_view') || '';
    const nextView = data.user.viewId || '';
    localStorage.setItem('sp_view', nextView);
    localStorage.setItem('sp_viewname', data.user.viewName || '');
    if (prevView !== nextView) {
      window.location.href = '/dashboard';
      return;
    }
    if (data.user.prefs?.theme) setTheme(data.user.prefs.theme);
    setSynced(true);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 401) {
      localStorage.removeItem('sp_demo_auth');
      localStorage.removeItem('sp_token');
      localStorage.removeItem('sp_user');
      setAuthed(false);
    }
  }
};
    startLive();
    const off = onLive(sync);
    sync();
    const t = setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    return () => {
      alive = false;
      off();
      stopLive();
      clearInterval(t);
      window.removeEventListener('focus', sync);
    };
  }, [authed]);
  useEffect(() => {
    if (!authed || !synced) return;
    axios
      .put(
        `${API}/api/auth/prefs`,
        { theme },
        { headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` } },
      )
      .catch(() => {});
  }, [theme, authed, synced]);
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <BrowserRouter>
      <AuthContextProvider
        value={{ authed, setAuthed, role, setRole, theme, setTheme, workspace, setWorkspace, user, setUser }}
      >
        <Suspense fallback={<Loading label="Loading page" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
           <Route path="/login" element={<AuthPage key="login" mode="login" />} />
           <Route path="/register" element={<AuthPage key="register" mode="register" />} />
           <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
          <Route path="/reset-password" element={<AuthPage key="reset" mode="reset" />} />
            <Route path="/status" element={<PublicStatus />} />
            <Route element={<Protected />}>
              <Route element={<Shell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/apis" element={<Apis />} />
                <Route path="/apis/:id" element={<ApiDetail />} />
                <Route path="/tester" element={<Tester />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/monitoring" element={<Monitoring />} />
                
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/team" element={<Team />} />
                
                
<Route path="/docs" element={<DocsPage />} />

                <Route path="/billing" element={<GenericPage page="billing" />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthContextProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
export default App;
type AuthValue = {
  authed: boolean;
  setAuthed: (v: boolean) => void;
  role: Role;
  setRole: (v: Role) => void;
  theme: string;
  setTheme: (v: string) => void;
  user: { name: string; email: string };
  setUser: (v: { name: string; email: string }) => void;
  workspace: string;
  setWorkspace: (v: string) => void;
};
import { createContext, useContext } from 'react';
const AuthContext = createContext<AuthValue | null>(null);
function AuthContextProvider({ value, children }: { value: AuthValue; children: React.ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('Auth provider missing');
  return v;
}
function Protected() {
  const { authed } = useAuth();
  const loc = useLocation();
  return authed ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
}
import { Outlet } from 'react-router-dom';
// Viewer: har button block (sirf safe cheezein chalengi), click hote hi message
// Viewer: har button aur dropdown block (sirf safe cheezein chalengi), click hote hi message
function useReadOnlyGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
const free = () =>
  !localStorage.getItem('sp_view') ||
  ['/profile', '/docs'].some((p) => location.pathname.startsWith(p));

    // ---- buttons ----
    const SAFE_BTN = [
      '.detail-tabs button', // tabs
      '[aria-label*="Refresh" i]', // refresh
      '[aria-label="Close"]', // popup band karna
      '[aria-label^="Open "]', // API card kholna
'.dash-switch', // My Dashboard / Show dashboard
].join(',');

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('button, [role="button"]') as HTMLElement | null;
      if (!el || !el.closest('.main-content') || free()) return;
      if (el.matches(SAFE_BTN) || /^(close|cancel)$/i.test((el.textContent || '').trim())) return;
      e.preventDefault();
      e.stopPropagation();
      showReadOnly();
    };

    // ---- dropdowns / checkbox / radio ----

    const fieldOf = (t: EventTarget | null) =>
      (t as HTMLElement | null)?.closest?.(
        'select, input[type="checkbox"], input[type="radio"]',
      ) as HTMLElement | null;

    const blockField = (e: Event) => {
      const el = fieldOf(e.target);
      if (!el || !el.closest('.main-content') || free()) return;
      e.preventDefault(); // dropdown khulega hi nahi
      e.stopPropagation();
      showReadOnly();
    };
    const blockFieldKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Escape') return;
      blockField(e);
    };

    const onSubmit = (e: Event) => {
      if (!(e.target as HTMLElement).closest('.main-content') || free()) return;
      e.preventDefault();
      e.stopPropagation();
      showReadOnly();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('mousedown', blockField, true);
    document.addEventListener('keydown', blockFieldKey, true);
    document.addEventListener('change', blockField, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mousedown', blockField, true);
      document.removeEventListener('keydown', blockFieldKey, true);
      document.removeEventListener('change', blockField, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [enabled]);
}
function WsAvatar({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img className="ws-avatar ws-photo" src={src} alt="" />
  ) : (
    <span className="ws-avatar">{initials(name)}</span>
  );
}
function WorkspaceSwitcher({
  workspaces,
  viewId,
  onSwitch,
}: {
  workspaces: { id: string; owner: string; name: string; role: string; avatar?: string }[];
  viewId: string;
  onSwitch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

   const items: { id: string; title: string; sub: string; avatar?: string }[] = [
    { id: '', title: 'My workspace', sub: 'Your own APIs and data' },
    ...workspaces.map((w) => ({
      id: w.id,
      title: w.owner,
      sub: w.name,
      avatar: w.avatar,
    })),
  ];
  const cur = items.find((i) => i.id === viewId) || items[0];

  return (
    <div className="ws-menu" ref={ref}>
      <button
        type="button"
        className={`ws-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Switch workspace"
        aria-expanded={open}
      >
        {cur.id && <WsAvatar src={cur.avatar} name={cur.title} />}
        <span className="ws-text">
          <b>{cur.title}</b>
          <small>{cur.sub}</small>
        </span>
        <ChevronDown size={16} className="ws-chevron" />
      </button>
      {open && (
        <div className="ws-list" role="listbox">
          {items.map((i) => (
            <button
              type="button"
              key={i.id || 'me'}
              role="option"
              aria-selected={i.id === viewId}
              className={`ws-item ${i.id === viewId ? 'active' : ''}`}
              onClick={() => {
                setOpen(false);
                if (i.id !== viewId) onSwitch(i.id);
              }}
            >
              {i.id && <WsAvatar src={i.avatar} name={i.title} />}
              <span className="ws-text">
                <b>{i.title}</b>
                <small>{i.sub}</small>
              </span>
              
              {i.id === viewId && <Check size={15} className="ws-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function Shell() {
  const { workspace, setWorkspace, theme, setTheme, role, setAuthed, user } = useAuth();
  useReadOnlyGuard(role === 'Viewer');
  const loc = useLocation();
  const navigate = useNavigate();

  const { alerts: liveAlerts, seen, markSeen } = useLiveAlerts();
  const openAlertCount = liveAlerts.filter((a) => !a.acknowledged).length;
  const unseenCount = liveAlerts.filter((a) => !a.acknowledged && !seen.includes(a.id)).length;
  const { invites, respond } = useInvites();
const [bellOpen, setBellOpen] = useState(false);
const bellRef = useRef<HTMLDivElement>(null);
const hasDot = unseenCount > 0 || invites.length > 0;
  useEffect(() => {
    if (loc.pathname === '/alerts' && unseenCount > 0) markSeen(liveAlerts.map((a) => a.id));
  }, [loc.pathname, unseenCount, liveAlerts, markSeen]);

  const [mobile, setMobile] = useState(false);
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
const [loggingOut, setLoggingOut] = useState(false);
const [avatar, setAvatar] = useState('');

  const key = loc.pathname.split('/')[1] || 'dashboard';
  const { workspaces } = useWorkspaces();
  useEffect(() => {
  fetchTeam();
  return onLive(fetchTeam);
}, []);
useEffect(() => {
  if (!bellOpen) return;

  const onDown = (e: MouseEvent) => {
    if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
      setBellOpen(false);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setBellOpen(false);
  };

  document.addEventListener('mousedown', onDown);
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('keydown', onKey);
  };
}, [bellOpen]);
const viewId = localStorage.getItem('sp_view') || '';
const viewName = localStorage.getItem('sp_viewname') || '';
const switchTo = (id: string) => {
  const w = workspaces.find((x) => x.id === id);
  localStorage.setItem('sp_view', id);
  localStorage.setItem('sp_viewname', w ? w.owner : '');
  window.location.href = '/dashboard';
};
  const title =
    key === 'apis' && loc.pathname !== '/apis' ? 'API details' : pageTitles[key] || 'Workspace';

const logout = () => setConfirmOut(true);
useEffect(() => {
  // MongoDB se photo lao (har refresh par)
  axios
    .get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
    })
    .then(({ data }) => setAvatar(data.user.avatar || ''))
    .catch(() => {});

  // ProfilePage upload/remove kare to turant update (sirf memory mein, storage nahi)
  const h = (e: Event) => setAvatar((e as CustomEvent<string>).detail || '');
  window.addEventListener('sp-avatar-changed', h);
  return () => window.removeEventListener('sp-avatar-changed', h);
}, []);
const doLogout = () => {
  setLoggingOut(true);
  setTimeout(() => {
    localStorage.removeItem('sp_demo_auth');
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    localStorage.removeItem('sp_viewname');
        localStorage.removeItem('sp_viewname');
    localStorage.removeItem('sp_view');
    window.location.replace('/');
  }, 3000);
};

  return (
      <div className="app-shell">
      <div
        className={`sidebar-backdrop ${mobile ? 'show' : ''}`}
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <div className="side-top">
        <Link to="/" aria-label="EasyAPI home" onClick={() => setMobile(false)}>
  <Logo />
</Link>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="workspace-switch"
          onClick={() => setWorkspaceMenu(!workspaceMenu)}
          data-testid="button-workspace-switch"
        >
          <span className="workspace-avatar">{(workspace[0] || 'W').toUpperCase()}</span>
          <span className="workspace-label">
            <b>{workspace}</b>
            
          </span>
    
        </button>
{workspaces.length > 0 && (
  <WorkspaceSwitcher workspaces={workspaces} viewId={viewId} onSwitch={switchTo} />
)}

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active =
                  loc.pathname === item.path ||
                  (item.path === '/apis' && loc.pathname.startsWith('/apis/'));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobile(false)}
                    className={`nav-link ${active ? 'active' : ''}`}
                    data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                    {item.label === 'Alerts' && openAlertCount > 0 && <i className="nav-count">{openAlertCount}</i>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          
    
<button
  className="user-menu"
  onClick={() => {
    setMobile(false);
    logout();
  }}
  data-testid="button-logout"
  aria-label="Log out"
>
            <LogOut size={17} />
            <span>
              <b>Log out</b>
            </span>
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{title}</b>
          </div>
          <div className="top-actions">
            {viewId && (
  <button
    className="view-pill"
    onClick={() => switchTo('')}
    title="Back to my workspace"
  >
    <span className="view-pill-avatar">{initials(viewName || 'U')}</span>
    <span className="view-pill-text">
      {viewName || 'Workspace'} 
    </span>
    <X size={13} />
  </button>
)}
            <span className={`live-label ${viewId ? 'live-hide' : ''}`}>
              <i className="pulse-dot" /> All systems operational
            </span>
            
            <button
              className="icon-btn theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              data-testid="button-theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
<div className="bell-wrap" ref={bellRef}>
  <button
    className="icon-btn bell-btn"
    aria-label="Notifications"
    onClick={() => setBellOpen((o) => !o)}
  >
    <Bell size={17} />
    {hasDot && <i className="bell-blink" />}
  </button>
  {bellOpen && (
    <div className="bell-panel">
      <div className="bell-panel-title">Notifications</div>
      {invites.length === 0 && openAlertCount === 0 && (
        <p className="bell-empty">You're all caught up.</p>
      )}
      {invites.map((inv) => (
        <div className="bell-item" key={inv.id}>
          <div className="bell-head">
            <span className="bell-avatar">{initials(inv.from)}</span>
            <span>
              <b>{inv.from}</b> invited you to join <b>{inv.workspace}</b> as {inv.role}
            </span>
          </div>
          <div className="bell-actions">
            <Button onClick={() => respond(inv.id, 'decline')}>Decline</Button>
            <Button
              kind="primary"
              onClick={async () => {
                const r = await respond(inv.id, 'accept');
                if (r) {
                  if (r.owner) localStorage.setItem('sp_view', r.owner);
                  window.location.href = '/dashboard';
                }
              }}
            >
              Accept
            </Button>
          </div>
        </div>
      ))}
      {openAlertCount > 0 && (
        <Link to="/alerts" className="bell-item" onClick={() => setBellOpen(false)}>
          <span>
            <b>{openAlertCount}</b> open alert{openAlertCount > 1 ? 's' : ''} <ArrowRight size={13} />
          </span>
        </Link>
      )}
    </div>
  )}
</div>
            <button className="icon-btn" onClick={logout} aria-label="Log out">
              <LogOut size={17} />
            </button>
          <button className="avatar-btn" onClick={() => navigate('/profile')} aria-label="My profile">
  {avatar ? (
    <img
      src={avatar}
      alt="Profile"
      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
    />
  ) : (
    initials(displayName(user))
  )}
</button>
          </div>
        </header>
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="app-footer">
          <span>EasyAPI</span>
          
        </footer>
      </div>
{confirmOut && (
  <div
    className="modal-backdrop"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget && !loggingOut) setConfirmOut(false);
    }}
  >
    <div className="modal logout-modal" role="dialog" aria-modal="true">
      <div className={`logout-content ${loggingOut ? 'logout-hide' : ''}`}>
        <div className="logout-icon">
          <LogOut size={22} />
        </div>
        <h2>Log out?</h2>
        <p>Do you want to log out of your workspace?</p>
        <div className="modal-actions">
          <Button onClick={() => setConfirmOut(false)}>Cancel</Button>
          <Button kind="primary" onClick={doLogout} data-testid="button-confirm-logout">
            Confirm
          </Button>
        </div>
      </div>
      {loggingOut && (
        <div className="logout-loading">
          <WinLoader />
          <p>Signing you out…</p>
        </div>
      )}
      
    </div>
  </div>
)}
    </div>
  );
}

function Landing() {
  const { authed, theme, setTheme } = useAuth();
const [menuOpen, setMenuOpen] = useState(false);
useEffect(() => {
  if (!menuOpen) return;
  const close = (e: MouseEvent | TouchEvent) => {
    const t = e.target as HTMLElement;
    // menu ke andar ya hamburger pe click ho toh kuch mat karo
    if (t.closest('.landing-nav nav') || t.closest('.nav-toggle')) return;
    setMenuOpen(false);
  };
  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setMenuOpen(false);
  };
  document.addEventListener('mousedown', close);
  document.addEventListener('touchstart', close);
  document.addEventListener('keydown', esc);
  return () => {
    document.removeEventListener('mousedown', close);
    document.removeEventListener('touchstart', close);
    document.removeEventListener('keydown', esc);
  };
}, [menuOpen]);
  return (
    <div className="landing">
      <header className="landing-nav">
  <Link to="/">
    <Logo />
  </Link>
  <nav className={menuOpen ? 'open' : ''} onClick={() => setMenuOpen(false)}>
    <a href="#product">Product</a>
    <a href="#workflow">How it works</a>
    <Link to="/status">System status</Link>
    <Link className="nav-mobile-only" to={authed ? '/dashboard' : '/login'}>
      {authed ? 'Open workspace' : 'Log in'}
    </Link>
  </nav>
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <button
      className="icon-btn theme-toggle"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      data-testid="button-theme-landing"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
<Link
  className={authed ? 'btn btn-primary' : 'landing-login'}
  to={authed ? '/dashboard' : '/login'}
>
  {authed ? <>Open workspace <ArrowRight size={15} /></> : 'Log in'}
</Link>
{!authed && (
  <Link className="btn btn-primary" to="/register">
    Start free <ArrowRight size={15} />
  </Link>
)}
    <button
      className="icon-btn nav-toggle"
      onClick={() => setMenuOpen(!menuOpen)}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
    >
      {menuOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  </div>
</header>
      <section className="hero app-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> API operations, in sync
          </div>
          <h1>
            Know your APIs.
            <br />
            <span>Trust every request.</span>
          </h1>
          <p>
            One clear view of your API inventory, traffic, uptime, and access. 
            <br />Built for teams who
            ship the interfaces their business runs on.
          </p>
          <div className="hero-actions">
           <Link className="btn btn-primary btn-large" to={authed ? '/dashboard' : '/register'}>
  Open your workspace <ArrowRight size={17} />
</Link>
            <Link to="/status" className="hero-secondary">
              <Play size={14} /> View live status
            </Link>
          </div>
          
        </div>
        <div className="hero-visual">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="visual-center">
            <div className="visual-mark">
              <Activity size={33} />
            </div>
            <div className="visual-center-label">
              API HEALTH <b>99.98%</b>
            </div>
          </div>
          <div className="float-card float-a">
            <span className="float-icon cyan">
              <Zap size={15} />
            </span>
            <div>
              <small>REQUESTS / 24H</small>
              <b>
                2.84M <em>+12.8%</em>
              </b>
            </div>
          </div>
          <div className="float-card float-b">
            <span className="status-dot good" />
            <div>
              <small>CORE PLATFORM</small>
              <b>Operational</b>
            </div>
            <span className="mono">84ms</span>
          </div>
          <div className="float-card float-c">
            <span className="float-icon violet">
              <Braces size={15} />
            </span>
            <div>
              <small>API INVENTORY</small>
              <b>14 services</b>
            </div>
          </div>
          <div className="visual-vertical">OBSERVABILITY / 01</div>
        </div>
      </section>

      <section className="landing-section" id="product">
        <div className="section-intro">
          <div className="eyebrow">A dependable command center</div>
          <h2>
            Everything around your API.
            <br />
            <span>Nothing in your way.</span>
          </h2>
          <p>From the first request to the thousandth deploy, the important signal stays close.</p>
        </div>
        <div className="feature-grid">
          <Feature
            n="01"
            icon={<Box />}
            title="An inventory that stays current"
            text="Keep endpoints, owners, environments, and docs together. Your API map should reflect how your team actually works."
          />
          <Feature
            n="02"
            icon={<Activity />}
            title="Traffic with useful context"
            text="Find the slow request, compare regions, and see what changed without digging through disconnected tools."
          />
          <Feature
            n="03"
            icon={<Shield />}
            title="Access you can account for"
            text="Scope credentials, rotate them safely, and keep a clear trail of who changed what."
          />
          <Feature
            n="04"
            icon={<Radio />}
            title="Uptime that earns confidence"
            text="Catch a degraded check early. Give every stakeholder a status page they can understand."
          />
        </div>
      </section>
      <section className="workflow-section" id="workflow">
        <div className="workflow-copy">
          <div className="eyebrow">From signal to shipped</div>
          <h2>
            Less tool hopping.
            <br />
            More <span>knowing.</span>
          </h2>
          <p>
            EasyAPI brings the everyday API loop into one workspace: inventory, test, observe,
            improve.
          </p>
         <Link className="text-link" to={authed ? '/dashboard' : '/register'}>
  Explore the workspace <ArrowRight size={15} />
</Link>
        </div>
        <div className="workflow-steps">
          <Step
            num="01"
            title="Connect the surface"
            text="Add services, environments, and the people responsible."
          />
          <Step
            num="02"
            title="Send a real request"
            text="Test endpoints with actual HTTP and keep useful history."
          />
          <Step
            num="03"
            title="Follow the signal"
            text="Monitor health, inspect traffic, and resolve issues with context."
          />
        </div>
      </section>
      
      <section className="landing-cta">
        <div>
          <div className="eyebrow">A clearer view starts here</div>
          <h2>
            Your APIs deserve
            <br />a <span>steady pulse.</span>
          </h2>
        </div>
        <div>
          <p>Bring your API work into focus. Start and make the workspace your own.</p>
         <Link className="btn btn-primary btn-large" to={authed ? '/dashboard' : '/register'}>
  {authed ? 'Go to workspace' : 'Create a workspace'} <ArrowRight size={17} />
</Link>
        </div>
      </section>
      <footer className="landing-footer">
        <Link to="/">
          <Logo />
        </Link>
<span>© {new Date().getFullYear()} EasyAPI. Your APIs, always in sync.</span>
        <div>
          <Link to="/status">Status</Link>
          {!authed && <Link to="/login">Sign in</Link>}
          <a href="#product">Product</a>
        </div>
      </footer>
    </div>
  );
}
function Feature({
  n,
  icon,
  title,
  text,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="feature">
      <span className="feature-num">{n}</span>
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      
    </article>
  );
}
function Step({ num, title, text }: { num: string; title: string; text: string }) {
  return (
    <div className="step">
      <span>{num}</span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <CheckCircle2 size={19} />
    </div>
  );
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const LOADER_MS = 5000; // loader kam se kam itni der dikhega (ms)

function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { setAuthed, setWorkspace, setUser, theme } = useAuth(),
    nav = useNavigate();
  const [params] = useSearchParams();
  const [googleWidth, setGoogleWidth] = useState(360);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [resetToken, setResetToken] = useState('');
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  useEffect(() => {
  const updateGoogleWidth = () => {
    const submitButton = document.querySelector(
      '.auth-submit'
    );

    if (submitButton) {
      setGoogleWidth(
        Math.round(submitButton.getBoundingClientRect().width)
      );
    }
  };

  updateGoogleWidth();

  const submitButton = document.querySelector('.auth-submit');

  if (!submitButton) return;

  const observer = new ResizeObserver(updateGoogleWidth);
  observer.observe(submitButton);

  window.addEventListener('resize', updateGoogleWidth);

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', updateGoogleWidth);
  };
}, [mode]);
  // Mode badalne par (login <-> register) aur back/forward dabane par sab fields khali
  useEffect(() => {
    const reset = () => {
      setName('');
      setPassword('');
      setConfirmPassword('');
      setWorkspaceName('');
      setOtp('');
      setStep('otp');
      setResetToken('');
      setShowPw(false);
      setShowConfirm(false);
      setError('');
      setNotice('');
      // reset page par email URL (?email=...) se aata hai, use mat hatao
      setEmail(params.get('email') || '');
    };
    reset();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [mode]);

  const title =
    mode === 'login'
      ? 'Good to have you back.'
      : mode === 'register'
        ? 'Build your API command center.'
        : mode === 'forgot'
          ? 'Find your way back.'
          : step === 'otp'
            ? 'Check your email.'
            : 'Set a new password.';

  // Request aur minimum loader time saath chalte hain (pehle ki tarah, par ab request ke upar extra wait nahi)
  const withDelay = async <T,>(p: Promise<T>) => {
    const wait = new Promise((r) => setTimeout(r, LOADER_MS));
    try {
      return await p;
    } finally {
      await wait;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await withDelay(axios.post(`${API}/api/auth/forgot-password`, { email }));
        nav(`/reset-password?email=${encodeURIComponent(email)}`);
        return;
      }

      if (mode === 'reset') {
        if (step === 'otp') {
          const { data } = await withDelay(
            axios.post(`${API}/api/auth/verify-otp`, { email, otp }),
          );
          setResetToken(data.resetToken);
          setStep('password');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        const { data } = await withDelay(
          axios.post(`${API}/api/auth/reset-password`, {
            resetToken,
            password,
            confirmPassword,
          }),
        );
        setNotice(data.message);
        setTimeout(() => nav('/login'), 2000);
        return;
      }

      const { data } = await withDelay(
        axios.post(`${API}/api/auth/${mode}`, {
          name,
          email,
          password,
          workspace: workspaceName,
        }),
      );
      localStorage.setItem('sp_token', data.token);
      localStorage.setItem('sp_demo_auth', 'yes');
      localStorage.setItem('sp_workspace', data.user.workspace);
      const u = { name: data.user.name || '', email: data.user.email };
      localStorage.setItem('sp_user', JSON.stringify(u));
      setUser(u);
      setWorkspace(data.user.workspace);
      setAuthed(true);
      nav('/dashboard');
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Could not reach the server'
          : 'Something went wrong',
      );
    } finally {
      setLoading(false);
    }
  };
  const googleDone = async (credential?: string) => {
  if (!credential || loading) return;
  setError('');
  setNotice('');
  setLoading(true);
  try {
    const { data } = await withDelay(
      axios.post(`${API}/api/auth/google`, { credential }),
    );
    localStorage.setItem('sp_token', data.token);
    localStorage.setItem('sp_demo_auth', 'yes');
    localStorage.setItem('sp_workspace', data.user.workspace);
    const u = { name: data.user.name || '', email: data.user.email };
    localStorage.setItem('sp_user', JSON.stringify(u));
    setUser(u);
    setWorkspace(data.user.workspace);
    setAuthed(true);
    nav('/dashboard');
  } catch (err) {
    setError(
      axios.isAxiosError(err)
        ? err.response?.data?.message || 'Could not reach the server'
        : 'Something went wrong',
    );
  } finally {
    setLoading(false);
  }
};

  const eyeBtn = {
    position: 'absolute' as const,
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    color: 'hsl(var(--muted-foreground))',
    display: 'grid',
    placeItems: 'center',
  };

  return (
    <div className="auth-layout">
      <div className="auth-aside app-grid">
        <Link to="/">
          <Logo />
        </Link>
        <div className="auth-aside-copy">
          <div className="eyebrow">The API operations workspace</div>
          <h2>Clarity for the work behind every request.</h2>
          <p>Inventory, testing, monitoring, and access. Together in one dependable place.</p>
          <div className="auth-aside-bottom">
            <div className="auth-bars">
              {Array.from({ length: 24 }).map((_, i) => (
                <i key={i} />
              ))}
            </div>
            <span>LIVE SIGNAL · 99.98% UPTIME</span>
          </div>
        </div>
        <div className="auth-side-meta"></div>
      </div>

      <div className="auth-main">
        {loading && (
          <div className="auth-loading-overlay">
            <WinLoader />
            <span>
              {mode === 'login'
                ? 'Signing you in'
                : mode === 'register'
                  ? 'Creating workspace'
                  : mode === 'forgot'
                    ? 'Sending code'
                    : step === 'otp'
                      ? 'Verifying code'
                      : 'Updating password'}
              …
            </span>
          </div>
        )}
        <Link to="/" className="auth-back">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="auth-form-wrap">
          <div className="eyebrow">
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'register'
                ? 'Set up your workspace'
                : 'Account recovery'}
          </div>
          <h1>{title}</h1>
          <p className="auth-sub">
            {mode === 'login'
              ? 'Sign in to your workspace to see what is happening.'
              : mode === 'register'
                ? 'Create your workspace and start monitoring your APIs.'
                : 'Enter the email address associated with your workspace.'}
          </p>
          {notice && (
            <div className="notice">
              <Check size={16} />
              {notice}
            </div>
          )}
          {error && (
            <div
              className="notice"
              style={{ color: '#e5736f', borderColor: 'rgba(229,115,111,.35)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={submit} autoComplete="off">
            {mode === 'register' && (
              <label>
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}

            {(mode !== 'reset' || step === 'otp') && (
              <label>
                Email address
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  data-testid="input-auth-email"
                />
              </label>
            )}

            {mode === 'reset' && step === 'otp' && (
              <label>
                6-digit code
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder=""
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                  style={{ letterSpacing: '0.4em', fontFamily: 'monospace', fontSize: 18 }}
                  data-testid="input-auth-otp"
                />
              </label>
            )}

            {(mode === 'login' ||
              mode === 'register' ||
              (mode === 'reset' && step === 'password')) && (
              <label>
                {mode === 'reset' ? 'New password' : 'Password'}
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="input-auth-password"
                    style={{ width: '100%', paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    style={eyeBtn}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'reset' && step === 'password' && (
              <label>
                Confirm new password
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    data-testid="input-auth-confirm-password"
                    style={{ width: '100%', paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    style={eyeBtn}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <small style={{ color: '#e5736f' }}>Passwords do not match</small>
                )}
              </label>
            )}

            {mode === 'register' && (
              <label>
                Workspace name
                <input
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  autoComplete="off"
                />
              </label>
            )}

            <Button
              kind="primary"
              type="submit"
              disabled={loading}
              className="auth-submit"
              data-testid="button-auth-submit"
            >
              {mode === 'login'
                ? 'Sign in to workspace'
                : mode === 'register'
                  ? 'Create workspace'
                  : mode === 'forgot'
                    ? 'Send code'
                    : step === 'otp'
                      ? 'Verify code'
                      : 'Update password'}
              <ArrowRight size={16} />
            </Button>
          </form>
                {(mode === 'login' || mode === 'register') && (
  <>
    <div className="auth-or"><span>or</span></div>
<div className="ea-google-btn">
  <GoogleLogin
    onSuccess={(r) => googleDone(r.credential)}
    onError={() => setError('Google sign-in failed')}
    theme={theme === 'dark' ? 'filled_black' : 'outline'}
    text="continue_with"
    shape="rectangular"
    size="large"
    width={String(googleWidth)}
  />
</div>
  </>
)}
          {mode === 'login' && (
            <div className="auth-links">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          )}
          {mode === 'reset' && (
            <div className="auth-links">
              <Link to="/forgot-password">Didn't get a code? Resend</Link>
            </div>
          )}
          {mode === 'register' && (
            <p className="auth-terms">
              <br />
              By continuing, you agree to our terms of service and privacy policy.
            </p>
          )}
          <div className="auth-switch">
            {mode === 'login'
              ? 'New to EasyAPI?'
              : mode === 'register'
                ? 'Already have a workspace?'
                : ''}{' '}
            <Link to={mode === 'login' ? '/register' : '/login'}>
              {mode === 'login' ? 'Create an account' : mode === 'register' ? 'Sign in' : ''}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const chartData = [
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
function Dashboard() {
  const { user } = useAuth();
    const viewName = localStorage.getItem('sp_view') ? localStorage.getItem('sp_viewname') || '' : '';
  const shownName = viewName || displayName(user);
  const apis = useResource(() => service.apis(), []),
    alerts = useResource(() => service.alerts(), []);
  const [range, setRange] = useState('24 hours');
  const [confirmClear, setConfirmClear] = useState(false);
const [clearing, setClearing] = useState(false);
const doClear = () => {
  setClearing(true);
  setTimeout(() => {
    clearRequests();
    setClearing(false);
    setConfirmClear(false);
  }, 3000);
};

const openAlerts = (alerts.data || []).filter((a) => !a.acknowledged).length;
  const real = useRealRequests();
const stats = useMemo(() => buildStats(real, range), [real, range]);
const services = useMemo(() => {
  const hostOf = (p: string) => {
    try {
      return new URL(p).host;
    } catch {
      return p.split('/')[0] || 'unknown';
    }
  };
  const map = new Map<string, typeof real>();
  real.forEach((r) => {
    const h = hostOf(r.path);
    map.set(h, [...(map.get(h) || []), r]);
  });
  return Array.from(map, ([name, rs]) => {
    const last = rs.slice(0, 10); // real newest-first aata hai
    const bad = last.filter((r) => r.status >= 400 || r.status === 0).length;
    const ok = last.filter((r) => r.status > 0 && r.status < 400);
    const down = last[0].status === 0 || last[0].status >= 500;
    const status = down ? 'Down' : bad / last.length > 0.3 ? 'Degraded' : 'Healthy';
    const latency = ok.length ? Math.round(ok.reduce((s, r) => s + r.duration, 0) / ok.length) : 0;
    return {
  name,
  status,
  latency,
  lastTs: last[0].ts,
  lastStatus: last[0].status,
  bad,
  n: last.length,
};
  });
}, [real]);
const healthyCount = services.filter((s) => s.status === 'Healthy').length;
const problemCount = services.length - healthyCount;
const liveAlerts = useMemo(() => {
  const ago = (ts: number) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
    return `${Math.floor(m / 1440)} d ago`;
  };
  return services
    .filter((s) => s.status !== 'Healthy')
    .map((s) => ({
      id: s.name,
      severity: s.status === 'Down' ? 'Critical' : 'Warning',
      title: s.status === 'Down' ? `${s.name} health check failed` : `Elevated errors on ${s.name}`,
      time: ago(s.lastTs),
      detail:
        s.status === 'Down'
          ? s.lastStatus === 0
            ? 'Network or CORS error on latest request'
            : `Latest request returned ${s.lastStatus}`
          : `${s.bad} of last ${s.n} requests failed`,
    }));
}, [services]);
const recent = real.slice(0, 5).map((r) => ({
  ...r,
  time: new Date(r.ts).toLocaleTimeString(),
}));
  return (
    <>
      <PageHeading
        eyebrow={new Date()
  .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  .toUpperCase()}
                title={`${greeting()}, ${shownName.split(' ')[0]}`}
        description="Here’s the pulse of your APIs today."
        action={
          <>
           <Dropdown ariaLabel="Date range" value={range} onChange={setRange}
  options={['24 hours', '7 days', '30 days']} />
            <Link to="/tester" className="btn btn-primary">
              <Plus size={16} /> New request
            </Link>
          </>
        }
      />
      <div className="metric-grid">
      <Metric label="Requests" value={stats.total.toLocaleString()} change={`Last ${range}`} icon={<Activity />} tone="violet" />
<Metric label="Avg. response time" value={stats.total ? `${stats.avg} ms` : '—'} change={stats.total ? `Last ${range}` : 'No data yet'} icon={<Zap />} tone="cyan" />
<Metric label="Error rate" value={stats.total ? `${stats.errorRate.toFixed(2)}%` : '—'} change={`${stats.errors} errors`} icon={<ShieldCheck />} tone="green" />
<Metric label="Success rate" value={stats.total ? `${stats.successRate.toFixed(2)}%` : '—'} change={stats.total ? `Last ${range}` : 'No data yet'} icon={<Radio />} tone="amber" />
 </div>     
      <div className="dashboard-grid">
        <Card className="traffic-card">
          <div className="card-head">
            <div>
              <h3>Request traffic</h3>
              <p>Requests per hour across all environments</p>
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
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.buckets} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a7bff" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#8a7bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#8a7bff"
                  strokeWidth={2.4}
                  fill="url(#requestsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  stroke="#43c8d4"
                  strokeWidth={1.7}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot">
           <i className="status-dot good" /> {stats.total ? 'Live data' : 'No requests yet'}{' '}
<small>· Send one from the tester</small>
            <Link to="/analytics">
              View analytics <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
        <Card className="health-card">
          <div className="card-head">
            <div>
              <h3>API health</h3>
              <p>Service status right now</p>
            </div>
            <Link to="/monitoring" className="icon-btn" aria-label="Monitoring">
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="health-summary">
            <div className="health-ring">
              <div>
                <b>
  {healthyCount}<span>/{services.length}</span>
</b>
                <small>healthy</small>
              </div>
            </div>
            <div className="health-summary-copy">
             <b>
  {services.length === 0
    ? 'No services yet'
    : problemCount === 0
      ? 'All systems steady'
      : 'Needs attention'}
</b>
<span>
  {services.length === 0
    ? 'Send a request from the tester'
    : `${problemCount} services need a closer look`}
</span>
            </div>
          </div>
          <div className="health-list">
          {services.slice(0, 4).map((s) => (
  <div className="health-row" key={s.name}>
    <span
      className={`status-dot ${s.status === 'Healthy' ? 'good' : s.status === 'Degraded' ? 'warn' : 'bad'}`}
    />
    <b>{s.name}</b>
    <span>{s.latency ? `${s.latency} ms` : 'Down'}</span>
  </div>
))}
          </div>
        </Card>
      </div>
      <div className="dashboard-grid lower-grid">
        <Card className="recent-card">
          <div className="card-head">
            <div>
              <h3>Recent requests</h3>
              <p>Latest traffic across your APIs</p>
            </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {recent.length > 0 && (
                <button
                  className="text-link"
                  style={{ background: 'none', border: 0, cursor: 'pointer',color: '#e5484d' }}
                   onClick={() => setConfirmClear(true)}
                >
                  <Trash2 size={13} /> Clear all
                </button>
              )}
              <Link to="/logs" className="text-link">
                View logs <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <LogTable rows={recent as any} compact onDelete={deleteRequest} />
{recent.length === 0 && (
  <EmptyState
    title="No requests yet"
    copy="Send a request from the tester and it will show up here."
    action={<Link className="btn btn-secondary" to="/tester">Open tester</Link>}
  />
)}
        </Card>
        <Card className="alerts-card">
          <div className="card-head">
            <div>
              <h3>Needs attention</h3>
              <p>Recent signals from your workspace</p>
            </div>
          <Link to="/alerts" className="count-badge">
  {liveAlerts.length} open
</Link>
          </div>
          {liveAlerts.slice(0, 3).map((a) => (
              <div className="alert-row" key={a.id}>
                <span className={`alert-marker ${a.severity.toLowerCase()}`} />
                <div>
                  <b>{a.title}</b>
                  <p>
                    {a.time} · {a.detail}
                  </p>
                </div>
                <ChevronRight size={15} />
              </div>
              
            ))}
            {liveAlerts.length === 0 && (
  <EmptyState title="All clear" copy="No services need attention right now." />
)}
        </Card>
      </div>
      <div className="bottom-callout">
        <div className="callout-icon">
          <TerminalSquare size={20} />
        </div>
        <div>
          <b>Try an endpoint in the request tester</b>
          <p>Send a real request, inspect the response, and keep it in your history.</p>
        </div>
                <Link className="btn btn-secondary" to="/tester">
          Open tester <ArrowRight size={15} />
        </Link>
      </div>
      {confirmClear && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !clearing) setConfirmClear(false);
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
              <h2>Delete all requests?</h2>
              <p>Do you want to delete all recent requests? This cannot be undone.</p>
              <div className="modal-actions">
                <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#e5484d', borderColor: '#e5484d', color: '#fff' }}
                  onClick={doClear}
                >
                  Delete
                </button>
              </div>
            </div>
            {clearing && (
              <div className="logout-loading">
                <WinLoader color="#e5484d" />
                <p>Deleting requests…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function Metric({
  label,
  value,
  change,
  icon,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <span className="metric-label">{label}</span>
      <b className="metric-value">{value}</b>
      <span
        className={`metric-change ${change.includes('−') || change.includes('+') ? 'positive' : ''}`}
      >
        {change.includes('−') || change.includes('+') ? <Activity size={12} /> : null}
        {change}
      </span>
      <div className={`metric-spark ${tone}`} />
    </Card>
  );
}
function WinLoader({ color }: { color?: string }) {
  return <OrbitLoader color={color} />;
}
function Loading({ label = 'Loading workspace data' }: { label?: string }) {
  return (
    <div className="loading-state">
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-block" />
      <span>{label}…</span>
    </div>
  );
}
function ErrorBox({ retry }: { retry: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <CircleHelp />
      </div>
      <b>Something interrupted the signal</b>
      <p>Your demo data could not be loaded. Try again.</p>
      <Button onClick={retry}>
        <RefreshCw size={14} /> Retry
      </Button>
    </div>
  );
}
function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Box />
      </div>
      <b>{title}</b>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function download(text: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function Apis() {
  const { data, loading, error, refresh } = useApis();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All'),
    [modal, setModal] = useState(false),
    [edit, setEdit] = useState<ApiRecord | null>(null),
    [toast, setToast] = useState('');
    const [refreshing, setRefreshing] = useState(false);
  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([refresh(), new Promise((r) => setTimeout(r, 2000))]);
    setRefreshing(false);
  };
  const { role } = useAuth();
  const navigate = useNavigate();
  const flash = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };
  const fail = (e: unknown) =>
    flash(
      axios.isAxiosError(e)
        ? e.response?.data?.message || 'Could not reach the server'
        : 'Something went wrong',
      3500,
    );

  const items = (data || []).filter(
    (a) =>
      (a.name + a.baseUrl).toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All' || (a.requests !== '0' && a.status === filter)),
  );
  const canEdit = role !== 'Viewer';
  const save = async (form: ApiRecord) => {
    const start = Date.now();
    const minWait = () => {
      const left = 2000 - (Date.now() - start); // loader kam se kam 1.5 sec
      return left > 0 ? new Promise((r) => setTimeout(r, left)) : null;
    };
    try {
      await saveApi(form);
      await minWait();
      setModal(false);
      flash('API saved to inventory');
    } catch (e) {
      await minWait();
      fail(e);
    }
  };
  const create = () => {
    setEdit(null);
    setModal(true);
  };
  const clone = async (a: ApiView) => {
    try {
      await saveApi({ ...a, id: `api_${Date.now()}`, name: `${a.name} (copy)` });
      flash('API cloned');
    } catch (e) {
      fail(e);
    }
  };
  const exportData = () =>
    download(
      JSON.stringify(
        {
          app: 'EasyAPI',
          type: 'api-inventory',
          exportedAt: new Date().toISOString(),
          apis: (data || []).map((a) => ({
            name: a.name,
            baseUrl: a.baseUrl,
            description: a.description,
            endpoints: a.endpointList,
          })),
        },
        null,
        2,
      ),
      'easyapi-inventory.json',
      'application/json',
    );
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const list = parseImport(JSON.parse(await file.text()), file.name);
        for (const a of list) await saveApi({ id: `api_${Date.now()}`, ...a });
        flash(
          list.length === 1 ? `Imported "${list[0].name}"` : `${list.length} APIs imported`,
          3000,
        );
      } catch (e) {
        if (axios.isAxiosError(e)) fail(e);
        else if (e instanceof SyntaxError) flash('This file is not valid JSON.', 3500);
        else flash((e as Error).message, 5000);
      }
    };
    input.click();
  };


  return (
    <>
      <PageHeading
        eyebrow="YOUR SERVICES"
        title="API inventory"
        description="A living map of the services your team depends on."
        action={
          <div className="button-group">
            <Button onClick={importData} data-testid="button-import-api">
              <ArrowDownToLine size={15} /> Import
            </Button>
            <Button onClick={exportData}>
              <ArrowDownToLine size={15} /> Export
            </Button>
            {canEdit && (
              <Button kind="primary" onClick={create} data-testid="button-create-api">
                <Plus size={16} /> Add API
              </Button>
            )}
          </div>
        }
      />
      <Card className="inventory-card">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search APIs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="input-search-apis"
            />
          </div>
          <div className="toolbar-right">
            <span className="muted-copy">{items.length} services</span>
           
<Dropdown ariaLabel="Filter API status" value={filter} onChange={setFilter}
  options={['All', 'Healthy', 'Degraded', 'Offline']} />
                                 <Button onClick={doRefresh} aria-label="Refresh API inventory">
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
        </div>
        {refreshing ? (
                    <div style={{ display: 'grid', gap: 16, padding: '28px 4px' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer-line" />
            ))}
          </div>
        ) : loading ? (
          <Loading label="Loading APIs" />
        ) : error ? (
          <ErrorBox retry={refresh} />
        ) : items.length === 0 ? (
          <EmptyState
            title={(data || []).length ? 'No APIs match your search' : 'No APIs yet'}
            copy={
              (data || []).length
                ? 'Try a different name or status filter.'
                : 'Add your first API. Its live stats build up from requests sent in the tester.'
            }
          />
        ) : (
          <div className="api-grid">
            {items.map((a) => {
              const noData = a.requests === '0';
              return (
                <article className="api-card panel" key={a.id} data-testid={`card-api-${a.id}`}>
                  <div className="api-card-top">
                    <div className="api-avatar">
                      {a.name
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <button
                      className={`icon-btn favorite-btn ${a.favorite ? 'favorited' : ''}`}
                      onClick={async () => {
                        try {
                          await toggleFavorite(a.id);
                        } catch (e) {
                          fail(e);
                        }
                      }}
                      aria-label={`${a.favorite ? 'Remove' : 'Add'} ${a.name} favorite`}
                    >
                      <Heart size={17} fill={a.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <Link to={`/apis/${a.id}`} className="api-name">
                    {a.name}
                    <ArrowUpRightIcon />
                  </Link>
                  <p>{a.description}</p>
                  <div className="api-url mono">{a.baseUrl}</div>
                  <div className="api-card-stats">
                    <div>
                      <small>REQUESTS / 24H</small>
                      <b>{a.requests}</b>
                    </div>
                    <div>
                      <small>AVG. LATENCY</small>
                      <b>
                        {a.latency || '—'}
                        {a.latency ? ' ms' : ''}
                      </b>
                    </div>
                    <div>
                      <small>UPTIME</small>
                      <b>{noData ? '—' : `${a.uptime}%`}</b>
                    </div>
                  </div>
                  <div className="api-card-bottom">
                    {noData ? (
                      <StatusPill tone="unknown">No data</StatusPill>
                    ) : (
                      <StatusPill>{a.status}</StatusPill>
                    )}
                    <span>{a.endpoints} endpoints</span>
                    <button
                      className="icon-btn"
                      onClick={() => navigate(`/apis/${a.id}`)}
                      aria-label={`Open ${a.name}`}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="api-card-actions">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setEdit(a);
                            setModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button onClick={() => clone(a)}>Clone</button>
                        <button
  style={{ color: '#e5484d' }}
  onClick={async () => {
    try {
      await deleteApi(a.id);
    } catch (e) {
      fail(e);
    }
  }}
>
                          <Trash2 size={13} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
      {toast && <div className="toast-message">{toast}</div>}
      {modal && <ApiModal item={edit} onClose={() => setModal(false)} onSave={save} />}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ExternalLink size={14} />;
}
function ApiModal({
  item,
  onClose,
  onSave,
}: {
  item: ApiRecord | null;
  onClose: () => void;
    onSave: (x: ApiRecord) => void | Promise<void>;
}) {
  const [name, setName] = useState(item?.name || ''),
    [url, setUrl] = useState(item?.baseUrl || ''),
        [desc, setDesc] = useState(item?.description || ''),
    [saving, setSaving] = useState(false);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
               if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
            <div className="modal" style={{ position: 'relative' }}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{item ? 'EDIT SERVICE' : 'NEW SERVICE'}</div>
            <h2>{item ? 'Update API' : 'Add an API'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            await onSave({
              id: item?.id || `api_${Date.now()}`,
              name,
              baseUrl: url,
              description: desc,
              status: item?.status || 'Healthy',
              requests: item?.requests || '0',
              latency: item?.latency || 0,
              uptime: item?.uptime || 100,
              updated: 'just now',
              favorite: item?.favorite || false,
              endpoints: item?.endpoints || 0,
            });
            setSaving(false);
          }}
        >
          <label>
            Service name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payments API"
            />
          </label>
          <label>
            Base URL
            <input
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com"
            />
          </label>
          <label>
            Description
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What does this API do?"
            />
          </label>
          <div className="modal-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button kind="primary" type="submit">
              {item ? 'Save changes' : 'Add to inventory'}
            </Button>
          </div>
        </form>
        {saving && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              background: 'hsl(var(--card))',
              borderRadius: 'inherit',
            }}
          >
            <WinLoader />
            <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))' }}>
              {item ? 'Saving changes' : 'Adding to inventory'}…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
function ApiDetail() {
  const { id } = useParams(),
    res = useApis();
  const api = res.data?.find((a) => a.id === id);
  const [tab, setTab] = useState('Overview');
  const mon = useMonitor(30, true);
  const hist = useApiHistory(id);
  const live = mon.data?.apis.find((a) => a.id === id);
  const status = live?.status || 'Pending';
  const points = (hist?.points || []).map((p) => ({
    time: new Date(p.ts).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    latency: p.state === 'down' ? null : p.latency,
  }));
  return (
    <>
      {res.loading ? (
        <Loading />
      ) : !api ? (
        <EmptyState
          title="API not found"
          copy="It may have been removed from this workspace."
          action={
            <Link className="btn btn-secondary" to="/apis">
              Back to inventory
            </Link>
          }
        />
      ) : (
        <>
          <Link to="/apis" className="back-link">
            <ArrowLeft size={15} /> API inventory
          </Link>
          <PageHeading
            eyebrow={`API / ${api.id.toUpperCase()}`}
            title={api.name}
            description={api.description}
            action={
              <>
                
                <Link
                  className="btn btn-primary"
                  to="/tester"
                  onClick={() => sessionStorage.setItem('sp_replay', api.baseUrl)}
                >
                  <TerminalSquare size={15} /> Test endpoint
                </Link>
              </>
            }
          />
          <div className="detail-tabs">
            {['Overview', 'Endpoints', 'Documentation', 'Settings'].map((t) => (
              <button onClick={() => setTab(t)} className={tab === t ? 'selected' : ''} key={t}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'Overview' ? (
            <>
              <div className="metric-grid">
                <Metric
                  label="Requests / 24h"
                  value={api.requests}
                  change="Sent from the tester"
                  icon={<Activity />}
                  tone="violet"
                />
                <Metric
                  label="Avg. latency"
                  value={hist && hist.checks ? `${hist.avg} ms` : '—'}
                  change={hist && hist.checks ? `p95 ${hist.p95} ms` : 'No checks yet'}
                  icon={<Zap />}
                  tone="cyan"
                />
                <Metric
                  label="Uptime"
                  value={hist && hist.uptime !== null ? `${hist.uptime}%` : '—'}
                  change={hist && hist.checks ? `${hist.checks} checks in 24h` : 'No checks yet'}
                  icon={<Radio />}
                  tone="green"
                />
                <Metric
                  label="Endpoints"
                  value={`${api.endpoints}`}
                  change={`${api.endpointList.length} documented`}
                  icon={<Braces />}
                  tone="amber"
                />
              </div>
              <div className="detail-two">
                <Card>
                  <div className="card-head">
                    <div>
                      <h3>Service health</h3>
                      <p>Response time over the past 24 hours</p>
                    </div>
                    <StatusPill>{status}</StatusPill>
                  </div>
                  <div className="chart-wrap detail-chart">
                    {points.length === 0 ? (
                      <div className="history-empty" style={{ padding: '60px 0', textAlign: 'center' }}>
                        Waiting for the first health check…
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid
                            stroke="hsl(var(--border))"
                            strokeDasharray="3 5"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            minTickGap={30}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={48}
                            unit=" ms"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(v: any) => [`${v} ms`, 'Response time']}
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="latency"
                            stroke="#8a7bff"
                            strokeWidth={2}
                            fill="#8a7bff"
                            fillOpacity={0.12}
                            connectNulls={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
                <Card>
                  <div className="card-head">
                    <div>
                      <h3>Connection details</h3>
                      <p>Live from health checks</p>
                    </div>
                  </div>
                  <div className="detail-kv">
                    <span>Base URL</span>
                    <b className="mono">{api.baseUrl}</b>
                    <span>Status</span>
                    <b>{status}</b>
                    <span>Last checked</span>
                    <b>{live?.lastCheckedAt ? timeAgo(live.lastCheckedAt) : 'Not checked yet'}</b>
                    <span>Last response</span>
                    <b>
                      {live?.statusCode
                        ? `HTTP ${live.statusCode}`
                        : live?.error || '—'}
                    </b>
                    <span>Check interval</span>
                    <b>Every {mon.data?.intervalSec || 60}s</b>
                    <span>Last updated</span>
                    <b>{api.updated}</b>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card className="tab-content">
              {tab === 'Endpoints' ? (
                <>
                  <div className="card-head">
                    <div>
                      <h3>Endpoints</h3>
                      <p>{api.endpoints} endpoint definitions in this service.</p>
                    </div>
                    
                  </div>
                  <EndpointRows items={api.endpointList} baseUrl={api.baseUrl} />
                </>
              ) : tab === 'Documentation' ? (
                <>
                  <div className="card-head">
                    <div>
                      <h3>API documentation</h3>
                      <p>Reference material for consumers of {api.name}.</p>
                    </div>
                    <Button onClick={() => navigator.clipboard?.writeText(api.baseUrl)}>
                      <Copy size={14} /> Copy base URL
                    </Button>
                  </div>
                  <EndpointRows items={api.endpointList} baseUrl={api.baseUrl} docs />
                </>
              ) : (
                <>
                  <div className="card-head">
                    <div>
                      <h3>Service settings</h3>
                      <p>Manage this API's inventory details.</p>
                    </div>
                  </div>
                  <div className="detail-kv">
                    <span>Service ID</span>
                    <b className="mono">{api.id}</b>
                    <span>Base URL</span>
                    <b>{api.baseUrl}</b>
                    <span>Visibility</span>
                    <b>Workspace members</b>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
function EndpointRows({
  items,
  baseUrl,
  docs = false,
}: {
  items: EndpointItem[];
  baseUrl: string;
  docs?: boolean;
}) {
  if (!items.length)
    return (
      <EmptyState
        title="No endpoints yet"
        copy="Import an OpenAPI, Swagger or Postman file to list its endpoints here."
      />
    );
  return (
    <div className="endpoint-list">
      {items.map((e, i) => (
        <div className="endpoint-row" key={`${e.method}-${e.path}-${i}`}>
          <span className={`method method-${e.method.toLowerCase()}`}>{e.method}</span>
          <b className="mono">{e.path}</b>
          <span>{e.summary || (docs ? 'No description' : '')}</span>
          <Link
            to="/tester"
            aria-label={`Test ${e.path}`}
            onClick={() => sessionStorage.setItem('sp_replay', baseUrl + e.path)}
          >
            <ArrowRight size={15} />
          </Link>
        </div>
      ))}
    </div>
  );
}
function LogTable({
  rows,
  compact = false,
  onDelete,
}: {
  rows: LogRecord[];
  compact?: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={`logs-table-wrap ${compact ? 'compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Status</th>
            <th>Duration</th>
            <th>API</th>
                        <th>Time</th>
            {onDelete && <th style={{ width: 48 }} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid={`row-log-${r.id}`}>
              <td>
                <span className={`method method-${r.method.toLowerCase()}`}>{r.method}</span>
              </td>
              <td className="mono log-path">{r.path}</td>
              <td>
                <span
  className={`http-code ${r.status === 0 || r.status >= 500 ? 'bad' : r.status >= 400 ? 'warn' : 'good'}`}
>
  {r.status || 'ERR'}
</span>
              </td>
              <td>{r.duration} ms</td>
              <td>{r.api}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.time}</td>
              {onDelete && (
                <td style={{ width: 48, textAlign: 'center' }}>
                  <button
                    className="icon-btn"
                    style={{ color: '#e5484d' }}
                    aria-label="Delete request"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(r.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Logs() {
  const live = useRealRequests();
  const [query, setQuery] = useState(''),
    [method, setMethod] = useState('All'),
    [status, setStatus] = useState('All'),
       [pausedAt, setPausedAt] = useState<number | null>(null),
    [selected, setSelected] = useState<LogRecord | null>(null);
    const [refreshing, setRefreshing] = useState(false);
const doRefresh = async () => {
  if (refreshing) return;
  setRefreshing(true);
  window.dispatchEvent(new Event('sp-requests-changed'));
  await new Promise((r) => setTimeout(r, 2000));
  setRefreshing(false);
};
  const paused = pausedAt !== null;
  const source = paused ? live.filter((r) => r.ts <= pausedAt!) : live;
  const authCfg = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
  });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await axios.get(`${API}/api/auth/me`, authCfg());
        if (alive) setPausedAt(data.user.prefs?.logsPausedAt ?? null);
      } catch {}
    };
    load();
    const t = setInterval(load, 10000);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, []);
  const togglePause = async () => {
    const next = paused ? null : Date.now();
    setPausedAt(next);
    try {
      await axios.put(`${API}/api/auth/prefs`, { logsPausedAt: next }, authCfg());
    } catch {}
  };

  const all = source.map((r) => ({
    id: r.id,
    method: r.method,
    path: r.path,
    status: r.status,
    duration: r.duration,
    api: r.api,
    region: r.region,
    time: new Date(r.ts).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  })) as LogRecord[];

  const rows = all.filter(
    (r) =>
      (r.path + r.api + r.id).toLowerCase().includes(query.toLowerCase()) &&
      (method === 'All' || r.method === method) &&
      (status === 'All' ||
        (status === 'Errors' ? r.status >= 400 || r.status === 0 : r.status > 0 && r.status < 400)),
  );

  const hourAgo = Date.now() - 3600e3;
  const lastHour = source.filter((r) => r.ts >= hourAgo);
  const lastHourErrors = lastHour.filter((r) => r.status >= 400 || r.status === 0).length;
  const sortedMs = source.map((r) => r.duration).sort((a, b) => a - b);
  const p95 = sortedMs.length
    ? sortedMs[Math.max(0, Math.ceil(sortedMs.length * 0.95) - 1)]
    : 0;

  return (
    <>
      <PageHeading
        eyebrow="LIVE REQUEST STREAM"
        title="Request logs"
        description="Trace requests across your services, as they happen."
        action={
          <>
            <Button
              onClick={() =>
                download(JSON.stringify(rows, null, 2), 'easyapi-logs.json', 'application/json')
              }
            >
              <ArrowDownToLine size={15} /> Export
            </Button>
            <Button kind={paused ? 'primary' : 'secondary'} onClick={togglePause}>
              {paused ? <Play size={15} /> : <Pause size={15} />}{' '}
              {paused ? 'Resume stream' : 'Pause stream'}
            </Button>
          </>
        }
      />
      <div
        className="log-summary"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '14px 36px',
          padding: '16px 22px',
          margin: '18px 0',
          border: '1px solid hsl(var(--border))',
          borderRadius: 14,
          background: 'hsl(var(--card))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          <span
            className={`pulse-status ${paused ? 'paused' : ''}`}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: paused ? '#e0b24f' : '#43b581',
              flexShrink: 0,
            }}
          />
          <b>{paused ? 'Stream paused' : 'Live stream'}</b>
          <small style={{ color: 'hsl(var(--muted-foreground))' }}>
            {paused ? 'Updates paused' : `${source.length} requests saved`}
          </small>
        </div>
        {[
          ['Last hour', lastHour.length.toLocaleString(), ''],
          ['Errors (1h)', String(lastHourErrors), 'text-warn'],
          ['p95 latency', source.length ? `${p95} ms` : '—', ''],
        ].map(([label, value, cls]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{label}</span>
            <b className={cls} style={{ fontSize: 18 }}>
              {value}
            </b>
          </div>
        ))}
      </div>
      <Card className="log-card">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              placeholder="Search path, service, request ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="input-search-logs"
            />
          </div>
          <div className="toolbar-right">
<Dropdown ariaLabel="Filter method" value={method} onChange={setMethod}
  options={['All', 'GET', 'POST', 'PATCH', 'DELETE']} />
<Dropdown ariaLabel="Filter status" value={status} onChange={setStatus}
  options={['All', 'Errors', 'Successful']} />
            <Button onClick={doRefresh} aria-label="Refresh logs">
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
        </div>
{refreshing ? (
  <div style={{ display: 'grid', gap: 16, padding: '28px 4px' }}>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="shimmer-line" />
    ))}
  </div>
) : rows.length ? (
  <div
    onClick={(e) => {
      const tr = (e.target as HTMLElement).closest('tbody tr');
      if (tr) {
        const idx = Array.from(tr.parentElement?.children || []).indexOf(tr);
        setSelected(rows[idx] || null);
      }
    }}
  >
    <LogTable rows={rows} />
  </div>
) : (
  <EmptyState
    title={all.length ? 'No matching requests' : 'No requests yet'}
    copy={
      all.length
        ? 'Try adjusting your filters or search terms.'
        : 'Send a request from the tester and it will show up here.'
    }
  />
)}
      </Card>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">REQUEST DETAIL · {selected.id}</div>
                <h2>
                  {selected.method} {selected.path}
                </h2>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="detail-kv">
              <span>Status</span>
              <b>{selected.status}</b>
              <span>Duration</span>
              <b>{selected.duration} ms</b>
              <span>Service</span>
              <b>{selected.api}</b>
              <span>Region</span>
              <b>{selected.region}</b>
              <span>Timestamp</span>
              <b>{selected.time}</b>
            </div>
            <div className="modal-actions">
              <Button onClick={() => setSelected(null)}>Close</Button>
              <Button
                kind="primary"
                onClick={() => {
                  sessionStorage.setItem('sp_replay', selected.path);
                  location.href = '/tester';
                }}
              >
                Replay in tester <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}