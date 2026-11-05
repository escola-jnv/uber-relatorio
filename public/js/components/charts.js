import { $, R0, dk, weekStart } from '../utils/format.js';
import { DEF, DS } from '../utils/constants.js';
import { useStore } from '../state/store.js';

export function bars(data, { h = 150, meta = null, fmt = R0, color = 'var(--ac)' } = {}) {
  const W = 520;
  const pl = 4;
  const pb = 18;
  const max = Math.max(meta || 0, ...data.map(d => d.v), 1) * 1.1;
  const bw = (W - pl) / data.length;

  let s = `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img">`;
  data.forEach((d, i) => {
    const bh = (d.v / max) * (h - pb - 22);
    const x = pl + i * bw + bw * 0.15;
    const y = h - pb - bh;
    s += `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${Math.max(bh, 0)}" rx="3" fill="${d.c || color}" opacity="${d.dim ? 0.45 : 1}"><title>${d.l}: ${fmt(d.v)}</title></rect>`;
    if (d.v && data.length <= 16) {
      s += `<text x="${x + bw * 0.35}" y="${y - 3}" text-anchor="middle">${d.v >= 1000 ? (d.v / 1000).toFixed(1) + 'k' : Math.round(d.v)}</text>`;
    }
    if (data.length <= 16 || i % 2 === 0) {
      s += `<text x="${x + bw * 0.35}" y="${h - 5}" text-anchor="middle">${d.l}</text>`;
    }
  });

  if (meta) {
    const y = h - pb - (meta / max) * (h - pb - 22);
    s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--warn)" stroke-dasharray="4 4"/><text x="${W - 2}" y="${y - 3}" text-anchor="end" style="fill:var(--warn)">meta</text>`;
  }

  return s + '</svg>';
}

export function renderCharts() {
  const { rows, cfg, metrics } = useStore();
  const { days, hrsByH } = metrics;
  const container = $('#t-graf');
  if (!container) return;

  const now = new Date();
  const d14 = [];
  for (let i = 13; i >= 0; i--) {
    const t = new Date(now);
    t.setDate(t.getDate() - i);
    const v = days[dk(t)] || {};
    d14.push({
      l: i ? DS[t.getDay()].slice(0, 1) + t.getDate() : 'hoje',
      v: v.g || 0
    });
  }

  const lim = Date.now() - 30 * 864e5;
  const gH = Array(24).fill(0);
  for (const r of rows) {
    if (r.tipo === 'ganho' && new Date(r.ts) > lim) {
      const h = new Date(r.ts).getHours();
      gH[h] += +r.valor;
    }
  }

  const useRate = hrsByH.some(x => x > 0);
  const perH = gH.map((g, h) => ({
    l: String(h),
    v: useRate ? (hrsByH[h] > 0.25 ? g / hrsByH[h] : 0) : g
  }));

  const wsum = Array(7).fill(0);
  const wn = Array(7).fill(0);
  for (const [key, v] of Object.entries(days)) {
    if (v.n) {
      const w = new Date(key + 'T12:00').getDay();
      wsum[w] += v.g;
      wn[w]++;
    }
  }
  const wk = [1, 2, 3, 4, 5, 6, 0].map(w => ({
    l: DS[w],
    v: wn[w] ? wsum[w] / wn[w] : 0
  }));

  const ws = {};
  for (const [key, v] of Object.entries(days)) {
    const s = dk(weekStart(key + 'T12:00'));
    ws[s] = (ws[s] || 0) + v.g;
  }
  const sem = Object.entries(ws).sort().slice(-8).map(([s, v]) => ({
    l: s.slice(8) + '/' + s.slice(5, 7),
    v
  }));

  container.innerHTML =
    `<div class="c"><b>Ganhos — 14 dias</b>${bars(d14, { meta: cfg.meta_dia || DEF.meta_dia })}</div>` +
    `<div class="c"><b>${useRate ? 'R$ por hora rodada' : 'Ganhos'} por horário</b> <span class="mut">30 dias</span>${bars(perH, { h: 130, color: 'var(--ac2)' })}</div>` +
    `<div class="c"><b>Média por dia da semana</b>${bars(wk, { h: 130, meta: cfg.meta_dia || DEF.meta_dia })}</div>` +
    `<div class="c"><b>Semanas</b>${bars(sem, { h: 130, meta: cfg.meta_semana || DEF.meta_semana, color: 'var(--ac2)' })}</div>`;
}
