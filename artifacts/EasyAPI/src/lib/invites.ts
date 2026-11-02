import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { onLive } from './live';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const cfg = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
});

export type Invite = { id: string; from: string; workspace: string; role: string; ts: number };
export type WorkspaceItem = { id: string; owner: string; name: string; role: string; avatar?: string };

export function useInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/invites`, cfg());
      setInvites(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const off = onLive(load);
    const t = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => {
      off();
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const respond = useCallback(
    async (id: string, action: 'accept' | 'decline') => {
      try {
        const { data } = await axios.post(`${API}/api/invites/${id}/${action}`, {}, cfg());
        await load();
        return data as { ok: boolean; owner?: string };
      } catch (e) {
        alert(axios.isAxiosError(e) ? e.response?.data?.message || 'Failed' : 'Failed');
        return null;
      }
    },
    [load],
  );

  return { invites, respond };
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get(`${API}/api/workspaces`, cfg());
        setWorkspaces(data);
      } catch {}
    };
    load();
    const off = onLive(load);
    const t = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => {
      off();
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, []);
  return { workspaces };
}