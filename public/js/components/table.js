import { $, R, R0, N1, pad, dk, hm, esc } from '../utils/format.js';
import { ALL_COLUMNS, CAT_ICONS, CAT_LABELS, DS } from '../utils/constants.js';
import { store, useStore } from '../state/store.js';
import { findCar, getActiveCar, getRowCar, getRowObs, getDynamicCarCosts } from '../services/car-service.js';
import { openEditModal } from './modals/edit-modal.js';
import { setFilterPreset } from './date-filter.js';
import { normalizeOdoRows } from '../utils/odometer.js';

export function getItemIcon(r) {
  if (r.tipo === 'ganho') return '💵';
  if (r.tipo === 'odometro') return '🧭';
  if (r.tipo === 'sessao_ini') return '▶️';
  if (r.tipo === 'sessao_fim') return '⏹️';
  if (r.tipo === 'pausa_ini') return '⏸️';
  if (r.tipo === 'pausa_fim') return '⏯️';
  if (r.tipo === 'despesa') return CAT_ICONS[r.categoria] || '⛽';
  return '•';
}

export function getItemCat(r) {
  const tag = r.origem && r.origem !== 'manual' ? `<span class="tag">${r.origem === 'whatsapp' ? 'whats' : esc(r.origem)}</span>` : '';
  if (r.tipo === 'ganho') return esc(r.categoria || 'Corrida') + tag;
  if (r.tipo === 'despesa') {
    const l = CAT_LABELS[r.categoria] || (r.categoria ? r.categoria.charAt(0).toUpperCase() + r.categoria.slice(1) : 'Despesa');
    return esc(l) + tag;
  }
  if (r.tipo === 'odometro') return 'Odômetro';
  if (r.tipo === 'sessao_ini') return 'Início sessão';
  if (r.tipo === 'sessao_fim') return 'Fim sessão' + tag;
  if (r.tipo === 'pausa_ini') return 'Início pausa' + tag;
  if (r.tipo === 'pausa_fim') return 'Fim pausa' + tag;
  return '—';
}

export function getItemOdo(r) {
  if (r._odo !== undefined && r._odo !== null) {
    const odoStr = Number(r._odo).toLocaleString('pt-BR') + ' km';
    if (r._odoEst) {
      return `<span title="Odômetro estimado automaticamente: ${odoStr}">~${odoStr} <span class="tag-est" title="Estimado (não lançado)">est.</span></span>`;
    }
    return `<span title="Odômetro lançado: ${odoStr}"><b>${odoStr}</b></span>`;
  }
  if (r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim') {
    const estTag = r._est ? '<span class="tag-est">est.</span>' : '';
    return (r.valor ? Number(r.valor).toLocaleString('pt-BR') + ' km' : '—') + estTag;
  }
  return '<span class="mut">—</span>';
}

export function getItemObs(r) {
  const parts = [];
  if (r.tipo === 'ganho' && r.passageiro) parts.push(esc(r.passageiro));
  const c = getRowObs(r);
  if (c) parts.push(esc(c));
  return parts.length ? parts.join(' · ') : '<span class="mut">—</span>';
}

export function getItemVal(r) {
  if (r.tipo === 'ganho') return `<span class="val-pos">+${R(+r.valor)}</span>`;
  if (r.tipo === 'despesa') return `<span class="val-neg">−${R(+r.valor)}</span>`;
  return '<span class="mut">—</span>';
}

