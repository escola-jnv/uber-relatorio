import { DEF, ALL_COLUMNS } from '../utils/constants.js';
import { normalizeOdoRows } from '../utils/odometer.js';

const defaultOrder = ALL_COLUMNS.map(c => c.id);
const defaultVisible = new Set(ALL_COLUMNS.filter(c => c.def).map(c => c.id));
const validColIds = new Set(ALL_COLUMNS.map(c => c.id));

function sanitizeColumnOrder(order) {
  if (!Array.isArray(order) || !order.length) return [...defaultOrder];
  const seen = new Set();
  const sanitized = [];
  for (const raw of order) {
    const id = raw === 'col-x' ? 'col-edit' : raw;
    if (validColIds.has(id) && !seen.has(id)) {
      seen.add(id);
      sanitized.push(id);
    }
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) {
      seen.add(id);
      sanitized.push(id);
    }
  }
  return sanitized.length ? sanitized : [...defaultOrder];
}

function sanitizeVisibleCols(visible) {
  if (!visible) return new Set(defaultVisible);
  const arr = Array.isArray(visible) ? visible : (visible instanceof Set ? [...visible] : []);
  if (!arr.length) return new Set(defaultVisible);
  const mapped = arr.map(id => id === 'col-x' ? 'col-edit' : id);
  const valid = mapped.filter(id => validColIds.has(id));
  return valid.length ? new Set(valid) : new Set(defaultVisible);
}

function getStorageVal(storage, key) {
  if (!storage) return null;
  try {
    const v = storage.getItem ? storage.getItem(key) : storage[key];
    return v !== undefined && v !== null ? v : null;
  } catch {
    return null;
  }
}

