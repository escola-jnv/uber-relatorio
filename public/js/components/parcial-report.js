import { $, R, R0, dk } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { getDynamicCarCosts } from '../services/car-service.js';
import { calcularAutonomiaSessao } from '../services/autonomia-service.js';

/**
 * Renderiza o Relatório Parcial do Dia com ProgressBar indicando:
 * 1. Ponto de Equilíbrio (Break-Even - onde custos são cobertos)
 * 2. Meta de Lucro do Dia (Break-Even + Lucro Líquido desejado)
 * 3. Meta de Caixas (Faturamento Bruto total / Meta de Caixa alvo)
 *
 * Também exibe o cálculo dinâmico de autonomia e tempo para abastecer quando há sessão ativa.
 */
export function renderParcialReport() {
  const container = $('#parcialReportBox');
  if (!container) return;

  const { rows, cfg, metrics } = useStore();
  const { days, ativa, sess } = metrics;
  const now = new Date();
  const k = dk(now);
  const d = days[k] || { g: 0, d: 0, n: 0, km: 0, h: 0 };
  const sAtual = ativa ? sess[sess.length - 1] : null;
  const dyn = getDynamicCarCosts();

  // 1. Faturamento bruto atual realizado hoje
  const faturamentoAtual = d.g || 0;

  // 2. Custos incorridos no dia (custo fixo do aluguel + combustível proporcional aos km + despesas extras)
  const kmDia = d.km || 0;
  const custoCombDia = kmDia * dyn.custoKmCombustivel;
  const custoFixoDia = (d.n > 0 || d.h > 0) ? (dyn.aluguelDia || 0) : 0;

  let despExtrasHoje = 0;
  for (const r of rows) {
    if (dk(r.ts) === k && r.tipo === 'despesa') {
      const cat = (r.categoria || '').toLowerCase();
      // Não duplica combustível e aluguel caso já contabilizados pelos custos dinâmicos
      if (cat !== 'combustivel' && cat !== 'aluguel') {
        despExtrasHoje += (+r.valor || 0);
      }
    }
  }

  const custosTotaisDia = custoFixoDia + custoCombDia + despExtrasHoje;

  // 3. Os 3 Pontos Fundamentais da Barra:
  // Ponto A: Break-even (Equilíbrio dos custos)
  const breakEven = Math.max(15, Math.round(custosTotaisDia));

  // Ponto B: Lucro do Dia (Break-even + Meta de Lucro Líquido do Dia)
  const metaLucroDia = +(cfg.meta_lucro_dia || DEF.meta_lucro_dia || 200);
  const pontoLucroDia = breakEven + metaLucroDia;

  // Ponto C: Meta de Caixas (Faturamento Bruto alvo do Dia)
  const metaCaixasConfig = +(cfg.meta_dia || DEF.meta_dia || 300);
  const metaCaixas = Math.max(pontoLucroDia, metaCaixasConfig);

  // Escala total da barra (garante espaço visual caso o motorista ultrapasse a meta)
  const escalaTotal = Math.max(metaCaixas, faturamentoAtual, 100);

  // Percentuais de cada ponto na escala da barra
  const pctBreakEven = Math.min(94, Math.max(6, (breakEven / escalaTotal) * 100));
  const pctLucroDia = Math.min(97, Math.max(pctBreakEven + 6, (pontoLucroDia / escalaTotal) * 100));
  const pctMetaCaixas = Math.min(100, Math.max(pctLucroDia + 3, (metaCaixas / escalaTotal) * 100));
  const pctProgressoAtual = Math.min(100, (faturamentoAtual / escalaTotal) * 100);

  // Mensagem e estado do faturamento atual em relação aos 3 pontos
  let statusBadgeHtml = '';
  let barraCor = 'linear-gradient(90deg, var(--warn), var(--ac2))';

  if (faturamentoAtual < breakEven) {
    const faltaBreak = breakEven - faturamentoAtual;
    statusBadgeHtml = `<span class="parcial-status-tag tag-alerta">🔴 Faltam ${R0(faltaBreak)} para o Break-even</span>`;
    barraCor = 'linear-gradient(90deg, #ff4d5e, var(--warn))';
  } else if (faturamentoAtual < pontoLucroDia) {
    const lucroAtual = faturamentoAtual - breakEven;
    const faltaLucro = pontoLucroDia - faturamentoAtual;
    statusBadgeHtml = `<span class="parcial-status-tag tag-lucro">🟢 No lucro! (+${R0(lucroAtual)}) · faltam ${R0(faltaLucro)} para a meta</span>`;
    barraCor = 'linear-gradient(90deg, var(--ac2), var(--ac))';
  } else if (faturamentoAtual < metaCaixas) {
    const faltaCaixa = metaCaixas - faturamentoAtual;
    statusBadgeHtml = `<span class="parcial-status-tag tag-meta">⭐ Lucro atingido! Faltam ${R0(faltaCaixa)} para a meta de caixas</span>`;
    barraCor = 'linear-gradient(90deg, var(--ac), #00ffaa)';
  } else {
    const superavit = faturamentoAtual - metaCaixas;
    statusBadgeHtml = `<span class="parcial-status-tag tag-sucesso">🏆 Meta de caixas batida! (+${R0(superavit)} além do alvo)</span>`;
    barraCor = 'linear-gradient(90deg, #00ffaa, #39ff14)';
  }

  // 4. Autonomia e previsão de abastecimento (quando sessão ativa)
  const autonomia = calcularAutonomiaSessao({ sAtual, rows, cfg, metrics });
  let autonomiaHtml = '';

  if (autonomia.ativa) {
    const alertaClasse = autonomia.statusAlerta === 'critico' ? 'fuel-critico' : autonomia.statusAlerta === 'atencao' ? 'fuel-atencao' : 'fuel-normal';
    const iconePosto = autonomia.statusAlerta === 'critico' ? '⚠️ ⛽' : '⛽';
    autonomiaHtml = `
      <div class="parcial-fuel-card ${alertaClasse}">
        <div class="fuel-card-top">
          <div class="fuel-title">${iconePosto} <b>Previsão de Abastecimento:</b></div>
          <div class="fuel-tempo-badge">${autonomia.tempoFormatado}</div>
        </div>
        <div class="fuel-card-details">
          <span>Restam <b>~${autonomia.kmRestantes} km</b> de autonomia</span>
          <span>Média: <b>${autonomia.mediaKmL} km/l</b></span>
          ${autonomia.odoProximoAbastecimento ? `<span>Posto por volta do odômetro: <b>${autonomia.odoProximoAbastecimento}</b></span>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="parcial-report-card">
      <div class="parcial-header">
        <div>
          <span class="parcial-kicker">📊 Relatório Parcial do Dia</span>
          <div class="parcial-current-val">${R(faturamentoAtual)} <span class="parcial-current-sub">faturado</span></div>
        </div>
        <div class="parcial-status-wrap">
          ${statusBadgeHtml}
        </div>
      </div>

      <!-- Barra de Progresso com Marcadores de Break-even, Lucro do Dia e Meta de Caixas -->
      <div class="parcial-bar-wrapper">
        <div class="parcial-bar-track">
          <!-- Preenchimento da barra baseado no faturamento atual -->
          <div class="parcial-bar-fill" style="width:${pctProgressoAtual}%;background:${barraCor}"></div>

          <!-- Marcador 1: Break-even -->
          <div class="parcial-marker marker-break" style="left:${pctBreakEven}%" title="Break-even: R$ ${breakEven}">
            <div class="marker-line"></div>
            <div class="marker-pin"></div>
          </div>

          <!-- Marcador 2: Lucro do Dia -->
          <div class="parcial-marker marker-lucro" style="left:${pctLucroDia}%" title="Lucro do dia: R$ ${pontoLucroDia}">
            <div class="marker-line"></div>
            <div class="marker-pin"></div>
          </div>

          <!-- Marcador 3: Meta de Caixas -->
          <div class="parcial-marker marker-caixas" style="left:${pctMetaCaixas}%" title="Meta de Caixas: R$ ${metaCaixas}">
            <div class="marker-line"></div>
            <div class="marker-pin"></div>
          </div>
        </div>

        <!-- Legenda e Rótulos dos Marcadores logo abaixo da barra -->
        <div class="parcial-markers-labels">
          <div class="marker-label-item" style="left:${pctBreakEven}%">
            <span class="lbl-badge lbl-break">⚖️ Break-even</span>
            <b class="lbl-val">${R0(breakEven)}</b>
          </div>
          <div class="marker-label-item" style="left:${pctLucroDia}%">
            <span class="lbl-badge lbl-lucro">💰 Lucro Dia</span>
            <b class="lbl-val">${R0(pontoLucroDia)}</b>
          </div>
          <div class="marker-label-item" style="left:${pctMetaCaixas}%">
            <span class="lbl-badge lbl-caixas">🎯 Meta Caixas</span>
            <b class="lbl-val">${R0(metaCaixas)}</b>
          </div>
        </div>
      </div>

      <!-- Card de Autonomia de Combustível (Sessão Ativa) -->
      ${autonomiaHtml}
    </div>
  `;
}