export function renderTableCell(colId, r) {
  switch (colId) {
    case 'col-ic':
      return `<td class="col-ic"><span class="ic">${getItemIcon(r)}</span></td>`;
    case 'col-h': {
      const t = new Date(r.ts);
      const dtStr = `${pad(t.getDate())}/${pad(t.getMonth() + 1)}`;
      const hmStr = hm(t);
      return `<td class="col-h" title="${t.toLocaleDateString('pt-BR')} ${hmStr}"><span class="mut" style="font-size:11px;margin-right:4px">${dtStr}</span><b>${hmStr}</b></td>`;
    }
    case 'col-carro': {
      const tag = r._carTag || (r._carObj ? r._carObj.placa : null);
      if (tag) {
        const name = r._carObj ? r._carObj.nome : 'Carro';
        return `<td class="col-carro" title="${esc(name)} (${esc(tag)}) · R$ ${N1(r._carCustoKm)}/km"><span class="car-badge"><span class="car-plate">${esc(tag)}</span></span></td>`;
      }
      return `<td class="col-carro"><span class="mut">—</span></td>`;
    }
    case 'col-odo':
      return `<td class="col-odo">${getItemOdo(r)}</td>`;
    case 'col-km-tot': {
      if (r.tipo === 'ganho') {
        if (r._kmTot > 0) {
          if (r._kmVazio > 0) {
            return `<td class="col-km-tot" title="Passageiro: ${N1(r._kmPass)} km | Vazio: ${N1(r._kmVazio)} km">${N1(r._kmTot)} km <span class="mut" style="font-size:10px">(${N1(r._kmPass)}p+${N1(r._kmVazio)}v)</span></td>`;
          }
          return `<td class="col-km-tot">${N1(r._kmTot)} km</td>`;
        }
        return `<td class="col-km-tot"><span class="mut">—</span></td>`;
      }
      if (r._deltaOdo) {
        return `<td class="col-km-tot"><span class="val-pos">+${N1(r._deltaOdo)} km</span></td>`;
      }
      return `<td class="col-km-tot"><span class="mut">—</span></td>`;
    }
    case 'col-tempo': {
      if (r._pausaMin > 0) {
        const hhmm = `${pad(Math.floor(r._pausaMin / 60))}:${pad(Math.round(r._pausaMin % 60))}`;
        return `<td class="col-tempo" title="Pausa de ${r._pausaMin} min (não conta como tempo rodado)">⏸ ${hhmm}</td>`;
      }
      if (r._tempoMin && r._tempoMin > 0) {
        const h = Math.floor(r._tempoMin / 60);
        const m = Math.round(r._tempoMin % 60);
        const hhmm = `${pad(h)}:${pad(m)}`;
        return `<td class="col-tempo" title="${r._tempoMin} min totais (${hhmm})">${hhmm}</td>`;
      }
      return `<td class="col-tempo"><span class="mut">—</span></td>`;
    }
    case 'col-cat':
      return `<td class="col-cat">${getItemCat(r)}</td>`;
    case 'col-passageiro':
      return `<td class="col-passageiro" title="${esc(r.passageiro || '—')}">${r.passageiro ? esc(r.passageiro) : '<span class="mut">—</span>'}</td>`;
    case 'col-obs': {
      const text = getItemObs(r);
      return `<td class="col-obs" title="${esc(text).replace(/<[^>]+>/g, '')}">${text}</td>`;
    }
    case 'col-v':
      return `<td class="col-v">${getItemVal(r)}</td>`;
    case 'col-lucro': {
      if (r.tipo === 'ganho') {
        const title = `Bruto: ${R(+r.valor)} | Custo veículo: ${R(r._custo || 0)} (Combustível: R$ ${N1(r._carCustoKm)}/km + Aluguel)`;
        const cls = r._lucro >= 0 ? 'val-pos' : 'val-neg';
        return `<td class="col-lucro" title="${title}"><span class="${cls}">+${R(r._lucro)}</span></td>`;
      }
      if (r.tipo === 'despesa') {
        return `<td class="col-lucro"><span class="val-neg">−${R(+r.valor)}</span></td>`;
      }
      return `<td class="col-lucro"><span class="mut">—</span></td>`;
    }
    case 'col-r-hora': {
      if (r._rHora) {
        const cls = r._rHora >= 50 ? 'val-pos' : (r._rHora < 25 ? 'val-warn' : '');
        return `<td class="col-r-hora" title="Ganho bruto dividido pelo tempo total do ciclo da corrida"><span class="${cls}">${R0(r._rHora)}/h</span></td>`;
      }
      return `<td class="col-r-hora"><span class="mut">—</span></td>`;
    }
    case 'col-subtot': {
      const s = r._subtotal || 0;
      const cls = s >= 0 ? 'val-pos' : 'val-neg';
      return `<td class="col-subtot" title="Saldo acumulado de hoje até este ponto do dia"><span class="${cls}">${R(s)}</span></td>`;
    }
    case 'col-edit':
    case 'col-x':
      // Ícone de lápis permitindo editar infos do lançamento
      return `<td class="col-edit col-x" style="text-align:center">
        <button type="button" class="edit-btn" data-edit="${r.id}" title="Editar informações do lançamento" aria-label="Editar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </td>`;
    default:
      return '<td>—</td>';
  }
}

