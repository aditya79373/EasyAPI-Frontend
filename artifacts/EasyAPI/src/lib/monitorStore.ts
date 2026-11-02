import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const cfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});

export type MonitorApi = {
  id: string;
  name: string;
  baseUrl: string;
  status: 'Operational' | 'Degraded' | 'Down' | 'Pending';
  latency: number;
  statusCode: number;
  error: string;
  lastCheckedAt: number | null;
  uptime: number | null;
  checks: number;
    bars: { state: 'up' | 'slow' | 'down'; ts: number; latency: number }[];
};
export type Incident = {
  id: string;
  apiName: string;
  kind: 'Down' | 'Degraded';
  detail: string;
  startedAt: number;
  resolvedAt: number | null;
};
type Payload = { intervalSec: number; paused: boolean; apis: MonitorApi[]; incidents: Incident[] };

export function useMonitor(everySec: number, enabled: boolean) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/monitor`, cfg());
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    refresh();
    if (!enabled) return;
    const t = setInterval(refresh, everySec * 1000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh, everySec, enabled]);
  return { data, error, loading: data === null && !error, refresh };
}

export const checkNow = (id: string) =>
  axios.post(`${API}/api/monitor/check/${id}`, {}, cfg());

export const timeAgo = (ts: number) => {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.floor(h / 24)} d ago`;
};
export const fmtDur = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
};
export const fmtWhen = (ts: number) =>
  new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
export type ApiHistory = {
  checks: number;
  uptime: number | null;
  avg: number;
  p95: number;
  points: { ts: number; latency: number; state: 'up' | 'slow' | 'down' }[];
};

export function useApiHistory(id: string | undefined) {
  const [data, setData] = useState<ApiHistory | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/monitor/${id}`, cfg());
        if (alive) setData(res.data);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, [id]);
  return data;
}
export const saveMonitorPrefs = (p: { monitorInterval?: number; monitorPaused?: boolean }) =>
  axios.put(`${API}/api/auth/prefs`, p, cfg());