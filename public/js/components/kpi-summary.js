import { $, R, R0, dk } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getDynamicCarCosts, persistConfig } from '../services/car-service.js';
import { calcularProjecaoDia, calcularProjecaoSemana } from '../services/metrics-service.js';
import { showToast } from './toast.js';

export function renderKpiSummary() {
  const { rows, cfg, metrics } = useStore();
  const { days, sess, ativa } = metrics;
  const now = new Date();
  const k = dk(now);
  const d = days[k] || { g: 0, d: 0, n: 0, km: 0, h: 0 };
  const dyn = getDynamicCarCosts();

  if ($('#hoje')) {
    $('#hoje').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
  }
  if ($('#gDia')) $('#gDia').textContent = R(d.g);
  if ($('#kH')) $('#kH').textContent = d.h ? R0(d.g / d.h) : '—';
  if ($('#kKm')) $('#kKm').textContent = d.km ? (d.g / d.km).toFixed(2).replace('.', ',') : '—';
  if ($('#kN')) $('#kN').textContent = d.n;

  // Custo dinâmico do carro no dia
  const kmDia = d.km || 0;
  const custoCombDia = kmDia * dyn.custoKmCombustivel;
  const custoFixoDia = (d.n > 0 || d.h > 0) ? dyn.aluguelDia : 0;
  const custoTotalCarroDia = custoFixoDia + custoCombDia;

  let despOutrasHoje = 0;
  let despCombHoje = 0;
  let despAluguelHoje = 0;
  for (const r of rows) {
    if (dk(r.ts) === k && r.tipo === 'despesa') {
      const cat = (r.categoria || '').toLowerCase();
      const val = +r.valor || 0;
      if (cat === 'combustivel') despCombHoje += val;
      else if (cat === 'aluguel') despAluguelHoje += val;
      else despOutrasHoje += val;
    }
  }

  const custoEfetivoCarro = Math.max(custoTotalCarroDia, despCombHoje + despAluguelHoje);
  const lucroLiq = d.g - custoEfetivoCarro - despOutrasHoje;

  if ($('#kL')) {
    $('#kL').textContent = d.n ? R0(lucroLiq) : '—';
    $('#kL').style.color = lucroLiq >= 0 ? 'var(--ac)' : 'var(--bad)';
  }

  // Detalhe de custos do carro
  if ($('#carCustoInfo')) {
    if (d.n > 0 || kmDia > 0 || custoEfetivoCarro > 0) {
      $('#carCustoInfo').style.display = 'flex';
      if ($('#kCustoCarroVal')) $('#kCustoCarroVal').textContent = R(custoEfetivoCarro);
      const tagComb = dyn.isDynamicFuel ? '⚡ real' : 'est.';
      if ($('#kCustoCarroDet')) {
        $('#kCustoCarroDet').textContent = `(Aluguel: ${R(custoFixoDia)} + Combustível: ${R(custoCombDia)} [${R(dyn.custoKmCombustivel)}/km ${tagComb}])`;
      }
    } else {
      $('#carCustoInfo').style.display = 'none';
    }
  }

  // Projeções
  const { pDia, avgDay } = calcularProjecaoDia(d, now, days, cfg);
  if ($('#pDia')) $('#pDia').textContent = pDia ? R0(pDia) : '—';

  const { gs, pSem } = calcularProjecaoSemana(now, days, d, pDia, avgDay, cfg);
  const sAtual = ativa ? sess[sess.length - 1] : null;

  const metaSessao = cfg.meta_sessao || DEF.meta_sessao;
  const metaLucroSessao = cfg.meta_lucro_sessao || DEF.meta_lucro_sessao;
  const metaLucroDia = cfg.meta_lucro_dia || DEF.meta_lucro_dia;

  const ms = [
    ['Dia', d.g, cfg.meta_dia || DEF.meta_dia, pDia, `Lucro líq.: ${R0(lucroLiq)} / meta ${R0(metaLucroDia)}`],
    ['Semana', gs, cfg.meta_semana || DEF.meta_semana, pSem, null]
  ];

  if (sAtual) {
    const lucroEstSessao = sAtual.g - (sAtual.km || 0) * dyn.custoKmCombustivel - (dyn.aluguelDia || 0);
    ms.unshift(['Sessão', sAtual.g, metaSessao, null, `Lucro est.: ${R0(lucroEstSessao)} / meta ${R0(metaLucroSessao)}`]);
  }

  if ($('#metas')) {
    $('#metas').innerHTML = ms.map(([n, v, m, p, sub]) => {
      const pc = Math.min(100, v / m * 100 || 0);
      return `<div class="meta">
        <div class="row">
          <span><b>${n}</b> <span class="mut">${R0(v)} / ${R0(m)}</span></span>
          <span class="mut">${v >= m ? '✅ batida' : 'faltam ' + R0(m - v)}${p ? ' · proj. ' + R0(p) : ''}</span>
        </div>
        <div class="bar"><i style="width:${pc}%;background:${pc >= 100 ? 'var(--ac)' : pc > 60 ? 'var(--ac2)' : 'var(--warn)'}"></i></div>
        ${sub ? `<div class="mut" style="font-size:11px;margin-top:2px">${sub}</div>` : ''}
      </div>`;
    }).join('');
  }

  return { d, pDia, gs, pSem, avgDay, sAtual };
}

export function initKpiSummary() {
  const form = $('#cf');
  if (!form) return;

  form.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const updates = {};
    for (const [k, v] of f) {
      const clean = String(v).trim();
      if (clean !== '') {
        updates[k] = parseFloat(clean.replace(',', '.')) || DEF[k];
      } else {
        updates[k] = DEF[k];
      }
    }
    await persistConfig(updates);
    showToast('Metas e finanças salvas ✓');
  };

  const ajudaEl = $('#ajuda');
  if (ajudaEl) {
    ajudaEl.innerHTML = `<b style="color:var(--tx)">Como lançar (app ou WhatsApp)</b><br>
<code>25,50 joão 14:30</code> corrida · <code>18 maria 6km</code> com km<br><code>odo 45230</code> odômetro · <code>gas 150</code> / <code>aluguel 500</code> despesa<br>
<code>inicio 45100</code> / <code>fim 45230</code> sessão · cada linha = um lançamento`;
  }
}
