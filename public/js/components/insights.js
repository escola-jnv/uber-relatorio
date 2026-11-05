import { $, R, R0, N1, weekStart } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getDynamicCarCosts } from '../services/car-service.js';

export function renderInsights({ d, pSem, gs } = {}) {
  const { rows, cfg, metrics } = useStore();
  const { days, hrsByH } = metrics;
  const container = $('#insList') || $('#t-ins');
  if (!container) return;

  const out = [];
  const now = new Date();
  const list = Object.entries(days).filter(([, v]) => v.n);
  const add = (t, x) => out.push(`<div class="ins"><b>${t}</b><span class="mut">${x}</span></div>`);

  if (!list.length) {
    container.innerHTML = '<div class="c mut">Lance algumas corridas (com início/fim de sessão e odômetro) para ver insights.</div>';
    return;
  }

  const metaDia = cfg.meta_dia || DEF.meta_dia;
  const falta = metaDia - (d?.g || 0);
  if (falta > 0 && (d?.h || 0) > 0.25) {
    const rate = d.g / d.h;
    add('🎯 Meta do dia', `Faltam ${R0(falta)}. No seu ritmo (${R0(rate)}/h) são mais ${N1(falta / rate)}h.`);
  } else if (falta <= 0) {
    add('✅ Meta do dia batida', `Você passou ${R0(-falta)} da meta. Tudo daqui pra frente é extra.`);
  }

  const metaSemana = cfg.meta_semana || DEF.meta_semana;
  if (pSem !== undefined && pSem < metaSemana) {
    const rest = Math.max(1, (cfg.dias_semana || DEF.dias_semana) - list.filter(([k]) => new Date(k + 'T12:00') >= weekStart(now)).length);
    add('📅 Semana', `Projeção ${R0(pSem)} de ${R0(metaSemana)}. Para bater, faça ~${R0((metaSemana - gs) / rest)} por dia nos ${rest} dia(s) restantes.`);
  }

  const lim = Date.now() - 30 * 864e5;
  const gH = Array(24).fill(0);
  for (const r of rows) {
    if (r.tipo === 'ganho' && new Date(r.ts) > lim) {
      gH[new Date(r.ts).getHours()] += +r.valor;
    }
  }

  if (hrsByH.some(x => x > 0)) {
    const best = gH.map((g, h) => ({
      h,
      rate: hrsByH[h] > 0.25 ? g / hrsByH[h] : 0
    })).filter(x => x.rate > 0).sort((a, b) => b.rate - a.rate).slice(0, 3);
    if (best.length) {
      add('⚡ Melhores horários', best.map(b => `${b.h}h (${R0(b.rate)}/h)`).join(' · '));
    }
  }

  const dyn = getDynamicCarCosts();
  const tot = list.reduce((a, [, v]) => ({
    g: a.g + v.g,
    km: a.km + v.km,
    d: a.d + v.d,
    n: a.n + v.n,
    h: a.h + v.h
  }), { g: 0, km: 0, d: 0, n: 0, h: 0 });

  if (tot.km > 0) {
    const rk = tot.g / tot.km;
    const liq = rk - dyn.custoKmCombustivel;
    add('🛣️ Ganho por km', `Média ${R(rk)}/km rodado; descontando combustível dinâmico (${R(dyn.custoKmCombustivel)}/km) sobra ${R(liq)}/km. ${rk < 2 ? 'Abaixo de R$ 2/km rodado: muito km vazio — evite rodar procurando passageiro.' : 'Bom aproveitamento.'}`);
  } else {
    add('🛣️ Lance o odômetro', 'Registre o odômetro no início e no fim para calcular R$/km e lucro real.');
  }

  const gan = rows.filter(r => r.tipo === 'ganho' && new Date(r.ts) > lim);
  const tk = gan.reduce((s, r) => s + +r.valor, 0) / (gan.length || 1);
  if (gan.length >= 10) {
    add('🎟️ Ticket médio', `${R(tk)} por corrida (${gan.length} em 30 dias).`);
  }

  if (tot.d > 0) {
    add('⛽ Despesas', `${Math.round(tot.d / tot.g * 100)}% do faturamento vai para despesas lançadas (${R0(tot.d)}).`);
  }

  container.innerHTML = '<div class="c">' + out.join('') + '</div>';
}
