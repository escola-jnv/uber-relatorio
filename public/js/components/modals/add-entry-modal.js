import { $, hm } from '../../utils/format.js';

export function openAddEntryModal(mode = 'quick') {
  const dlg = $('#dlgAddEntry');
  if (!dlg) return;

  if ($('#fT')) {
    $('#fT').value = hm(new Date());
  }

  setAddEntryMode(mode);
  dlg.showModal();

  setTimeout(() => {
    if (mode === 'quick') {
      $('#q')?.focus();
    } else {
      $('#fV')?.focus();
    }
  }, 50);
}

export function closeAddEntryModal() {
  const dlg = $('#dlgAddEntry');
  if (dlg && dlg.open) {
    dlg.close();
  }
}

export function setAddEntryMode(mode) {
  const isQuick = mode === 'quick';
  const secQuick = $('#secModeQuick');
  const secDetail = $('#secModeDetail');
  const btnQuick = $('#btnModeQuick');
  const btnDetail = $('#btnModeDetail');

  if (secQuick) secQuick.hidden = !isQuick;
  if (secDetail) secDetail.hidden = isQuick;

  if (btnQuick) btnQuick.classList.toggle('on', isQuick);
  if (btnDetail) btnDetail.classList.toggle('on', !isQuick);
}

export function initAddEntryModal() {
  const dlg = $('#dlgAddEntry');
  const fab = $('#btnFabAdd');

  if (fab) {
    fab.onclick = () => openAddEntryModal('quick');
  }

  $('#btnCloseAddEntry')?.addEventListener('click', () => closeAddEntryModal());
  $('#btnCancelAddEntry')?.addEventListener('click', () => closeAddEntryModal());

  $('#btnModeQuick')?.addEventListener('click', () => {
    setAddEntryMode('quick');
    $('#q')?.focus();
  });

  $('#btnModeDetail')?.addEventListener('click', () => {
    setAddEntryMode('detail');
    if ($('#fT')) $('#fT').value = hm(new Date());
    $('#fV')?.focus();
  });

  if (dlg) {
    dlg.addEventListener('click', e => {
      if (e.target === dlg) {
        closeAddEntryModal();
      }
    });
  }
}
