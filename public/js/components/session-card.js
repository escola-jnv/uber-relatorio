import { $, R, R0, N1, pad, hm, dk } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getActiveCar, getDynamicCarCosts } from '../services/car-service.js';
import { saveEntry } from '../services/entries-service.js';
import { openStartSessionModal } from './modals/start-session-modal.js';

export function renderSessionCard() {
  const { rows, cfg, metrics } = useStore();
  const { days, sess, ativa } = metrics;
  const now = new Date();
  const k = dk(now);
  const d = days[k] || { g: 0, d: 0, n: 0, km: 0, h: 0 };
  const sAtual = ativa ? sess[sess.length - 1] : null;
  const metaSessao = +(cfg.meta_sessao || DEF.meta_sessao || 150);
  const metaLucroSessao = +(cfg.meta_lucro_sessao || DEF.meta_lucro_sessao || 150);
  const dyn = getDynamicCarCosts();

  if (sAtual) {
    const emPausa = !!metrics.pausaAtiva;
    const min = Math.max(0, (now - sAtual.ini) / 6e4 - (sAtual.pausaMin || 0)); // tempo efetivo, sem pausas
    const horas = min / 60;
    const durStr = `${Math.floor(horas)}h${pad(Math.round(min % 60))}`;

    if ($('#sTxt')) {
      $('#sTxt').innerHTML = emPausa
        ? '⏸ Em pausa desde ' + hm(metrics.pausaAtiva.ini)
        : '<span class="on-dot"></span>Sessão ativa desde ' + hm(sAtual.ini);
    }
    if ($('#sInfo')) {
      const pausaTxt = sAtual.pausaMin >= 1 ? ` · ⏸ ${Math.round(sAtual.pausaMin)} min de pausa` : '';
      $('#sInfo').textContent = `${durStr} · ${sAtual.n} corrida${sAtual.n === 1 ? '' : 's'}${pausaTxt}`;
    }
    if ($('#pBtn')) {
      $('#pBtn').hidden = false;
      $('#pBtn').textContent = emPausa ? '▶ Retomar' : '⏸ Pausar';
      $('#pBtn').className = emPausa ? 'p' : 's';
    }
    if ($('#sBtn')) {
      $('#sBtn').textContent = 'Encerrar';
      $('#sBtn').className = 's';
    }

    // 1. Barra de Progresso baseada na Meta da Sessão
    const val = sAtual.g || 0;
    const pc = Math.min(100, Math.round((val / metaSessao) * 100)) || 0;
    if ($('#sProgVals')) $('#sProgVals').textContent = `${R0(val)} / ${R0(metaSessao)}`;
    if ($('#sProgRest')) {
      if (val >= metaSessao) {
        $('#sProgRest').innerHTML = `<b style="color:var(--ac)">✅ Meta batida! (${pc}%)</b>`;
      } else {
        $('#sProgRest').textContent = `faltam ${R0(metaSessao - val)} (${pc}%)`;
      }
    }
    if ($('#sProgBar')) {
      $('#sProgBar').style.width = `${pc}%`;
      $('#sProgBar').style.background = pc >= 100 ? 'var(--ac)' : pc > 60 ? 'var(--ac2)' : 'var(--warn)';
    }

    // 2. Lucro médio / estimado da sessão
    const custoComb = (sAtual.km || 0) * dyn.custoKmCombustivel;
    const aluguel = dyn.aluguelDia || 0;
    let despSessao = 0;
    for (const r of rows) {
      if (r.tipo === 'despesa') {
        const t = new Date(r.ts);
        if (t >= sAtual.ini && t <= sAtual.fim) despSessao += +r.valor || 0;
      }
    }
    const custoTotal = Math.max(custoComb + aluguel, despSessao);
    const lucroSessao = val - custoTotal;

    if ($('#sLucroVal')) {
      $('#sLucroVal').textContent = R0(lucroSessao);
      $('#sLucroVal').style.color = lucroSessao >= 0 ? 'var(--ac)' : 'var(--bad)';
    }
    if ($('#sLucroSub')) {
      $('#sLucroSub').textContent = `meta ${R0(metaLucroSessao)}`;
    }

    // 3. R$ / Hora da sessão
    if ($('#sRpHoraVal')) {
      if (horas >= 0.05) {
        const rpHora = val / horas;
        $('#sRpHoraVal').textContent = `${R0(rpHora)}/h`;
      } else {
        $('#sRpHoraVal').textContent = '—';
      }
    }
    if ($('#sRpHoraSub')) {
      $('#sRpHoraSub').textContent = horas >= 0.05 ? `${R0(val)} bruto` : 'iniciando';
    }

    // 4. R$ / Km da sessão
    const kmSess = sAtual.km || 0;
    if ($('#sRpKmVal')) {
      if (kmSess > 0) {
        const rpKm = val / kmSess;
        $('#sRpKmVal').textContent = rpKm.toFixed(2).replace('.', ',');
      } else {
        $('#sRpKmVal').textContent = '—';
      }
    }
    if ($('#sRpKmSub')) {
      $('#sRpKmSub').textContent = kmSess > 0 ? `${N1(kmSess)} km` : (sAtual.n ? `${sAtual.n} corridas` : 'lance o km');
    }
  } else {
    // Sessão parada
    if ($('#pBtn')) $('#pBtn').hidden = true;
    if ($('#sTxt')) $('#sTxt').textContent = 'Sessão parada';
    if ($('#sInfo')) {
      $('#sInfo').textContent = d.h ? `Hoje: ${N1(d.h)}h rodadas · ${d.n} corrida${d.n === 1 ? '' : 's'}` : 'Pronto para iniciar';
    }
    if ($('#sBtn')) {
      $('#sBtn').textContent = 'Iniciar';
      $('#sBtn').className = 'p';
    }

    // Progresso em repouso
    if ($('#sProgVals')) $('#sProgVals').textContent = `R$ 0 / ${R0(metaSessao)}`;
    if ($('#sProgRest')) $('#sProgRest').textContent = `meta ${R0(metaSessao)}`;
    if ($('#sProgBar')) {
      $('#sProgBar').style.width = '0%';
      $('#sProgBar').style.background = 'var(--line)';
    }

    // Indicadores médios de sessões passadas
    const completedSess = (sess || []).filter(s => !s.ativa && s.g > 0);
    if (completedSess.length > 0) {
      const totLucroPast = completedSess.reduce((acc, s) => {
        const cComb = (s.km || 0) * dyn.custoKmCombustivel;
        return acc + (s.g - cComb - (dyn.aluguelDia || 0));
      }, 0);
      const avgLucro = totLucroPast / completedSess.length;
      if ($('#sLucroVal')) {
        $('#sLucroVal').textContent = R0(avgLucro);
        $('#sLucroVal').style.color = avgLucro >= 0 ? 'var(--ac)' : 'var(--bad)';
      }
      if ($('#sLucroSub')) $('#sLucroSub').textContent = `média (${completedSess.length} sessões)`;

      let sumRate = 0, countRate = 0;
      for (const s of completedSess) {
        const h = Math.max(0, (s.fim - s.ini) / 6e4 - (s.pausaMin || 0)) / 60;
        if (h > 0.2) { sumRate += s.g / h; countRate++; }
      }
      const avgRate = countRate ? sumRate / countRate : 0;
      if ($('#sRpHoraVal')) $('#sRpHoraVal').textContent = avgRate ? `${R0(avgRate)}/h` : '—';
      if ($('#sRpHoraSub')) $('#sRpHoraSub').textContent = 'média histórica';

      let sumKm = 0, sumG = 0;
      for (const s of completedSess) {
        if (s.km > 0) { sumG += s.g; sumKm += s.km; }
      }
      const avgRk = sumKm ? sumG / sumKm : 0;
      if ($('#sRpKmVal')) $('#sRpKmVal').textContent = avgRk ? avgRk.toFixed(2).replace('.', ',') : '—';
      if ($('#sRpKmSub')) $('#sRpKmSub').textContent = 'média histórica';
    } else if (d.n > 0 || d.km > 0 || d.h > 0) {
      // Dados de hoje
      const kmDia = d.km || 0;
      const custoCombDia = kmDia * dyn.custoKmCombustivel;
      const custoFixoDia = (d.n > 0 || d.h > 0) ? dyn.aluguelDia : 0;
      const lucroHoje = d.g - custoFixoDia - custoCombDia;
      if ($('#sLucroVal')) {
        $('#sLucroVal').textContent = R0(lucroHoje);
        $('#sLucroVal').style.color = lucroHoje >= 0 ? 'var(--ac)' : 'var(--bad)';
      }
      if ($('#sLucroSub')) $('#sLucroSub').textContent = 'hoje';

      if ($('#sRpHoraVal')) $('#sRpHoraVal').textContent = d.h ? `${R0(d.g / d.h)}/h` : '—';
      if ($('#sRpHoraSub')) $('#sRpHoraSub').textContent = 'hoje';

      if ($('#sRpKmVal')) $('#sRpKmVal').textContent = d.km ? (d.g / d.km).toFixed(2).replace('.', ',') : '—';
      if ($('#sRpKmSub')) $('#sRpKmSub').textContent = 'hoje';
    } else {
      if ($('#sLucroVal')) {
        $('#sLucroVal').textContent = '—';
        $('#sLucroVal').style.color = 'var(--tx)';
      }
      if ($('#sLucroSub')) $('#sLucroSub').textContent = `meta ${R0(metaLucroSessao)}`;

      if ($('#sRpHoraVal')) $('#sRpHoraVal').textContent = '—';
      if ($('#sRpHoraSub')) $('#sRpHoraSub').textContent = '';

      if ($('#sRpKmVal')) $('#sRpKmVal').textContent = '—';
      if ($('#sRpKmSub')) $('#sRpKmSub').textContent = '';
    }
  }
}

export function initSessionCard() {
  const sBtn = $('#sBtn');
  if (!sBtn) return;

  const pBtn = $('#pBtn');
  if (pBtn) {
    pBtn.onclick = async () => {
      const { metrics } = useStore();
      const active = getActiveCar();
      const selCar = active ? active.placa : null;
      await saveEntry({
        row: {
          tipo: metrics.pausaAtiva ? 'pausa_fim' : 'pausa_ini',
          ts: new Date().toISOString(),
          valor: null,
          origem: 'manual',
          carro: selCar
        },
        carro: selCar
      });
    };
  }

  sBtn.onclick = async () => {
    const { metrics } = useStore();
    const ativa = !!metrics.ativa;

    if (!ativa) {
      openStartSessionModal();
    } else {
      const o = prompt('Encerrar sessão — odômetro atual (opcional):', '');
      if (o === null) return;
      const active = getActiveCar();
      const selCar = active ? active.placa : null;
      await saveEntry({
        row: {
          tipo: 'sessao_fim',
          ts: new Date().toISOString(),
          valor: o ? parseFloat(o.replace(/\D/g, '')) : null,
          origem: 'manual',
          carro: selCar
        },
        carro: selCar
      });
    }
  };
}
