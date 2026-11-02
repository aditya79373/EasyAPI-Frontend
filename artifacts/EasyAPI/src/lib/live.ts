const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const listeners = new Set<() => void>();
let es: EventSource | null = null;

export const onLive = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};

export function startLive() {
  if (es) return;
  const token = localStorage.getItem('sp_token');
  if (!token) return;
  es = new EventSource(`${API}/api/events?token=${encodeURIComponent(token)}`);
  es.onmessage = () => listeners.forEach((f) => f());
}

export function stopLive() {
  es?.close();
  es = null;
}