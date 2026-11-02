import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type CachedTeam = { list: any[]; myRole: string };

export const teamKey = () => {
  let email = '';
  try {
    email = JSON.parse(localStorage.getItem('sp_user') || '{}').email || '';
  } catch {}
  return `sp_team_${email}_${localStorage.getItem('sp_view') || 'me'}`;
};

export const readTeam = (): CachedTeam | null => {
  try {
    return JSON.parse(localStorage.getItem(teamKey()) || 'null');
  } catch {
    return null;
  }
};

export async function fetchTeam(): Promise<CachedTeam | null> {
  try {
    const { data } = await axios.get(`${API}/api/team`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sp_token') || ''}` },
    });
    const out = { list: data.list, myRole: data.myRole };
    localStorage.setItem(teamKey(), JSON.stringify(out));
    return out;
  } catch {
    return null;
  }
}