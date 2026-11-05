import { dk, weekStart } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getDynamicCarCosts } from './car-service.js';

// Processamento e agregação de telemetria geral
export function computeMetrics(rows) {
  const asc = [...rows].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const now = Date.now();
  const days = {};
  const D = k => days[k] || (days[k] = { g: 0, d: 0, n: 0, kmT: 0, odo: [], min: 0, first: null, last: null, byH: {} });
  const sess = [];
  let open = null;
  const pausas = [];      // intervalos [ini, fim] de pausa
  let pausaOpen = null;

  for (const r of asc) {
    const t = new Date(r.ts);
    const d = D(dk(t));
    const v = +r.valor || 0;

    if (r.tipo === 'ganho') {
      d.g += v;
      d.n++;
      d.kmT += +r.km || 0;
      d.first = d.first || t;
      d.last = t;
      const h = t.getHours();
      d.byH[h] = (d.byH[h] || 0) + v;
    } else if (r.tipo === 'despesa') {
      d.d += v;
    } else if (r.tipo === 'odometro' && v) {
      d.odo.push(v);
    } else if (r.tipo === 'pausa_ini') {
      if (!pausaOpen) pausaOpen = t;
    } else if (r.tipo === 'pausa_fim') {
      if (pausaOpen) { pausas.push({ ini: pausaOpen, fim: t }); pausaOpen = null; }
    } else if (r.tipo === 'sessao_ini') {
      if (open) close(open, t);
      open = { ini: t, odo0: v || null };
      if (v) d.odo.push(v);
    } else if (r.tipo === 'sessao_fim') {
      if (v) d.odo.push(v);
      if (open) {
        open.odo1 = v || null;
        close(open, t);
        open = null;
      }
    }
  }

  function close(s, t) {
    s.fim = t;
    sess.push(s);
  }

  let ativa = null;
  if (open) {
    if (now - open.ini < 16 * 36e5) {
      ativa = open;
      sess.push({ ...open, fim: new Date(), ativa: true });
    } else {
      sess.push({ ...open, fim: new Date(+open.ini + 36e5) });
    }
  }

  // pausa ainda aberta: conta até agora (descarta se esquecida há mais de 6h)
  let pausaAtiva = null;
  if (pausaOpen) {
    if (now - pausaOpen < 6 * 36e5) {
      pausaAtiva = { ini: pausaOpen };
      pausas.push({ ini: pausaOpen, fim: new Date(now), ativa: true });
    }
  }
  const emPausa = t => pausas.some(p => t >= +p.ini && t < +p.fim);

  const hrsByH = Array(24).fill(0);
  for (const s of sess) {
    let pausaMs = 0;
    for (const p of pausas) {
      pausaMs += Math.max(0, Math.min(+s.fim, +p.fim) - Math.max(+s.ini, +p.ini));
    }
    s.pausaMin = pausaMs / 6e4;
    const dd = D(dk(s.ini));
    dd.min += Math.max(0, (s.fim - s.ini) / 6e4 - s.pausaMin);
    dd.pausaMin = (dd.pausaMin || 0) + s.pausaMin;
    for (let t = +s.ini; t < +s.fim; t += 6e4 * 5) {
      if (!emPausa(t)) hrsByH[new Date(t).getHours()] += 5 / 60;
    }
  }

  for (const k in days) {
    const d = days[k];
    d.h = d.min ? d.min / 60 : (d.n ? Math.max(0.5, (d.last - d.first) / 36e5 + 0.33) : 0);
    const o = d.odo.filter(x => x > 1000).sort((a, b) => a - b);
    d.km = o.length > 1 ? o[o.length - 1] - o[0] : d.kmT;
  }

  for (const s of sess) {
    s.g = 0;
    s.n = 0;
    s.km = 0;
    let minOdo = (s.odo0 && s.odo0 > 1000) ? s.odo0 : null;
    let maxOdo = (s.odo1 && s.odo1 > 1000) ? s.odo1 : minOdo;

    for (const r of asc) {
      const t = new Date(r.ts);
      if (t >= s.ini && t <= s.fim) {
        if (r.tipo === 'ganho') {
          s.g += +r.valor;
          s.n++;
          if (r.km) s.km += +r.km;
        }
        const v = +r.valor || 0;
        if ((r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim') && v > 1000) {
          if (!minOdo || v < minOdo) minOdo = v;
          if (!maxOdo || v > maxOdo) maxOdo = v;
        }
      }
    }
    if (minOdo && maxOdo && maxOdo > minOdo) {
      s.km = Math.max(s.km, maxOdo - minOdo);
    }
  }

  return { days, sess, ativa, pausas, pausaAtiva, hrsByH, asc };
}

// Estimação e interpolação de odômetros e tempos entre corridas
export function computeAllOdometersAndTimes(rows, days = {}) {
  const asc = [...rows].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  let lastOdo = null;
  let lastTime = null;

  for (const r of asc) {
    const v = +r.valor || 0;
    if ((r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim') && v > 1000) {
      if (lastOdo !== null && v >= lastOdo) {
        r._deltaOdo = v - lastOdo;
      }
      lastOdo = v;
      lastTime = new Date(r.ts);
    } else if (r.tipo === 'ganho') {
      if (lastTime) {
        const diffMs = new Date(r.ts) - lastTime;
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin > 0 && diffMin <= 300) {
          r._tempoMin = diffMin;
        }
      }
      lastTime = new Date(r.ts);
    }
  }

  return asc;
}

// Calcula Meta da Sessão Sugerida baseada na Meta de Lucro Líquido
export function calcularMetaSessaoSugerida(lucroCustom = null) {
  const { cfg } = useStore();
  const lucroAlvo = lucroCustom !== null ? +lucroCustom : +(cfg.meta_lucro_sessao || DEF.meta_lucro_sessao || 150);
  const dyn = getDynamicCarCosts();
  const aluguel = dyn.aluguelDia;
  const custoKm = dyn.custoKmCombustivel;

  // Ganho médio de referência por km em corridas (R$ 2,50/km)
  const rkRef = 2.50;
  const margemLiqCombustivel = Math.max(0.65, Math.min(0.92, 1 - (custoKm / rkRef)));

  // Meta bruta necessária para sobrar o lucro desejado cobrindo aluguel e combustível
  const metaBrutaCalc = (lucroAlvo + aluguel) / margemLiqCombustivel;
  const metaBrutaArredondada = Math.max(100, Math.round(metaBrutaCalc / 10) * 10);
  const custosEstimados = metaBrutaArredondada - lucroAlvo;

  return {
    metaBruta: metaBrutaArredondada,
    lucroAlvo,
    aluguel,
    custoKm,
    custosEstimados,
    combustivelEstimado: Math.max(0, custosEstimados - aluguel),
    isDynamicFuel: dyn.isDynamicFuel
  };
}

// Projeção de ganhos para o fechamento do dia
export function calcularProjecaoDia(d, now, days, cfg) {
  const k = dk(now);
  const past = Object.entries(days).filter(([key, v]) => key < k && v.n).slice(-28);
  const avgDay = past.length ? past.reduce((s, [, v]) => s + v.g, 0) / past.length : 0;
  const wd = now.getDay();
  const sameWd = past.filter(([key]) => new Date(key + 'T12:00').getDay() === wd);
  const avgWd = sameWd.length ? sameWd.reduce((s, [, v]) => s + v.g, 0) / sameWd.length : avgDay;

  let pDia;
  if (d.h > 0.5) {
    pDia = d.g + (d.g / d.h) * Math.max(0, (cfg.horas_dia || DEF.horas_dia) - d.h);
  } else {
    pDia = Math.max(d.g, avgWd);
  }

  return { pDia, avgDay, avgWd };
}

// Projeção de ganhos para o fechamento da semana
export function calcularProjecaoSemana(now, days, d, pDia, avgDay, cfg) {
  const ws = weekStart(now);
  let gs = 0;
  let worked = 0;
  for (const key in days) {
    const t = new Date(key + 'T12:00');
    if (t >= ws) {
      gs += days[key].g;
      if (days[key].n) worked++;
    }
  }

  const restDias = Math.max(0, (cfg.dias_semana || DEF.dias_semana) - worked - (d.n ? 0 : 1));
  const pSem = gs - d.g + Math.max(d.g, pDia) + restDias * (avgDay || pDia);

  return { gs, pSem, worked, restDias };
}
