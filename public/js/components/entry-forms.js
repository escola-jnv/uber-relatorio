import { $, $$, hm, parseNum } from '../utils/format.js';
import { getActiveCar, persistConfig } from '../services/car-service.js';
import { calcularMetaSessaoSugerida } from '../services/metrics-service.js';
import { saveEntry } from '../services/entries-service.js';
import { closeAddEntryModal } from './modals/add-entry-modal.js';

let tipo = 'ganho';

export function initEntryForms() {
  // 1. Formulário Rápido (formato WhatsApp)
  const qf = $('#qf');
  if (qf) {
    qf.onsubmit = async e => {
      e.preventDefault();
      const qInput = $('#q');
      const v = qInput.value.trim();
      const activeCar = getActiveCar();
      const carPlaca = activeCar ? (activeCar.placa || activeCar.nome) : null;

      // Se for comando de início de sessão digitado no campo rápido, calcula meta sugerida
      if (/^(ini|inicio|iniciar|bora|on|start)\b/i.test(v)) {
        const sug = calcularMetaSessaoSugerida();
        await persistConfig({ meta_sessao: sug.metaBruta });
      }

      if (v && await saveEntry({ text: v, carro: carPlaca })) {
        qInput.value = '';
        closeAddEntryModal();
      }
    };
  }

  // 2. Alternância do Formulário Detalhado (compatibilidade)
  const tgF = $('#tgF');
  if (tgF) {
    tgF.onclick = e => {
      e.preventDefault();
      const ff = $('#ff');
      if (ff) {
        ff.hidden = !ff.hidden;
        if (!ff.hidden && $('#fT')) {
          $('#fT').value = hm(new Date());
        }
      }
    };
  }

  // 3. Seletor de Tipo (Ganho, Odômetro, Despesa)
  const tipoC = $('#tipoC');
  if (tipoC) {
    tipoC.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      tipo = b.dataset.t;
      $$('#tipoC button').forEach(x => x.classList.toggle('on', x === b));
      if ($('#lV')) $('#lV').textContent = tipo === 'odometro' ? 'Odômetro (km)' : 'Valor (R$)';
      if ($('#wP')) $('#wP').hidden = tipo !== 'ganho';
      if ($('#wK')) $('#wK').hidden = tipo !== 'ganho';
      if ($('#wC')) $('#wC').hidden = tipo !== 'despesa';
      const isPausa = tipo === 'pausa_ini' || tipo === 'pausa_fim';
      if ($('#wV')) $('#wV').hidden = isPausa;      // pausa não tem valor
      if ($('#fV')) $('#fV').required = !isPausa;
    };
  }

  // 4. Submissão do Formulário Detalhado
  const ff = $('#ff');
  if (ff) {
    ff.onsubmit = async e => {
      e.preventDefault();
      const t = new Date();
      const timeVal = $('#fT')?.value;
      if (timeVal) {
        const [h, m] = timeVal.split(':');
        t.setHours(+h, +m, 0, 0);
        if (t > Date.now() + 6e5) t.setDate(t.getDate() - 1);
      }

      const selCar = $('#fCar')?.value || (getActiveCar() ? getActiveCar().placa : null);
      const row = {
        tipo,
        ts: t.toISOString(),
        valor: (tipo === 'pausa_ini' || tipo === 'pausa_fim') ? null : parseNum($('#fV').value),
        origem: 'manual',
        carro: selCar
      };

      if (tipo === 'ganho') {
        row.passageiro = $('#fP')?.value.trim() || null;
        row.km = parseNum($('#fK')?.value);
      }
      if (tipo === 'despesa') {
        row.categoria = $('#fC')?.value || 'combustivel';
      }

      if (await saveEntry({ row, carro: selCar })) {
        if ($('#fV')) $('#fV').value = '';
        if ($('#fP')) $('#fP').value = '';
        if ($('#fK')) $('#fK').value = '';
        closeAddEntryModal();
      }
    };
  }
}
