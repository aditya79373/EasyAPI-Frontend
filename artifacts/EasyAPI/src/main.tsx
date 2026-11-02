import { createRoot } from 'react-dom/client';
import { setFavicon } from "./setFavicon";
import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import axios from 'axios';
import { showReadOnly } from './lib/readonly';
import './index.css';
import { applyTheme, getTheme } from './theme';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

axios.interceptors.request.use((config) => {
  const view = localStorage.getItem('sp_view');
  // sirf apne backend ko bhejo, tester ke bahari URLs ko nahi (warna CORS toot jayega)
  if (view && String(config.url || '').startsWith(API_BASE)) {
    config.headers['x-workspace'] = view;
  }
  return config;
});
// Viewer ne kuch badalne ki koshish ki: server 403 deta hai, message dikhao
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 403 && /read-only/i.test(String(err.response?.data?.message || '')))
      showReadOnly();
    return Promise.reject(err);
  },
);

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(API_BASE)) return realFetch(input, init);

  const view = localStorage.getItem('sp_view');
  let res: Response;
  if (view) {
    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined),
    );
    headers.set('x-workspace', view);
    res = await realFetch(input, { ...init, headers });
  } else {
    res = await realFetch(input, init);
  }
  if (res.status === 403) {
    res
      .clone()
      .json()
      .then((d) => /read-only/i.test(String(d?.message || '')) && showReadOnly())
      .catch(() => {});
  }
  return res;
};
 applyTheme(getTheme());
setFavicon();
const savedTheme = localStorage.getItem('sp_theme') === 'light' ? 'light' : 'dark';
document.documentElement.classList.toggle('light', savedTheme === 'light');
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);