export function persistColumnConfig(visibleCols, columnOrder) {
  const visArray = Array.isArray(visibleCols) ? visibleCols : [...visibleCols];
  const ordArray = Array.isArray(columnOrder) ? columnOrder : [...columnOrder];

  const storages = [];
  if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
  if (typeof localStorage !== 'undefined') storages.push(localStorage);

  for (const st of storages) {
    try {
      const setKey = (k, v) => {
        if (st.setItem) st.setItem(k, v);
        else st[k] = v;
      };

      setKey('colunasVisiveis', JSON.stringify(visArray));
      setKey('colunasOrdem', JSON.stringify(ordArray));

      // Persiste também no sessionUser
      let su = {};
      try {
        const existing = getStorageVal(st, 'sessionUser');
        if (existing) su = JSON.parse(existing) || {};
      } catch {}
      su.colunasVisiveis = visArray;
      su.visibleCols = visArray;
      su.colunasOrdem = ordArray;
      su.columnOrder = ordArray;
      setKey('sessionUser', JSON.stringify(su));
    } catch (e) {
      console.warn('Erro ao persistir configuração de colunas:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.sessionUser = window.sessionUser || {};
    window.sessionUser.colunasVisiveis = visArray;
    window.sessionUser.visibleCols = visArray;
    window.sessionUser.colunasOrdem = ordArray;
    window.sessionUser.columnOrder = ordArray;
  }
}

export function loadStoredColumnConfig() {
  const storages = [];
  if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
  if (typeof localStorage !== 'undefined') storages.push(localStorage);

  let rawOrder = null;
  let rawVisible = null;

  for (const st of storages) {
    // 1. Tenta objeto sessionUser / userSession
    const suVal = getStorageVal(st, 'sessionUser') || getStorageVal(st, 'userSession');
    if (suVal) {
      try {
        const su = JSON.parse(suVal);
        if (su && typeof su === 'object') {
          if (!rawOrder && (Array.isArray(su.columnOrder) || Array.isArray(su.colunasOrdem))) {
            rawOrder = su.columnOrder || su.colunasOrdem;
          }
          if (!rawVisible && (Array.isArray(su.visibleCols) || Array.isArray(su.colunasVisiveis))) {
            rawVisible = su.visibleCols || su.colunasVisiveis;
          }
        }
      } catch {}
    }

    // 2. Tenta chaves diretas
    if (!rawOrder) {
      const ord = getStorageVal(st, 'colunasOrdem') || getStorageVal(st, 'columnOrder');
      if (ord) {
        try {
          const parsed = JSON.parse(ord);
          if (Array.isArray(parsed) && parsed.length) rawOrder = parsed;
        } catch {}
      }
    }

    if (!rawVisible) {
      const vis = getStorageVal(st, 'colunasVisiveis') || getStorageVal(st, 'visibleCols');
      if (vis) {
        try {
          const parsed = JSON.parse(vis);
          if (Array.isArray(parsed) && parsed.length) rawVisible = parsed;
        } catch {}
      }
    }

    if (rawOrder && rawVisible) break;
  }

  return {
    order: sanitizeColumnOrder(rawOrder),
    visible: sanitizeVisibleCols(rawVisible)
  };
}

// Carrega estado inicial do storage
function loadInitialState() {
  const hasLS = typeof localStorage !== 'undefined';
  let rows = [];
  try {
    rows = hasLS ? JSON.parse(localStorage.rows || '[]') : [];
  } catch {
    rows = [];
  }

  let cfg = { ...DEF };
  try {
    cfg = hasLS ? { ...DEF, ...JSON.parse(localStorage.cfg || '{}') } : { ...DEF };
  } catch {
    cfg = { ...DEF };
  }

  if (!Array.isArray(cfg.carros) || !cfg.carros.length) {
    cfg.carros = [...DEF.carros];
  }

  const colsConfig = loadStoredColumnConfig();

  return {
    rows,
    cfg,
    metrics: { days: {}, sess: [], ativa: null, hrsByH: Array(24).fill(0), asc: [] },
    filter: {
      preset: hasLS ? (localStorage.filtroData || 'hoje') : 'hoje',
      from: hasLS ? (localStorage.filtroDe || '') : '',
      to: hasLS ? (localStorage.filtroAte || '') : '',
      shown: 100
    },
    visibleCols: colsConfig.visible,
    columnOrder: colsConfig.order
  };
}

class Store {
  constructor() {
    this.state = loadInitialState();
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    if (this._isNotifying) return;
    this._isNotifying = true;
    try {
      for (const listener of this.listeners) {
        try {
          listener(this.state);
        } catch (err) {
          console.error('Erro em subscriber da store:', err);
        }
      }
    } finally {
      this._isNotifying = false;
    }
  }

  setRows(rows) {
    normalizeOdoRows(rows);
    this.state.rows = rows;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.rows = JSON.stringify(rows);
      }
    } catch {}
    this.notify();
  }

  setConfig(cfg) {
    this.state.cfg = { ...this.state.cfg, ...cfg };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.cfg = JSON.stringify(this.state.cfg);
      }
    } catch {}
    this.notify();
  }

  setMetrics(metrics) {
    this.state.metrics = metrics;
    // NÃO dispara this.notify(): metrics é um estado derivado computado durante
    // a fase de renderização (renderApp). Disparar notify aqui criava recursão infinita.
  }

  setFilter(filterUpdates) {
    const prev = this.state.filter;
    const next = { ...prev, ...filterUpdates };
    if (prev.preset === next.preset && prev.from === next.from && prev.to === next.to && prev.shown === next.shown) {
      return;
    }
    this.state.filter = next;
    try {
      if (typeof localStorage !== 'undefined') {
        if (filterUpdates.preset !== undefined) localStorage.filtroData = filterUpdates.preset;
        if (filterUpdates.from !== undefined) localStorage.filtroDe = filterUpdates.from;
        if (filterUpdates.to !== undefined) localStorage.filtroAte = filterUpdates.to;
      }
    } catch {}
    this.notify();
  }

  setVisibleCols(colsSet) {
    this.state.visibleCols = sanitizeVisibleCols(colsSet);
    persistColumnConfig(this.state.visibleCols, this.state.columnOrder);
    this.notify();
  }

  setColumnOrder(newOrder) {
    this.state.columnOrder = sanitizeColumnOrder(newOrder);
    persistColumnConfig(this.state.visibleCols, this.state.columnOrder);
    this.notify();
  }

  setColumnConfig({ visibleCols, columnOrder } = {}) {
    if (visibleCols !== undefined) {
      this.state.visibleCols = sanitizeVisibleCols(visibleCols);
    }
    if (columnOrder !== undefined) {
      this.state.columnOrder = sanitizeColumnOrder(columnOrder);
    }
    persistColumnConfig(this.state.visibleCols, this.state.columnOrder);
    this.notify();
  }
}

export const store = new Store();

// "Hooks" semânticos para fácil acesso reativo
export function useStore() {
  return store.getState();
}

export function useRows() {
  return store.getState().rows;
}

export function useConfig() {
  return store.getState().cfg;
}

export function useMetrics() {
  return store.getState().metrics;
}

export function useFilter() {
  return store.getState().filter;
}

export function useVisibleCols() {
  return store.getState().visibleCols;
}

export function useColumnOrder() {
  return store.getState().columnOrder;
}
