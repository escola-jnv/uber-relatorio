import { $, R, N1, parseNum } from '../../utils/format.js';
import { DEF } from '../../utils/constants.js';
import { useStore } from '../../state/store.js';
import { getCarros, getDynamicCarCosts, persistConfig } from '../../services/car-service.js';
import { showToast } from '../toast.js';

export function updateCarModalFields() {
  const dlg = $('#dlgCar');
  if (!dlg) return;

  const isAlugado = $('#carTipo').value === 'alugado';
  $('#wCarAluguelValor').style.display = isAlugado ? 'block' : 'none';
  $('#wCarAluguelPeriodo').style.display = isAlugado ? 'grid' : 'none';

  const val = parseNum($('#carAluguelValor').value) || 0;
  const per = $('#carAluguelPeriodo').value;
  const diaCalc = per === 'semana' ? (val / 7) : per === 'mes' ? (val / 30) : val;
  $('#carAluguelDiaCalc').value = isAlugado ? `${R(diaCalc)}/dia` : 'R$ 0,00 (Próprio)';

  const cons = parseNum($('#carConsumo').value) || 0;
  const preco = parseNum($('#carPrecoComb').value) || 0;
  if (cons > 0 && preco > 0) {
    const kVal = Math.round((preco / cons) * 100) / 100;
    if (!$('#carCustoKm').value || $('#carCustoKm')._auto) {
      $('#carCustoKm').value = kVal.toFixed(2).replace('.', ',');
      $('#carCustoKm')._auto = true;
    }
  }

  const dyn = getDynamicCarCosts();
  if (dyn.isDynamicFuel) {
    $('#carCustoDinamicoHint').innerHTML = `⚡ <b>Custo Real Dinâmico Atual:</b> ${R(dyn.custoKmCombustivel)}/km (baseado em ${R(dyn.fuelSpent)} em abastecimentos e ${N1(dyn.kmTracked)} km rodados nos últimos 30 dias).`;
  }
}

export function openCarModal(id = null) {
  const dlg = $('#dlgCar');
  if (!dlg) return;

  const list = getCarros();
  const car = id ? list.find(c => c.id === id) : null;
  const { cfg } = useStore();

  $('#dlgCarTitle').textContent = car ? 'Editar Carro' : 'Cadastrar Novo Carro';
  $('#carId').value = car ? car.id : '';
  $('#carNome').value = car ? car.nome : '';
  $('#carPlaca').value = car ? car.placa : '';

  const tipo = car ? (car.tipo || 'alugado') : 'alugado';
  $('#carTipo').value = tipo;
  $('#carAluguelValor').value = car ? (car.aluguel_valor || '') : '';
  $('#carAluguelPeriodo').value = car ? (car.aluguel_periodo || 'semana') : 'semana';
  $('#carConsumo').value = car ? (car.consumo_kml || '') : '';
  $('#carPrecoComb').value = car ? (car.preco_combustivel || '') : '';
  $('#carCustoKm').value = car ? (car.custo_km || '') : (cfg.custo_km || DEF.custo_km);
  $('#carAtivo').checked = car ? !!car.ativo : (list.length === 0);

  updateCarModalFields();
  dlg.showModal();
}

export function initCarModal() {
  const dlg = $('#dlgCar');
  if (!dlg) return;

  $('#carTipo').onchange = updateCarModalFields;
  $('#carAluguelValor').oninput = updateCarModalFields;
  $('#carAluguelPeriodo').onchange = updateCarModalFields;
  $('#carConsumo').oninput = updateCarModalFields;
  $('#carPrecoComb').oninput = updateCarModalFields;
  $('#carCustoKm').oninput = () => { $('#carCustoKm')._auto = false; };

  $('#btnCloseCarModal').onclick = $('#btnCancelCar').onclick = () => dlg.close();

  $('#fCarModal').onsubmit = async e => {
    e.preventDefault();
    const id = $('#carId').value.trim();
    const nome = $('#carNome').value.trim();
    const placa = $('#carPlaca').value.trim().toUpperCase();
    const tipo = $('#carTipo').value;

    const aluguelValor = parseNum($('#carAluguelValor').value) || 0;
    const aluguelPeriodo = $('#carAluguelPeriodo').value;
    const aluguelDia = tipo === 'alugado'
      ? (aluguelPeriodo === 'semana' ? aluguelValor / 7 : aluguelPeriodo === 'mes' ? aluguelValor / 30 : aluguelValor)
      : 0;

    const consumoKml = parseNum($('#carConsumo').value) || 0;
    const precoComb = parseNum($('#carPrecoComb').value) || 0;
    const { cfg } = useStore();
    const custoKm = parseNum($('#carCustoKm').value) || (consumoKml > 0 && precoComb > 0 ? precoComb / consumoKml : cfg.custo_km || DEF.custo_km);
    const isAtivo = $('#carAtivo').checked;

    const list = [...getCarros()];
    const carData = {
      nome,
      placa,
      tipo,
      aluguel_valor: aluguelValor,
      aluguel_periodo: aluguelPeriodo,
      aluguel_dia: Math.round(aluguelDia * 100) / 100,
      consumo_kml: consumoKml,
      preco_combustivel: precoComb,
      custo_km: Math.round(custoKm * 100) / 100
    };

    const updates = {};
    if (id) {
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...carData };
        if (isAtivo) {
          list.forEach(c => { c.ativo = (c.id === id); });
          updates.carro_ativo_id = id;
          updates.custo_km = custoKm;
          updates.aluguel_dia = list[idx].aluguel_dia;
        }
      }
    } else {
      const newId = 'c_' + Date.now().toString(36);
      const newCar = { id: newId, ...carData, ativo: isAtivo || list.length === 0 };
      if (newCar.ativo) {
        list.forEach(c => { c.ativo = false; });
        updates.carro_ativo_id = newId;
        updates.custo_km = custoKm;
        updates.aluguel_dia = newCar.aluguel_dia;
      }
      list.push(newCar);
    }

    updates.carros = list;
    await persistConfig(updates);
    dlg.close();
    showToast('Carro salvo ✓');
  };
}
