export type Theme = 'dark' | 'light';
const KEY = 'theme'; // yahan wahi key rakho jo tumhare code mein pehle se use ho rahi hai

export const getTheme = (): Theme =>
  localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';

export function applyTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  document.documentElement.setAttribute('data-theme', t);
}