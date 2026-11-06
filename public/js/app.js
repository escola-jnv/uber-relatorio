import { $, hm } from './utils/format.js';
import { DEF } from './utils/constants.js';
import { store, useStore } from './state/store.js';
import { fetchEntries, fetchConfig } from './api/client.js';
import { computeMetrics } from './services/metrics-service.js';

// Componentes
import { initNavigation } from './components/navigation.js';
import { initCarBar, renderCarBar, renderCarList } from './components/car-bar.js';
import { initKpiSummary, renderKpiSummary } from './components/kpi-summary.js';
import { initSessionCard, renderSessionCard } from './components/session-card.js';
import { initEntryForms } from './components/entry-forms.js';
import { initDateFilter, setFilterPreset } from './components/date-filter.js';
import { initTable, renderLista } from './components/table.js';
import { renderCharts } from './components/charts.js';
import { renderInsights } from './components/insights.js';
import { initQuickEvents, renderQuickEvents } from './components/quick-events.js';
import { renderParcialReport } from './components/parcial-report.js';

// Modais
import { initAddEntryModal } from './components/modals/add-entry-modal.js';
import { initColumnModal } from './components/modals/column-modal.js';
import { initEditModal } from './components/modals/edit-modal.js';
import { initCarModal } from './components/modals/car-modal.js';
import { initCarSelectModal } from './components/modals/car-select-modal.js';
import { initStartSessionModal } from './components/modals/start-session-modal.js';

export function renderApp() {
  const { rows } = useStore();
  const metrics = computeMetrics(rows);
  store.setMetrics(metrics);

  const summary = renderKpiSummary();
  renderSessionCard();
  renderCarBar();
  renderCarList();
  renderQuickEvents();
  renderParcialReport();
  renderLista();
  renderCharts();
  renderInsights(summary);
}

export async function loadData() {
  try {
    const [r, c] = await Promise.all([fetchEntries(365), fetchConfig()]);
    const mergedCfg = { ...DEF, ...c };
    if (!mergedCfg.carros || !mergedCfg.carros.length) {
      mergedCfg.carros = DEF.carros;
    }
    store.setConfig(mergedCfg);
    store.setRows(r);

    if ($('#sync')) {
      $('#sync').textContent = 'atualizado ' + hm(new Date());
    }
  } catch (err) {
    if ($('#sync')) {
      $('#sync').textContent = 'offline';
    }
  }
}

function init() {
  // Inicializa componentes e seus event listeners
  initNavigation();
  initCarBar();
  initKpiSummary();
  initSessionCard();
  initEntryForms();
  initDateFilter();
  initTable();
  initQuickEvents();

  // Inicializa modais
  initAddEntryModal();
  initColumnModal();
  initEditModal();
  initCarModal();
  initCarSelectModal();
  initStartSessionModal();

  const { filter } = useStore();
  if (filter.preset && filter.preset !== 'custom') {
    setFilterPreset(filter.preset);
  }

  // Render inicial com cache local
  renderApp();

  // Escuta alterações na store para auto-renderização após o setup inicial
  store.subscribe(() => {
    renderApp();
  });

  // Sincroniza dados com o servidor
  loadData();

  // Auto-atualização periódica e ao focar na janela
  setInterval(() => {
    if (!document.hidden) loadData();
  }, 60e3);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadData();
  });
}

// Inicializa a aplicação assim que o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
