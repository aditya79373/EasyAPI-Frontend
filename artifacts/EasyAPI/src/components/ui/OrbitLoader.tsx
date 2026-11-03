import { useInsertionEffect } from 'react';
import type { CSSProperties } from 'react';
/* ============ YAHAN SE TIMING BADLO ============ */
const CONFIG = {
  FRAME_MS: 43.6,
  // Aate time slow (jaisa tha waisa)
  ENTER: { frames: 8, slow: 1.9 },
  // Jate time slow (jaisa tha waisa)
  EXIT: { frames: 10, slow: 2.5 },
  // Baaki sab jagah tez: 1 = normal speed (pehle 4 tha, isliye slow lag raha tha)
  CALM: { slow: 1, sprint: 30 },
  PAUSE_MS: 800,
};
/* ================================================ */

const STAGGER_FRAMES = 3; // ek dot ke baad doosra kitni der baad aata hai
const END = 62; // ek dot ke 2 chakkar = 62 frames
const FADE = 2;

// Ek dot ka angle (degree, clockwise from top) har frame pe, original GIF se
const LOOP = [
  180, 232.4, 265.3, 282.2, 299.2, 308.1, 317.1, 326, 331, 336, 341, 346, 349.1, 352, 355.1, 358,
  361.1, 364, 367.1, 370.1, 373.1, 378.1, 383, 388, 393.1, 402.1, 411.1, 420.1, 437.2, 454.3,
  487.4, 540,
];
const YS = [...LOOP, ...LOOP.slice(1).map((a) => a + 360)]; // 63 points, 2 turns

// Smooth curve (monotone cubic) jo in points se guzarti hai
function makeCurve(ys: number[]) {
  const n = ys.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push(ys[i + 1] - ys[i]);
  const m: number[] = new Array(n);
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  }
  m[0] = (3 * d[0] - m[1]) / 2;
  m[n - 1] = (3 * d[n - 2] - m[n - 2]) / 2;
  return (x: number) => {
    const i = Math.max(0, Math.min(Math.floor(x), n - 2));
    const t = x - i;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * m[i + 1]
    );
  };
}

function buildCss() {
  const { FRAME_MS, ENTER, EXIT, CALM, PAUSE_MS } = CONFIG;
  const curve = makeCurve(YS);

  // Speed multiplier: shuru aur aakhir mein bahut slow, phir dheere dheere normal (jhatka nahi)
  const eF = Math.min(ENTER.frames, END / 2);
  const xF = Math.min(EXIT.frames, END / 2);
  const ease = (x: number) => x * x * (3 - 2 * x);
  const mult = (r: number) => {
    if (r < eF) return 1 + (ENTER.slow - 1) * ease(1 - r / eF);
    if (r > END - xF) return 1 + (EXIT.slow - 1) * ease((r - (END - xF)) / xF);
    return 1;
  };
  // Jahan dot bhaag raha hai (tez chaal) wahan normal speed, baaki jagah CALM.slow guna slow
  const calm = (r: number) => {
    const v = Math.abs(curve(Math.min(END, r + 0.05)) - curve(Math.max(0, r - 0.05))) / 0.1;
    return 1 + 0.5 * ease(Math.min(1, v / CALM.sprint));
  };
  const DR = 0.02;
  const N = Math.round(END / DR);
  const T = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) T[i] = T[i - 1] + FRAME_MS * DR * mult((i - 0.5) * DR) * calm((i - 0.5) * DR);
  const motionMs = T[N];
  const relAt = (t: number) => {
    let lo = 0;
    let hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (T[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    return (i - 1 + (t - T[i - 1]) / (T[i] - T[i - 1])) * DR;
  };

  const stagger = STAGGER_FRAMES * FRAME_MS;
  const cycle = Math.round(4 * stagger + motionMs + PAUSE_MS);
  const opacity = (r: number) =>
    r < FADE ? r / FADE : r > END - FADE ? Math.max(0, (END - r) / FADE) : 1;

  const frames: string[] = [];
  for (let t = 0; t < motionMs; t += 15) {
    const r = relAt(t);
    frames.push(
      `${((t / cycle) * 100).toFixed(3)}%{transform:rotate(calc(var(--off) + ${curve(r).toFixed(1)}deg));opacity:${opacity(r).toFixed(2)}}`,
    );
  }
  frames.push(
    `${((motionMs / cycle) * 100).toFixed(3)}%,100%{transform:rotate(calc(var(--off) + ${curve(END).toFixed(1)}deg));opacity:0}`,
  );

  const dots = [0, 1, 2, 3, 4]
    .map(
      (k) =>
        `.orbit-loader i:nth-child(${k + 1}){--off:${-15 * k}deg;animation-delay:${Math.round(k * stagger)}ms}`,
    )
    .join('');

  return `
.orbit-loader{--s:64px;position:relative;display:inline-block;width:var(--s);height:var(--s);color:hsl(var(--foreground));flex-shrink:0}
.orbit-loader i{position:absolute;inset:0;opacity:0;will-change:transform,opacity;animation:orbit-spin ${cycle}ms linear infinite both}
.orbit-loader i::before{content:'';position:absolute;left:50%;top:0;width:12.5%;height:12.5%;margin-left:-6.25%;border-radius:50%;background:var(--dot,currentColor)}
${dots}
@keyframes orbit-spin{${frames.join('')}}`;
}

const CSS = buildCss();

export function OrbitLoader({ color,size }: { color?: string; size?: number }) {
  useInsertionEffect(() => {
    let el = document.getElementById('orbit-loader-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'orbit-loader-style';
      document.head.appendChild(el);
    }
    // Har baar naya CSS lagao, taaki CONFIG badalne par turant asar dikhe
    if (el.textContent !== CSS) el.textContent = CSS;
  }, []);

const style = {
  ...(color ? { color, '--dot': color } : {}),
  ...(size ? { '--s': `${size}px` } : {}),
} as CSSProperties;
  return (
    <span className="orbit-loader" role="status" aria-label="Loading" style={style}>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}