import { $, $$, dk, weekStart } from '../utils/format.js';
import { store, useStore } from '../state/store.js';

export function setFilterPreset(preset) {
  const now = new Date();
  const kHoje = dk(now);
  let from = '';
  let to = '';

  if (preset === 'hoje') {
    from = kHoje;
    to = kHoje;
  } else if (preset === 'ontem') {
    const ont = new Date(now);
    ont.setDate(ont.getDate() - 1);
    from = dk(ont);
    to = dk(ont);
  } else if (preset === 'semana') {
    const ws = weekStart(now);
    from = dk(ws);
    to = kHoje;
  } else if (preset === '7d') {
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    from = dk(d7);
    to = kHoje;
  } else if (preset === 'mes') {
    const m1 = new Date(now.getFullYear(), now.getMonth(), 1);
    from = dk(m1);
    to = kHoje;
  } else if (preset === '30d') {
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 29);
    from = dk(d30);
    to = kHoje;
  } else if (preset === 'todos') {
    from = '';
    to = '';
  }

  store.setFilter({ preset, from, to, shown: 100 });
  syncFilterUI();
}

export function syncFilterUI() {
  const { filter } = useStore();
  $$('#fChips button').forEach(b => {
    b.classList.toggle('on', b.dataset.f === filter.preset);
  });
  if ($('#fIni')) $('#fIni').value = filter.from || '';
  if ($('#fFim')) $('#fFim').value = filter.to || '';
}

export function initDateFilter() {
  const chips = $('#fChips');
  if (chips) {
    chips.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      setFilterPreset(b.dataset.f);
    };
  }

  const onCustomChange = () => {
    const from = $('#fIni')?.value || '';
    const to = $('#fFim')?.value || '';
    store.setFilter({ preset: 'custom', from, to, shown: 100 });
    syncFilterUI();
  };

  if ($('#fIni')) $('#fIni').onchange = onCustomChange;
  if ($('#fFim')) $('#fFim').onchange = onCustomChange;

  syncFilterUI();
}
