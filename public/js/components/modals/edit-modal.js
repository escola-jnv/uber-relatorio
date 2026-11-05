import { $, dk, hm, esc, parseNum } from '../../utils/format.js';
import { useStore } from '../../state/store.js';
import { getCarros, getActiveCar, getRowCar, getRowObs } from '../../services/car-service.js';
import { updateEntry, deleteEntry } from '../../services/entries-service.js';

export function openEditModal(id) {
  const { rows } = useStore();
  const r = rows.find(x => String(x.id) === String(id));
  if (!r) return;
  const dlg = $('#dlgEditItem');
  if (!dlg) return;

  $('#editItemId').value = r.id;
  $('#dlgEditTitle').textContent = `✏️ Editar ${r.tipo === 'ganho' ? 'Corrida' : r.tipo === 'despesa' ? 'Despesa' : r.tipo === 'odometro' ? 'Odômetro' : r.tipo === 'pausa_ini' ? 'Início de pausa' : r.tipo === 'pausa_fim' ? 'Fim de pausa' : 'Sessão'}`;

  const t = new Date(r.ts);
  $('#editItemData').value = dk(t);
  $('#editItemHora').value = hm(t);
  $('#editItemValor').value = r.valor !== null && r.valor !== undefined ? r.valor : '';
  $('#lblEditValor').textContent = r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim' ? 'Odômetro (km)' : 'Valor (R$)';

  const currentCar = getRowCar(r) || (getActiveCar() ? getActiveCar().placa : null);
  $('#editItemCarro').innerHTML = getCarros().map(c =>
    `<option value="${esc(c.placa)}" ${c.placa === currentCar ? 'selected' : ''}>${esc(c.nome)} (${esc(c.placa)})</option>`
  ).join('');

  $('#editSecGanho').hidden = r.tipo !== 'ganho';
  $('#editSecDespesa').hidden = r.tipo !== 'despesa';
  const isOdo = r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim';
  if ($('#editSecOdo')) {
    $('#editSecOdo').hidden = false;
    const odoMatched = r.obs && r.obs.match(/odo\s+(?:\?|\d+)\s*→\s*(\d+)/i);
    const odoVal = isOdo ? (r.valor || '') : (r._exactOdo || (odoMatched ? odoMatched[1] : ''));
    if ($('#editItemOdo')) $('#editItemOdo').value = odoVal;
  }

  if (r.tipo === 'ganho') {
    $('#editItemPassageiro').value = r.passageiro || '';
    $('#editItemKm').value = r.km || '';
  }
  if (r.tipo === 'despesa') {
    $('#editItemCat').value = r.categoria || 'combustivel';
  }
  $('#editItemObs').value = getRowObs(r) || '';

  dlg.showModal();
}

export function initEditModal() {
  const dlg = $('#dlgEditItem');
  if (!dlg) return;

  $('#btnCloseEditItem').onclick = $('#btnCancelEdit').onclick = () => dlg.close();

  const delBtn = $('#btnDeleteFromEdit');
  if (delBtn) {
    delBtn.onclick = async () => {
      const id = $('#editItemId').value;
      if (!id) return;
      if (!confirm('Tem certeza que deseja apagar este lançamento?')) return;
      const success = await deleteEntry(id);
      if (success) dlg.close();
    };
  }

  const form = $('#fEditItem');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const id = $('#editItemId').value;
      const { rows } = useStore();
      const r = rows.find(x => String(x.id) === String(id));
      if (!r) return;

      const dataVal = $('#editItemData').value;
      const horaVal = $('#editItemHora').value;
      let newTs = r.ts;
      if (dataVal && horaVal) {
        newTs = new Date(`${dataVal}T${horaVal}:00`).toISOString();
      }

      let valor = parseNum($('#editItemValor').value);
      const isOdo = r.tipo === 'odometro' || r.tipo === 'sessao_ini' || r.tipo === 'sessao_fim';
      if (isOdo && $('#editItemOdo')?.value) {
        valor = parseNum($('#editItemOdo').value) || valor;
      }
      const carro = $('#editItemCarro').value;
      let obsText = $('#editItemObs').value.trim();

      const updates = { ts: newTs, valor, carro };
      if (r.tipo === 'ganho') {
        updates.passageiro = $('#editItemPassageiro').value.trim() || null;
        updates.km = parseNum($('#editItemKm').value);
        const odoInput = ($('#editItemOdo')?.value || '').replace(/\D/g, '');
        if (odoInput) {
          if (/odo\s+(?:\?|\d+)\s*→\s*\d+/i.test(obsText)) {
            obsText = obsText.replace(/(odo\s+(?:\?|\d+)\s*→\s*)\d+/i, `$1${odoInput}`);
          } else if (/odo\s+\d+/i.test(obsText)) {
            obsText = obsText.replace(/odo\s+\d+/i, `odo ${odoInput}`);
          } else {
            obsText = obsText ? `${obsText} · odo ${odoInput}` : `odo ${odoInput}`;
          }
        }
      }
      if (r.tipo === 'despesa') {
        updates.categoria = $('#editItemCat').value;
      }
      updates.obs = obsText ? `[🚗 ${carro}] ${obsText}` : `[🚗 ${carro}]`;

      const success = await updateEntry(id, updates);
      if (success) dlg.close();
    };
  }
}
