import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRealRequests, type RealRequest } from './requestStore';
import type { ApiRecord } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const cfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});
const changed = () => window.dispatchEvent(new Event('sp-apis-changed'));

export type EndpointItem = { method: string; path: string; summary: string };
export type ApiView = ApiRecord & { endpointList: EndpointItem[] };

type StoredApi = {
  endpointList?: EndpointItem[];
  id: string;
  name: string;
  baseUrl: string;
  description: string;
  favorite: boolean;
  endpoints: number;
  updatedAt: number;
};

const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

const parse = (u: string) => {
  try {
    return new URL(u);
  } catch {
    return null;
  }
};

// request ka host == API ke base URL ka host (aur base URL mein path ho to wo bhi match)
const matches = (baseUrl: string, path: string) => {
  const b = parse(baseUrl);
  const p = parse(path);
  if (!b || !p || p.host !== b.host) return false;
  const prefix = b.pathname.replace(/\/$/, '');
  return !prefix || p.pathname.startsWith(prefix);
};

const failed = (r: RealRequest) => r.status === 0 || r.status >= 500;

const enrich = (a: StoredApi, real: RealRequest[]): ApiView => {
  const mine = real.filter((r) => matches(a.baseUrl, r.path)); // newest pehle
  const day = mine.filter((r) => r.ts >= Date.now() - 864e5);
  const recent = mine.slice(0, 10);
  const bad = recent.filter((r) => r.status === 0 || r.status >= 400).length;
  const ok = recent.filter((r) => r.status > 0 && r.status < 400);

  let status: string = 'Healthy';
  if (recent.length) {
    status = failed(recent[0]) ? 'Offline' : bad / recent.length > 0.3 ? 'Degraded' : 'Healthy';
  }
  const latency = ok.length ? Math.round(ok.reduce((s, r) => s + r.duration, 0) / ok.length) : 0;
  const uptime = day.length
    ? Number(((1 - day.filter(failed).length / day.length) * 100).toFixed(2))
    : 100;
  const paths = new Set(mine.map((r) => parse(r.path)?.pathname || r.path));

  return {
    id: a.id,
    name: a.name,
    baseUrl: a.baseUrl,
    description: a.description,
    status,
    requests: day.length.toLocaleString(),
    latency,
    uptime,
    updated: ago(a.updatedAt),
    favorite: a.favorite,
      endpoints: Math.max(a.endpoints, paths.size),
    endpointList: a.endpointList || [],
  } as ApiView;
};

