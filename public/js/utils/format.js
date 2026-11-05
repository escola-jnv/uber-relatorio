// Seletores DOM utilitários
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

// Formatação monetária completa (ex: R$ 25,50)
export const R = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Formatação monetária arredondada (ex: R$ 25)
export const R0 = v => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');

// Formatação numérica com até 1 casa decimal (ex: 12,5)
export const N1 = v => (v || 0).toLocaleString('pt-BR', {
  maximumFractionDigits: 1
});

// Pad com zero à esquerda
export const pad = n => String(n).padStart(2, '0');

// Chave no formato YYYY-MM-DD
export const dk = d => {
  d = new Date(d);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

// Horário no formato HH:MM
export const hm = d => {
  d = new Date(d);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};

// Início da semana (Segunda-feira)
export const weekStart = d => {
  d = new Date(d);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

// Escape seguro de caracteres HTML
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[c]));

// Conversão segura de string com vírgula para número float
export const parseNum = s => {
  if (s === null || s === undefined || s === '') return null;
  const str = String(s).trim();
  const normalized = str.replace(/\./g, str.includes(',') ? '' : '.').replace(',', '.');
  const val = parseFloat(normalized);
  return Number.isNaN(val) ? null : val;
};

// Re-exporta DS para compatibilidade
export { DS } from './constants.js';