/* ---------- Estimativa Contínua de Odômetro e Tempo Rodado ---------- */
export function computeAllOdometersAndTimes(allRows) {
  normalizeOdoRows(allRows); // completa leituras de 3 dígitos do WhatsApp (r._odoFull)
  const asc = [...allRows].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  // 1. Agrupar por carro para rastreamento de odômetro independente
  const byCar = {};
  for (const r of asc) {
    const carTag = getRowCar(r) || (r._carObj ? r._carObj.placa : (getActiveCar() ? getActiveCar().placa : 'geral'));
    (byCar[carTag] = byCar[carTag] || []).push(r);
  }

  for (const carRows of Object.values(byCar)) {
    const anchors = [];
    for (let i = 0; i < carRows.length; i++) {
      const r = carRows[i];
      // leitura completa (3 dígitos do WhatsApp já completados por normalizeOdoRows)
      let exact = null;
      if (r.odometro && +r.odometro >= 1000) exact = +r.odometro;
      else if (r._odoFull && r._odoFull >= 1000) exact = r._odoFull;

      if (exact !== null && exact > 0) {
        r._exactOdo = exact;
        r._odo = exact;
        r._odoEst = false;
        anchors.push(i);
      } else {
        r._exactOdo = null;
        r._odo = null;
        r._odoEst = true;
      }

      let dKm = 0;
      if (r.km && +r.km > 0) dKm = +r.km;
      else if (r.tipo === 'ganho' && /cancelamento/i.test(r.obs || '')) dKm = 0; // taxa de cancelamento não roda km
      else if (r.tipo === 'ganho') {
        dKm = +r.valor > 0 ? Math.max(1.5, Math.round((+r.valor / 2.4) * 10) / 10) : 3;
      }
      r._estDeltaKm = dKm;
    }

    if (anchors.length > 0) {
      // Antes da primeira âncora: retroage
      const firstIdx = anchors[0];
      let cur = carRows[firstIdx]._odo;
      for (let i = firstIdx - 1; i >= 0; i--) {
        cur -= (carRows[i + 1]._estDeltaKm || 1);
        carRows[i]._odo = Math.max(0, Math.round(cur));
        carRows[i]._odoEst = true;
      }

      // Entre cada par de âncoras: interpola proporcionalmente aos km ou tempo
      for (let a = 0; a < anchors.length - 1; a++) {
        const iA = anchors[a], iB = anchors[a + 1];
        if (iB - iA <= 1) continue;
        const oA = carRows[iA]._odo, oB = carRows[iB]._odo;
        const realDelta = oB - oA;
        const slice = carRows.slice(iA + 1, iB);
        const sumD = slice.reduce((s, x) => s + (x._estDeltaKm || 0), 0);

        if (realDelta > 0 && sumD > 0) {
          const factor = realDelta / sumD;
          let running = oA;
          for (const row of slice) {
            running += (row._estDeltaKm || 0) * factor;
            row._odo = Math.round(running);
            row._odoEst = true;
          }
        } else if (realDelta > 0) {
          const tA = new Date(carRows[iA].ts).getTime();
          const tB = new Date(carRows[iB].ts).getTime();
          const dt = Math.max(1, tB - tA);
          for (const row of slice) {
            const t = new Date(row.ts).getTime();
            const ratio = Math.max(0, Math.min(1, (t - tA) / dt));
            row._odo = Math.round(oA + realDelta * ratio);
            row._odoEst = true;
          }
        } else {
          let running = oA;
          for (const row of slice) {
            running += (row._estDeltaKm || 0);
            row._odo = Math.round(running);
            row._odoEst = true;
          }
        }
      }

      // Após a última âncora: avança a partir do último odômetro
      const lastIdx = anchors[anchors.length - 1];
      let curLast = carRows[lastIdx]._odo;
      for (let i = lastIdx + 1; i < carRows.length; i++) {
        curLast += (carRows[i]._estDeltaKm || 1);
        carRows[i]._odo = Math.round(curLast);
        carRows[i]._odoEst = true;
      }
    } else {
      let cur = 50000;
      for (let i = 0; i < carRows.length; i++) {
        cur += (carRows[i]._estDeltaKm || 1);
        carRows[i]._odo = Math.round(cur);
        carRows[i]._odoEst = true;
      }
    }
  }

  // 2. Cálculo do tempo rodado (HH:MM)
  let prevPoint = null;
  let pausaIni = null;
  for (const r of asc) {
    r._pausaMin = null;
    if (r.tipo === 'pausa_ini') {
      pausaIni = r;
      r._tempoMin = null;
      continue;
    }
    if (r.tipo === 'pausa_fim') {
      if (pausaIni) {
        const m = Math.round((new Date(r.ts) - new Date(pausaIni.ts)) / 6e4);
        r._pausaMin = m > 0 ? m : null;
        pausaIni = null;
      }
      r._tempoMin = null;
      prevPoint = r; // próxima corrida conta o tempo a partir da retomada
      continue;
    }
    let durMin = null;
    if (r.obs) {
      const m = r.obs.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
      if (m) {
        let t1 = (+m[1]) * 60 + (+m[2]);
        let t2 = (+m[3]) * 60 + (+m[4]);
        if (t2 < t1) t2 += 24 * 60;
        const d = t2 - t1;
        if (d > 0 && d < 480) durMin = d;
      }
      if (!durMin) {
        const mMin = r.obs.match(/(\d+)\s*min\b/i);
        if (mMin && +mMin[1] > 0 && +mMin[1] < 480) durMin = +mMin[1];
      }
    }

    if (!durMin && prevPoint) {
      const sameDay = dk(r.ts) === dk(prevPoint.ts);
      if (sameDay) {
        const diffMs = new Date(r.ts) - new Date(prevPoint.ts);
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin > 0 && diffMin <= 240) durMin = diffMin;
      }
    }

    if (!durMin && r.tipo === 'ganho' && r.km && +r.km > 0) {
      durMin = Math.max(3, Math.round((+r.km / 25) * 60));
    }

    r._tempoMin = durMin || null;

    if (r.tipo === 'ganho' || r.tipo === 'sessao_ini' || r.tipo === 'odometro') {
      prevPoint = r;
    }
  }
}

