import { $, R, R0, parseNum } from '../../utils/format.js';
import { DEF } from '../../utils/constants.js';
import { useStore } from '../../state/store.js';
import { getActiveCar, persistConfig } from '../../services/car-service.js';
import { calcularMetaSessaoSugerida } from '../../services/metrics-service.js';
import { saveEntry } from '../../services/entries-service.js';
import { showToast } from '../toast.js';

export function openStartSessionModal() {
  const dlg = $('#dlgStartSessao');
  if (!dlg) return;

  const sug = calcularMetaSessaoSugerida();
  $('#startSessaoMetaCalc').textContent = R(sug.metaBruta);
  $('#startSessaoMetaInput').value = sug.metaBruta;
  $('#startSessaoOdo').value = '';

  const tagComb = sug.isDynamicFuel ? 'abastecimentos reais' : 'consumo';
  $('#startSessaoExplicacao').innerHTML =
    `Para atingir seu lucro líquido de <b>${R(sug.lucroAlvo)}</b>, a meta bruta precisa cobrir o aluguel fixo de <b>${R(sug.aluguel)}</b> e o combustível estimado de <b>${R(sug.combustivelEstimado)}</b> (${tagComb}).`;

  dlg.showModal();
}

export function initStartSessionModal() {
  const dlg = $('#dlgStartSessao');
  if (!dlg) return;

  $('#btnCloseStartSessao').onclick = $('#btnCancelStartSessao').onclick = () => dlg.close();

  $('#fStartSessao').onsubmit = async e => {
    e.preventDefault();
    const metaVal = parseNum($('#startSessaoMetaInput').value) || DEF.meta_sessao;
    const odoRaw = $('#startSessaoOdo').value;
    const odoVal = odoRaw ? parseFloat(odoRaw.replace(/\D/g, '')) : null;

    // Atualiza a meta da sessão configurada
    await persistConfig({ meta_sessao: metaVal });

    const active = getActiveCar();
    const selCar = active ? active.placa : null;

    await saveEntry({
      row: {
        tipo: 'sessao_ini',
        ts: new Date().toISOString(),
        valor: odoVal,
        origem: 'manual',
        carro: selCar
      },
      carro: selCar
    });

    dlg.close();
    showToast(`Sessão iniciada! Meta: ${R0(metaVal)}`);
  };
}
