import { $, esc } from '../../utils/format.js';
import { ALL_COLUMNS } from '../../utils/constants.js';
import { store, useStore } from '../../state/store.js';
import { showToast } from '../toast.js';

let draggedColId = null;

export function renderColGrid() {
  const grid = $('#ctxColsGrid');
  if (!grid) return;

  const { visibleCols, columnOrder } = useStore();
  const colMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));
  const order = Array.isArray(columnOrder) && columnOrder.length ? columnOrder : ALL_COLUMNS.map(c => c.id);

  grid.innerHTML = order.map((colId, index) => {
    const col = colMap.get(colId);
    if (!col) return '';
    const isChecked = visibleCols.has(colId);
    const isFirst = index === 0;
    const isLast = index === order.length - 1;

    return `<div class="ctx-col-item ${isChecked ? '' : 'is-muted'}" data-col="${colId}" draggable="true">
      <span class="ctx-drag-handle" title="Arraste para reordenar" aria-label="Arraste para reordenar">⋮⋮</span>
      <label class="ctx-col-label">
        <input type="checkbox" data-col="${colId}" ${isChecked ? 'checked' : ''}>
        <span>${esc(col.label)}</span>
      </label>
      <div class="ctx-col-actions">
        <button type="button" class="ctx-btn-move" data-move="up" data-col="${colId}" title="Mover para cima" ${isFirst ? 'disabled' : ''} aria-label="Mover para cima">
          ▲
        </button>
        <button type="button" class="ctx-btn-move" data-move="down" data-col="${colId}" title="Mover para baixo" ${isLast ? 'disabled' : ''} aria-label="Mover para baixo">
          ▼
        </button>
      </div>
    </div>`;
  }).join('');
}

export function openColMenu(x, y) {
  renderColGrid();

  const menu = $('#colMenu');
  if (!menu) return;

  const backdrop = $('#colBackdrop');
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.style.display = 'block';
  }

  menu.hidden = false;
  menu.style.display = 'flex';

  if (x !== undefined && y !== undefined && window.innerWidth > 640) {
    const w = 340;
    const h = 480;
    const left = Math.min(Math.max(10, x), window.innerWidth - w - 10);
    const top = Math.min(Math.max(10, y), window.innerHeight - h - 10);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.transform = 'none';
  } else {
    menu.style.left = '50%';
    menu.style.top = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
  }
}

export function closeColMenu() {
  const menu = $('#colMenu');
  if (menu) {
    menu.hidden = true;
    menu.style.display = 'none';
  }
  const backdrop = $('#colBackdrop');
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.style.display = 'none';
  }
}

export function initColumnModal() {
  const grid = $('#ctxColsGrid');
  if (grid) {
    // 1. Mudança de visibilidade das colunas (checkboxes)
    grid.addEventListener('change', e => {
      const cb = e.target.closest('input[type="checkbox"]');
      if (!cb) return;
      const colId = cb.dataset.col;
      const updated = new Set(useStore().visibleCols);

      if (cb.checked) {
        updated.add(colId);
      } else {
        if (updated.size <= 1) {
          alert('Mantenha pelo menos 1 coluna visível.');
          cb.checked = true;
          return;
        }
        updated.delete(colId);
      }
      store.setVisibleCols(updated);

      const item = cb.closest('.ctx-col-item');
      if (item) {
        item.classList.toggle('is-muted', !cb.checked);
      }
    });

    // 2. Reordenação via botões subir/descer
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-move]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const direction = btn.dataset.move;
      const colId = btn.dataset.col;
      const { columnOrder } = useStore();
      const order = [...(Array.isArray(columnOrder) && columnOrder.length ? columnOrder : ALL_COLUMNS.map(c => c.id))];
      const idx = order.indexOf(colId);
      if (idx === -1) return;

      if (direction === 'up' && idx > 0) {
        const tmp = order[idx - 1];
        order[idx - 1] = order[idx];
        order[idx] = tmp;
        store.setColumnOrder(order);
        renderColGrid();
      } else if (direction === 'down' && idx < order.length - 1) {
        const tmp = order[idx + 1];
        order[idx + 1] = order[idx];
        order[idx] = tmp;
        store.setColumnOrder(order);
        renderColGrid();
      }
    });

    // 3. Drag and Drop para reordenação
    grid.addEventListener('dragstart', e => {
      const item = e.target.closest('.ctx-col-item');
      if (!item) return;
      draggedColId = item.dataset.col;
      item.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedColId);
      }
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      const targetItem = e.target.closest('.ctx-col-item');
      if (!targetItem || targetItem.dataset.col === draggedColId) return;

      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      grid.querySelectorAll('.ctx-col-item.drag-over').forEach(el => {
        if (el !== targetItem) el.classList.remove('drag-over');
      });
      targetItem.classList.add('drag-over');
    });

    grid.addEventListener('dragleave', e => {
      const targetItem = e.target.closest('.ctx-col-item');
      if (targetItem && !targetItem.contains(e.relatedTarget)) {
        targetItem.classList.remove('drag-over');
      }
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      grid.querySelectorAll('.ctx-col-item').forEach(el => {
        el.classList.remove('drag-over', 'dragging');
      });

      const targetItem = e.target.closest('.ctx-col-item');
      if (!targetItem || !draggedColId) return;
      const targetColId = targetItem.dataset.col;
      if (!targetColId || targetColId === draggedColId) return;

      const { columnOrder } = useStore();
      const order = [...(Array.isArray(columnOrder) && columnOrder.length ? columnOrder : ALL_COLUMNS.map(c => c.id))];
      const fromIdx = order.indexOf(draggedColId);
      const toIdx = order.indexOf(targetColId);

      if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, draggedColId);
        store.setColumnOrder(order);
        renderColGrid();
      }
      draggedColId = null;
    });

    grid.addEventListener('dragend', () => {
      grid.querySelectorAll('.ctx-col-item').forEach(el => {
        el.classList.remove('drag-over', 'dragging');
      });
      draggedColId = null;
    });
  }

  const btnClose = $('#btnCloseColMenu');
  if (btnClose) btnClose.onclick = closeColMenu;

  const btnSave = $('#btnSaveCols');
  if (btnSave) btnSave.onclick = closeColMenu;

  const backdrop = $('#colBackdrop');
  if (backdrop) backdrop.onclick = closeColMenu;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeColMenu();
  });

  const resetBtn = $('#btnResetCols');
  if (resetBtn) {
    resetBtn.onclick = () => {
      const defSet = new Set(ALL_COLUMNS.filter(c => c.def).map(c => c.id));
      const defOrder = ALL_COLUMNS.map(c => c.id);
      store.setColumnConfig({ visibleCols: defSet, columnOrder: defOrder });
      renderColGrid();
      showToast('Colunas e ordem restauradas para o padrão');
    };
  }

  const editColsBtn = $('#btnEditCols');
  if (editColsBtn) {
    editColsBtn.onclick = () => openColMenu();
  }

  const listaEl = $('#lista');
  if (listaEl) {
    listaEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      openColMenu(e.clientX, e.clientY);
    });
  }
}
