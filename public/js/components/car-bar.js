import { $, R, N1, esc } from '../utils/format.js';
import { useStore } from '../state/store.js';
import { getCarros, getActiveCar, getDynamicCarCosts, setActiveCar, removeCar } from '../services/car-service.js';
import { openCarModal } from './modals/car-modal.js';
import { openQuickCarSelect } from './modals/car-select-modal.js';
import { switchTab } from './navigation.js';
import { showToast } from './toast.js';

export function renderCarBar() {
  const active = getActiveCar();
  if (!active) return;
  const dyn = getDynamicCarCosts(active);
  const { cfg } = useStore();

  if ($('#carActivePlaca')) {
    $('#carActivePlaca').textContent = active.placa || 'Sem placa';
  }

  const prefix = dyn.isAlugado ? `Aluguel R$ ${Math.round(dyn.aluguelDia)}/d` : 'Próprio';
  const fuelLabel = dyn.isDynamicFuel
    ? `⚡ R$ ${N1(dyn.custoKmCombustivel)}/km (real)`
    : `R$ ${N1(dyn.custoKmCombustivel)}/km`;

  if ($('#carActiveNome')) {
    $('#carActiveNome').textContent = `(${active.nome || 'Carro'}) · ${prefix} · ${fuelLabel}`;
  }

  if ($('#fCar')) {
    $('#fCar').innerHTML = getCarros().map(c =>
      `<option value="${esc(c.placa || c.nome)}" ${c.id === active.id ? 'selected' : ''}>${esc(c.nome)} (${esc(c.placa)}) - R$ ${N1(c.custo_km || cfg.custo_km)}/km</option>`
    ).join('');
  }
}

export function renderCarList() {
  const list = getCarros();
  const active = getActiveCar();
  const cont = $('#listaCarros');
  if (!cont) return;

  cont.innerHTML = list.map(c => {
    const isAct = c.id === active?.id;
    const dyn = getDynamicCarCosts(c);
    const aluguelStr = c.tipo === 'proprio' ? 'Veículo próprio' : `Alugado: <b>${R(dyn.aluguelDia)}/dia</b>`;
    const combStr = dyn.isDynamicFuel
      ? `Combustível: <b>${R(dyn.custoKmCombustivel)}/km</b> <span class="tag" style="background:rgba(47,210,122,.15);color:var(--ac)">dinâmico</span>`
      : `Combustível: <b>${R(dyn.custoKmCombustivel)}/km</b>`;

    return `<div class="car-card ${isAct ? 'active' : ''}">
      <div class="car-card-info">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="car-badge"><span class="car-plate">${esc(c.placa || 'SEM PLACA')}</span></span>
          <b>${esc(c.nome)}</b>
          ${isAct ? '<span class="tag" style="background:var(--ac);color:#04140b;font-weight:700">ATIVO</span>' : ''}
        </div>
        <div class="mut" style="font-size:12px;margin-top:3px">
          ${aluguelStr} · ${combStr}
        </div>
      </div>
      <div class="car-actions">
        ${!isAct ? `<button type="button" class="s" data-act-car="${c.id}" title="Definir como carro ativo">Ativar</button>` : ''}
        <button type="button" class="s" data-edit-car="${c.id}" title="Editar">Editar</button>
        ${list.length > 1 ? `<button type="button" class="s" data-del-car="${c.id}" style="color:var(--bad)" title="Excluir">×</button>` : ''}
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-act-car]').forEach(btn => {
    btn.onclick = async () => {
      const activated = await setActiveCar(btn.dataset.actCar);
      if (activated) showToast(`Carro ativo: ${activated.nome} (${activated.placa})`);
    };
  });

  cont.querySelectorAll('[data-edit-car]').forEach(btn => {
    btn.onclick = () => openCarModal(btn.dataset.editCar);
  });

  cont.querySelectorAll('[data-del-car]').forEach(btn => {
    btn.onclick = async () => {
      const target = list.find(c => c.id === btn.dataset.delCar);
      if (!confirm(`Excluir o carro "${target?.nome || ''} (${target?.placa || ''})"?`)) return;
      try {
        await removeCar(btn.dataset.delCar);
        showToast('Carro removido');
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

export function initCarBar() {
  $('#carActiveBtn').onclick = () => openQuickCarSelect();

  $('#btnOpenCarConfig').onclick = e => {
    e.preventDefault();
    const dlgAdd = $('#dlgAddEntry');
    if (dlgAdd && dlgAdd.open) dlgAdd.close();
    switchTab('cfg');
    $('#sec-carros')?.scrollIntoView({ behavior: 'smooth' });
  };

  $('#btnAddCar').onclick = () => openCarModal();
}
