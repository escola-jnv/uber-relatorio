import { store, useStore } from '../state/store.js';
import { createEntryApi, updateEntryApi, deleteEntryApi } from '../api/client.js';
import { showToast } from '../components/toast.js';
import { R } from '../utils/format.js';

export async function saveEntry(body) {
  try {
    const res = await createEntryApi(body);
    const { rows } = useStore();
    const updated = [...res, ...rows].sort((a, b) => new Date(b.ts) - new Date(a.ts));
    store.setRows(updated);
    showToast('Salvo ✓ ' + res.map(x => x.tipo === 'ganho' ? R(+x.valor) : x.tipo === 'pausa_ini' ? 'pausa ⏸' : x.tipo === 'pausa_fim' ? 'retomou ▶' : x.tipo).join(', '));
    return true;
  } catch (err) {
    showToast(err.message);
    return false;
  }
}

export async function updateEntry(id, updates) {
  const { rows } = useStore();
  const idx = rows.findIndex(x => String(x.id) === String(id));
  if (idx === -1) return false;

  try {
    await updateEntryApi(id, updates);
    const updatedRows = [...rows];
    updatedRows[idx] = { ...updatedRows[idx], ...updates };
    store.setRows(updatedRows);
    showToast('Lançamento atualizado ✓');
    return true;
  } catch (err) {
    // Modo offline resiliente: salva localmente
    const updatedRows = [...rows];
    updatedRows[idx] = { ...updatedRows[idx], ...updates };
    store.setRows(updatedRows);
    showToast('Atualizado localmente ✓');
    return true;
  }
}

export async function deleteEntry(id) {
  const { rows } = useStore();
  try {
    await deleteEntryApi(id);
    const updatedRows = rows.filter(x => String(x.id) !== String(id));
    store.setRows(updatedRows);
    showToast('Lançamento apagado ✓');
    return true;
  } catch (err) {
    showToast(err.message);
    return false;
  }
}
