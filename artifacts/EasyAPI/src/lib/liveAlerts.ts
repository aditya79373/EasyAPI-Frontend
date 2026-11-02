import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRealRequests } from './requestStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type LiveAlert = {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  title: string;
  detail: string;
  ts: number;
  time: string;
  link: string;
  acknowledged: boolean;
};

// ---------- shared store (backend = source of truth, localStorage = cache) ----------
const KA = 'sp_acked_alerts';
const KS = 'sp_seen_alerts';
const read = (k: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(k) || '[]');
  } catch {
    return [];
  }
};
let state = { acked: read(KA), seen: read(KS) };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const cfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});
const union = (a: string[], b: string[]) => Array.from(new Set([...a, ...b])).slice(-200);

const persist = () => {
  localStorage.setItem(KA, JSON.stringify(state.acked));
  localStorage.setItem(KS, JSON.stringify(state.seen));
};
const pushToServer = () =>
  axios
    .put(`${API}/api/auth/prefs`, { ackedAlerts: state.acked, seenAlerts: state.seen }, cfg())
    .catch(() => {});

const loadFromServer = async () => {
  try {
    const { data } = await axios.get(`${API}/api/auth/me`, cfg());
    const p = data.user.prefs || {};
    state = {
      acked: union(p.ackedAlerts || [], state.acked),
      seen: union(p.seenAlerts || [], state.seen),
    };
    persist();
    emit();
  } catch {}
};

let subs = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const start = () => {
  loadFromServer();
  timer = setInterval(loadFromServer, 30000);
  window.addEventListener('focus', loadFromServer);
};
const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
  window.removeEventListener('focus', loadFromServer);
};

const hostOf = (p: string) => {
  try {
    return new URL(p).host;
  } catch {
    return p.split('/')[0] || 'unknown';
  }
};
const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

export function useLiveAlerts() {
  const real = useRealRequests();
  const [, force] = useState(0);

  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    if (subs++ === 0) start();
    return () => {
      listeners.delete(f);
      if (--subs === 0) stop();
    };
  }, []);

  const { acked, seen } = state;

  const alerts = useMemo<LiveAlert[]>(() => {
    const map = new Map<string, typeof real>();
    real.forEach((r) => {
      const h = hostOf(r.path);
      map.set(h, [...(map.get(h) || []), r]);
    });

    const out: Omit<LiveAlert, 'acknowledged' | 'time'>[] = [];
    map.forEach((rs, host) => {
      const last = rs.slice(0, 10); // newest first
      const badReqs = last.filter((r) => r.status >= 400 || r.status === 0);
      const ok = last.filter((r) => r.status > 0 && r.status < 400);
      const down = last[0].status === 0 || last[0].status >= 500;
      const degraded = !down && badReqs.length / last.length > 0.3;
      const avg = ok.length ? Math.round(ok.reduce((s, r) => s + r.duration, 0) / ok.length) : 0;

      if (down) {
        out.push({
          id: `${host}:down:${last[0].ts}`,
          severity: 'Critical',
          title: `${host} health check failed`,
          detail:
            last[0].status === 0
              ? 'Network or CORS error on latest request'
              : `Latest request returned ${last[0].status}`,
          ts: last[0].ts,
          link: '/logs',
        });
      } else if (degraded) {
        out.push({
          id: `${host}:degraded:${badReqs[0].ts}`,
          severity: 'Warning',
          title: `Elevated errors on ${host}`,
          detail: `${badReqs.length} of last ${last.length} requests failed`,
          ts: badReqs[0].ts,
          link: '/logs',
        });
      } else if (avg > 1000) {
        out.push({
          id: `${host}:slow:${last[0].ts}`,
          severity: 'Info',
          title: `High latency on ${host}`,
          detail: `Average response time is ${avg} ms`,
          ts: last[0].ts,
          link: '/monitoring',
        });
      }
    });

    const rank = { Critical: 0, Warning: 1, Info: 2 };
    return out
      .sort((a, b) => rank[a.severity] - rank[b.severity] || b.ts - a.ts)
      .map((a) => ({ ...a, time: ago(a.ts), acknowledged: acked.includes(a.id) }));
  }, [real, acked]);

  const acknowledge = useCallback((id: string) => {
    state = { ...state, acked: union(state.acked, [id]) };
    persist();
    emit();
    pushToServer();
  }, []);

  const acknowledgeAll = useCallback(() => {
    state = { ...state, acked: union(state.acked, alerts.map((a) => a.id)) };
    persist();
    emit();
    pushToServer();
  }, [alerts]);

  const markSeen = useCallback((ids: string[]) => {
    if (ids.every((i) => state.seen.includes(i))) return;
    state = { ...state, seen: union(state.seen, ids) };
    persist();
    emit();
    pushToServer();
  }, []);

  return { alerts, acknowledge, acknowledgeAll, seen, markSeen };
}