export function useApis() {
  const [stored, setStored] = useState<StoredApi[] | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);
  const real = useRealRequests();

  const refresh = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/apis`, cfg());
      setStored(data);
      setFailedLoad(false);
    } catch {
      setFailedLoad(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('sp-apis-changed', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('sp-apis-changed', refresh);
    };
  }, [refresh]);

  const data = useMemo(
    () => (stored ? stored.map((a) => enrich(a, real)) : null),
    [stored, real],
  );
  return {
    data,
    loading: stored === null && !failedLoad,
    error: stored === null && failedLoad,
    refresh,
  };
}

export const saveApi = async (f: {
  id: string;
  name: string;
  baseUrl: string;
  description: string;
  endpoints?: number;
  endpointList?: EndpointItem[];
}) => {
  const body = { name: f.name, baseUrl: f.baseUrl, description: f.description };
  if (/^[a-f0-9]{24}$/i.test(f.id)) {
    await axios.put(`${API}/api/apis/${f.id}`, body, cfg());
  } else {
    await axios.post(
      `${API}/api/apis`,
      { ...body, endpoints: f.endpoints || 0, endpointList: f.endpointList || [] },
      cfg(),
    );
  }
  changed();
};
export const toggleFavorite = async (id: string) => {
  await axios.patch(`${API}/api/apis/${id}/favorite`, {}, cfg());
  changed();
};

export const deleteApi = async (id: string) => {
  await axios.delete(`${API}/api/apis/${id}`, cfg());
  changed();
};
export type ImportedApi = {
  name: string;
  baseUrl: string;
  description: string;
  endpoints: number;
  endpointList?: EndpointItem[];
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

const httpUrl = (u: unknown) => {
  if (typeof u !== 'string') return '';
  const s = u.trim();
  try {
    return /^https?:$/.test(new URL(s).protocol) ? s.replace(/\/$/, '') : '';
  } catch {
    return '';
  }
};
const hostName = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};
// {{baseUrl}} (Postman) aur {region} (OpenAPI) dono bharta hai
const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{\{?\s*([\w.-]+)\s*\}?\}/g, (m, k) => vars[k] ?? m);

const countOps = (paths: any) =>
  Object.values(paths || {}).reduce<number>(
    (n, p: any) =>
      n + Object.keys(p || {}).filter((k) => HTTP_METHODS.includes(k.toLowerCase())).length,
    0,
  );
const opsFrom = (paths: any): EndpointItem[] => {
  const out: EndpointItem[] = [];
  for (const [path, item] of Object.entries(paths || {})) {
    for (const [m, op] of Object.entries((item as any) || {})) {
      if (!HTTP_METHODS.includes(m.toLowerCase())) continue;
      const o: any = op || {};
      out.push({
        method: m.toUpperCase(),
        path,
        summary: String(o.summary || o.description || o.operationId || '')
          .split('\n')[0]
          .slice(0, 200),
      });
    }
  }
  return out;
};

const postmanOps = (items: any[], vars: Record<string, string>, out: EndpointItem[] = []) => {
  for (const it of items || []) {
    if (it?.item) postmanOps(it.item, vars, out);
    else if (it?.request) {
      const u = it.request.url;
      const raw = fill(typeof u === 'string' ? u : u?.raw || '', vars);
      let path = raw;
      try {
        path = new URL(raw).pathname;
      } catch {
        path = raw.replace(/^\{\{[^}]+\}\}/, '');
      }
      out.push({
        method: String(it.request.method || 'GET').toUpperCase(),
        path: path || '/',
        summary: String(it.name || ''),
      });
    }
  }
  return out;
};
const postmanUrls = (items: any[], out: string[] = []) => {
  for (const it of items || []) {
    if (it?.item) postmanUrls(it.item, out);
    else if (it?.request) {
      const u = it.request.url;
      out.push(typeof u === 'string' ? u : u?.raw || '');
    }
  }
  return out;
};

const fromSimple = (x: any, fallbackName: string): ImportedApi | null => {
  const baseUrl = httpUrl(x?.baseUrl ?? x?.base_url ?? x?.baseURL ?? x?.url);
  if (!baseUrl) return null;
  return {
    name: String(x.name || x.title || fallbackName || hostName(baseUrl)),
    baseUrl,
    description: String(x.description || ''),
    endpoints: Number(x.endpoints) || 0,
  };
};

export function parseImport(parsed: any, fileName: string): ImportedApi[] {
  const fileTitle = fileName.replace(/\.json$/i, '');
   const noUrl = new Error('No valid base URL found in this file.');

  if (Array.isArray(parsed)) {
    const list = parsed
      .map((x) => fromSimple(x, ''))
      .filter((x): x is ImportedApi => x !== null);
    if (!list.length) throw noUrl;
    return list;
  }
    // EasyAPI ka apna export format
  if (parsed?.type === 'api-inventory' && Array.isArray(parsed.apis)) {
    const list = parsed.apis
      .map((x: any) => {
        const baseUrl = httpUrl(x?.baseUrl);
        if (!baseUrl) return null;
        const eps: EndpointItem[] = (Array.isArray(x.endpoints) ? x.endpoints : [])
          .map((e: any) => ({
            method: String(e?.method || 'GET').toUpperCase(),
            path: String(e?.path || ''),
            summary: String(e?.summary || ''),
          }))
          .filter((e: EndpointItem) => e.path);
        return {
          name: String(x.name || hostName(baseUrl)),
          baseUrl,
          description: String(x.description || ''),
          endpoints: eps.length,
          endpointList: eps,
        } as ImportedApi;
      })
      .filter((x: ImportedApi | null): x is ImportedApi => x !== null);
    if (!list.length) throw noUrl;
    return list;
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('This file does not contain a valid JSON object.');

  const info = parsed.info || {};
  const name = String(info.title || info.name || parsed.name || fileTitle);
  const description =
    typeof info.description === 'string' && info.description.trim()
      ? info.description.trim().slice(0, 200)
      : `Imported from ${fileName}`;

  // OpenAPI 3
  if (parsed.openapi) {
    const servers: any[] = Array.isArray(parsed.servers) ? parsed.servers : [];
    const resolve = (s: any) =>
      httpUrl(
        fill(
          String(s?.url || ''),
          Object.fromEntries(
            Object.entries(s?.variables || {}).map(([k, v]: [string, any]) => [
              k,
              String(v?.default ?? ''),
            ]),
          ),
        ),
      );
    if (!parsed.paths || info.title === 'EasyAPI inventory') {
      const list = servers
        .map((s) => ({
          name: String(s.description || hostName(resolve(s))),
          baseUrl: resolve(s),
          description: `Imported from ${fileName}`,
          endpoints: 0,
        }))
        .filter((x) => x.baseUrl);
      if (list.length) return list;
    }
    const baseUrl = resolve(servers[0]);
    if (!baseUrl) {
      if (String(servers[0]?.url || '').startsWith('/'))
        throw new Error('servers[0].url is relative (like /v1). A full https://... URL is required.');
      throw noUrl;
    }
    return [
      {
        name,
        baseUrl,
        description,
        endpoints: countOps(parsed.paths),
        endpointList: opsFrom(parsed.paths),
      },
    ];
  }

  // Swagger 2
  if (parsed.swagger && parsed.host) {
    const scheme = parsed.schemes?.[0] || 'https';
    const bp = parsed.basePath && parsed.basePath !== '/' ? parsed.basePath : '';
    const baseUrl = httpUrl(`${scheme}://${parsed.host}${bp}`);
    if (!baseUrl) throw noUrl;
    return [{ name, baseUrl, description, endpoints: countOps(parsed.paths) }];
  }

  // Postman collection
  if (Array.isArray(parsed.item)) {
    const vars: Record<string, string> = {};
    (parsed.variable || []).forEach((v: any) => {
      if (v?.key) vars[v.key] = String(v.value ?? '');
    });
    const urls = postmanUrls(parsed.item);
    let baseUrl = '';
    for (const u of urls) {
      const ok = httpUrl(fill(u, vars));
      if (ok) {
        baseUrl = new URL(ok).origin;
        break;
      }
    }
    if (!baseUrl)
           throw new Error(
        'No full URL found in this Postman collection. If it uses a variable like {{baseUrl}}, set its value in the collection Variables.',
      );
    return [{ name, baseUrl, description, endpoints: urls.length }];
  }

  // simple { name, baseUrl }
  const s = fromSimple(parsed, name);
  if (s) return [s];
  throw noUrl;
}