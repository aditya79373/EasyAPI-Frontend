export type Theme = 'dark' | 'light';
const KEY = 'theme';

export const getTheme = (): Theme =>
  localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';

export function applyTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  document.documentElement.setAttribute('data-theme', t);
  // agar tumhara CSS class se chalta hai (.dark / .light), to ye bhi:
  // document.documentElement.classList.toggle('dark', t === 'dark');
}