import { $, $$ } from '../utils/format.js';
import { DEF } from '../utils/constants.js';
import { useStore } from '../state/store.js';
import { renderCarList } from './car-bar.js';

export function switchTab(tabId) {
  const { cfg } = useStore();
  $$('nav button').forEach(x => x.classList.toggle('on', x.dataset.tab === tabId));
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 't-' + tabId));

  if (tabId === 'cfg') {
    for (const k in DEF) {
      const input = $(`#cf [name=${k}]`);
      if (input) {
        input.value = cfg[k] !== undefined ? cfg[k] : DEF[k];
      }
    }
    renderCarList();
  }
}

export function initNavigation() {
  $$('nav button').forEach(btn => {
    btn.onclick = () => {
      switchTab(btn.dataset.tab);
    };
  });
}
