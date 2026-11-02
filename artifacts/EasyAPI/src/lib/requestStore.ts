import { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const cfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});
const notify = () => window.dispatchEvent(new Event('sp-requests-changed'));

export type RealRequest = {
  id: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  api: string;
  region: string;
  ts: number;
};

export const fetchRequests = async (): Promise<RealRequest[]> => {
  try {
    const { data } = await axios.get(`${API}/api/requests`, cfg());
    return data;
  } catch {
    return [];
  }
};

export const addRequest = async (r: {
  method: string;
  path: string;
  status: number;
  duration: number;
  api?: string;
}) => {
  try {
    await axios.post(`${API}/api/requests`, r, cfg());
    notify();
  } catch {
    /* save fail hua to ignore, tester ko na roke */
  }
};

export const deleteRequest = async (id: string) => {
  try {
    await axios.delete(`${API}/api/requests/${id}`, cfg());
    notify();
  } catch {}
};

export const clearRequests = async () => {
  try {
    await axios.delete(`${API}/api/requests`, cfg());
    notify();
  } catch {}
};

export function useRealRequests() {
  const [rows, setRows] = useState<RealRequest[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await fetchRequests();
      if (alive) setRows(data);
    };
    load();
    const poll = setInterval(load, 10000); // har 10 sec mein Mongo se refresh
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('sp-requests-changed', load);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener('sp-requests-changed', load);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return rows;
}

export function buildStats(rows: RealRequest[], range: string) {
  const hours = range === '7 days' ? 168 : range === '30 days' ? 720 : 24;
  const span = hours * 3600e3;
  const now = Date.now();
  const start = now - span;
  const inRange = rows.filter((r) => r.ts >= start);
  const total = inRange.length;
  const errors = inRange.filter((r) => r.status >= 400 || r.status === 0).length;
  const avg = total ? Math.round(inRange.reduce((s, r) => s + r.duration, 0) / total) : 0;
  const errorRate = total ? (errors / total) * 100 : 0;

  const N = 12;
  const size = span / N;
  const buckets = Array.from({ length: N }, (_, i) => {
    const t = new Date(start + i * size);
    return {
      time:
        hours === 24
          ? t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      requests: 0,
      errors: 0,
    };
  });
  inRange.forEach((r) => {
    const i = Math.min(N - 1, Math.floor((r.ts - start) / size));
    buckets[i].requests++;
    if (r.status >= 400 || r.status === 0) buckets[i].errors++;
  });

  return { total, errors, avg, errorRate, successRate: total ? 100 - errorRate : 0, buckets };
}