export function renderLista() {
  const { rows, filter, visibleCols, columnOrder, metrics } = useStore();
  computeAllOdometersAndTimes(rows);
  const colMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));
  const order = Array.isArray(columnOrder) && columnOrder.length ? columnOrder : ALL_COLUMNS.map(c => c.id);
  const activeCols = order
    .filter(id => visibleCols.has(id) && colMap.has(id))
    .map(id => colMap.get(id));

  const filtered = rows.filter(r => {
    const k = dk(r.ts);
    if (filter.from && k < filter.from) return false;
    if (filter.to && k > filter.to) return false;
    return true;
  });

  let totG = 0;
  let totD = 0;
  let totN = 0;
  let totKm = 0;
  for (const r of filtered) {
    const v = +r.valor || 0;
    if (r.tipo === 'ganho') {
      totG += v;
      totN++;
      if (r.km) totKm += +r.km;
    } else if (r.tipo === 'despesa') {
      totD += v;
    }
  }

  const saldo = totG - totD;
  if ($('#fSumG')) $('#fSumG').textContent = R(totG);
  if ($('#fSumD')) $('#fSumD').textContent = R(totD);
  if ($('#fSumL')) {
    $('#fSumL').textContent = R(saldo);
    $('#fSumL').className = saldo >= 0 ? 'val-pos' : 'val-neg';
  }
  if ($('#fSumN')) $('#fSumN').textContent = totN;
  if ($('#fSumK')) $('#fSumK').textContent = totKm ? N1(totKm) + ' km' : '—';
  if ($('#fContador')) $('#fContador').textContent = `${filtered.length} registro${filtered.length === 1 ? '' : 's'}`;

  const listaEl = $('#lista');
  if (!listaEl) return;

  if (!filtered.length) {
    listaEl.innerHTML = `<div class="c mut" style="text-align:center;padding:24px 12px">
      Nenhum lançamento no período selecionado.<br>
      <button type="button" class="s" style="margin-top:10px;padding:6px 14px;font-size:12px" id="btnResetFilterTodos">Ver todos os lançamentos</button>
    </div>`;
    $('#btnResetFilterTodos')?.addEventListener('click', () => setFilterPreset('todos'));
    if ($('#mais')) $('#mais').hidden = true;
    return;
  }

  const groups = {};
  const shown = filter.shown || 100;
  for (const r of filtered.slice(0, shown)) {
    (groups[dk(r.ts)] || (groups[dk(r.ts)] = [])).push(r);
  }

  let tbodyHtml = '';
  for (const [key, items] of Object.entries(groups)) {
    const d = metrics.days ? (metrics.days[key] || {}) : {};
    const t = new Date(key + 'T12:00');

    // Processamento cronológico ascendente
    const itemsAsc = [...items].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    let dayRunningBalance = 0;
    let prevPoint = null;
    let lastOdo = null;

    for (const r of itemsAsc) {
      const v = +r.valor || 0;
      if (r.tipo === 'ganho') dayRunningBalance += v;
      else if (r.tipo === 'despesa') dayRunningBalance -= v;
      r._subtotal = dayRunningBalance;

      const carTag = getRowCar(r);
      const carObj = findCar(carTag) || getActiveCar();
      r._carObj = carObj;
      r._carTag = carTag || (carObj ? carObj.placa : null);

      const dyn = getDynamicCarCosts(carObj);
      const carCustoKm = dyn.custoKmCombustivel;
      r._carCustoKm = carCustoKm;

      if ((r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim') && v > 1000) {
        if (lastOdo !== null && v >= lastOdo) {
          r._deltaOdo = v - lastOdo;
        }
        lastOdo = v;
      }

      if (r.tipo === 'ganho') {
        const kmPass = +r.km || 0;
        let kmTot = 0;
        let kmVazio = 0;
        if (r._deltaOdo && r._deltaOdo > 0) {
          kmTot = r._deltaOdo;
          kmVazio = Math.max(0, kmTot - kmPass);
        } else if (kmPass > 0) {
          kmTot = kmPass;
        }
        r._kmPass = kmPass;
        r._kmVazio = kmVazio;
        r._kmTot = kmTot;

        if (!r._tempoMin && prevPoint) {
          const diffMs = new Date(r.ts) - new Date(prevPoint.ts);
          const diffMin = Math.round(diffMs / 60000);
          if (diffMin > 0 && diffMin <= 300) r._tempoMin = diffMin;
        }

        if (r._tempoMin && r._tempoMin >= 3 && v > 0) {
          r._rHora = v / (r._tempoMin / 60);
        }

        const kmBase = kmTot > 0 ? kmTot : kmPass;
        const custoCombustivel = kmBase * carCustoKm;
        const custoFixoCorrida = kmBase * dyn.custoFixoPorKm;
        const custoTotalCorrida = custoCombustivel + custoFixoCorrida;

        r._custo = custoTotalCorrida;
        r._lucro = v - custoTotalCorrida;
      } else if (r.tipo === 'despesa') {
        r._custo = v;
        r._lucro = -v;
      }

      if (r.tipo === 'ganho' || r.tipo === 'sessao_ini' || r.tipo === 'odometro' || r.tipo === 'pausa_fim') {
        prevPoint = r;
      }
    }

    let dayG = 0;
    let dayD = 0;
    let dayKm = 0;
    for (const item of items) {
      if (item.tipo === 'ganho') {
        dayG += +item.valor || 0;
        if (item.km) dayKm += +item.km;
      } else if (item.tipo === 'despesa') {
        dayD += +item.valor || 0;
      }
    }
    const dayKmStr = d.km ? Math.round(d.km) + ' km' : (dayKm ? N1(dayKm) + ' km' : '');
    const dayHStr = d.h ? N1(d.h) + 'h' : '';
    const dayPausaStr = d.pausaMin > 0 ? `⏸ ${Math.round(d.pausaMin)} min` : '';
    const dayMetaStr = [R(dayG), dayHStr, dayKmStr, dayPausaStr].filter(Boolean).join(' · ');

    tbodyHtml += `<tr class="tb-sep"><td colspan="${activeCols.length}"><div class="sep-row"><span><b>${DS[t.getDay()]} ${t.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</b></span><span>${dayMetaStr}</span></div></td></tr>`;

    for (const r of items) {
      tbodyHtml += '<tr>';
      for (const col of activeCols) {
        tbodyHtml += renderTableCell(col.id, r);
      }
      tbodyHtml += '</tr>';
    }
  }

  const theadHtml = activeCols.map(c => `<th class="${c.id}">${c.label}</th>`).join('');

  listaEl.innerHTML = `<div class="table-wrap"><table class="tb">
    <thead><tr>${theadHtml}</tr></thead>
    <tbody>${tbodyHtml}</tbody>
  </table></div>`;

  const maisBtn = $('#mais');
  if (maisBtn) {
    maisBtn.hidden = filtered.length <= shown;
    if (!maisBtn.hidden) {
      maisBtn.textContent = `Ver mais (${shown} de ${filtered.length})`;
    }
  }
}

export function initTable() {
  const listaEl = $('#lista');
  if (listaEl) {
    listaEl.onclick = e => {
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) {
        openEditModal(editBtn.dataset.edit);
        return;
      }
      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        openEditModal(delBtn.dataset.del);
      }
    };
  }

  const maisBtn = $('#mais');
  if (maisBtn) {
    maisBtn.onclick = () => {
      const { filter } = useStore();
      store.setFilter({ shown: (filter.shown || 100) + 100 });
      renderLista();
    };
  }
}
