import { $, R, esc } from '../../utils/format.js';
import { getCarros, getActiveCar, getDynamicCarCosts, setActiveCar } from '../../services/car-service.js';
import { openCarModal } from './car-modal.js';
import { showToast } from '../toast.js';

export function openQuickCarSelect() {
  const dlg = $('#dlgCarSelect');
  if (!dlg) return;

  const list = getCarros();
  const active = getActiveCar();

  const container = $('#quickCarList');
  if (container) {
    container.innerHTML = list.map(c => {
      const isAct = c.id === active?.id;
      const dyn = getDynamicCarCosts(c);
      return `<button type="button" class="s row" style="width:100%;justify-content:space-between;padding:10px 12px;border-radius:10px;background:var(--bg);${isAct ? 'border-color:var(--ac)' : ''}" data-select-car="${c.id}">
        <div style="text-align:left">
          <span class="car-badge"><span class="car-plate">${esc(c.placa)}</span></span>
          <b style="margin-left:6px">${esc(c.nome)}</b>
          <div class="mut" style="font-size:11px;margin-top:2px">${c.tipo === 'proprio' ? 'Próprio' : `Aluguel ${R(dyn.aluguelDia)}/d`} · Combustível: ${R(dyn.custoKmCombustivel)}/km</div>
        </div>
        <div>${isAct ? '<span class="val-pos" style="font-size:12px;font-weight:700">✓ Ativo</span>' : '<span class="mut" style="font-size:12px">Selecionar</span>'}</div>
      </button>`;
    }).join('');

    container.querySelectorAll('[data-select-car]').forEach(btn => {
      btn.onclick = async () => {
        const carId = btn.dataset.selectCar;
        const activated = await setActiveCar(carId);
        dlg.close();
        if (activated) {
          showToast(`Carro ativo: ${activated.nome || ''} (${activated.placa || ''})`);
        }
      };
    });
  }

  dlg.showModal();
}

export function initCarSelectModal() {
  const dlg = $('#dlgCarSelect');
  if (!dlg) return;

  $('#btnCloseCarSelect').onclick = $('#btnQuickClose').onclick = () => dlg.close();
  $('#btnQuickAddCar').onclick = () => {
    dlg.close();
    openCarModal();
  };
}
