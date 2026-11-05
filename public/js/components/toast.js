import { $ } from '../utils/format.js';

let toastTimeout = null;

export function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove('on');
  }, 2400);
}

// Alias
export const toast = showToast;
