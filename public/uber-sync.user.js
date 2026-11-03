// ==UserScript==
// @name         Uber → Relatório (sync de ganhos)
// @namespace    uber-relatorio
// @version      1.0
// @description  Lê os ganhos/viagens do drivers.uber.com enquanto você está logado e envia para a sua app.
// @match        https://drivers.uber.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  // >>> CONFIGURE AQUI <<<
  const APP = 'https://uber-relatorio-eight.vercel.app'; // URL da sua app na Vercel
  const TOKEN = '';                            // igual à variável TOKEN da Vercel (se usar)
  const RELOAD_MIN = 10;                        // recarrega a página de ganhos a cada X min (0 = nunca)

  const seen = new Map();
  let timer = null;

  // Procura, em qualquer JSON que a página receba, objetos com cara de "viagem":
  // um id + um valor em dinheiro + um horário.
  const ID = ['uuid', 'tripUUID', 'tripUuid', 'tripId', 'trip_id', 'jobUUID', 'jobUuid', 'activityUUID'];
  const AMT = ['total', 'totalEarnings', 'earnings', 'netEarnings', 'fare', 'amount', 'payout', 'formattedTotal', 'totalAmount'];
  const TS = ['requestedAt', 'dropoffTime', 'dropoffAt', 'completedAt', 'endTime', 'recognizedAt', 'timestamp', 'date', 'startTime'];

  function money(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const s = v.replace(/[^\d,.-]/g, '');
      if (!s) return null;
      const n = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
      return parseFloat(n);
    }
    if (typeof v === 'object') {
      if (v.amountE5 != null) return +v.amountE5 / 1e5;
      if (v.amount != null) return money(v.amount);
      if (v.value != null) return money(v.value);
      if (v.formatted || v.formattedAmount) return money(v.formatted || v.formattedAmount);
    }
    return null;
  }
  function time(v) {
    if (v == null) return null;
    if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v);
    const d = new Date(v); return isNaN(d) ? null : d;
  }
  function walk(o, out, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, out, depth + 1)); return; }
    const id = ID.map(k => o[k]).find(v => typeof v === 'string' && v.length > 8);
    if (id) {
      const val = AMT.map(k => money(o[k])).find(v => v != null && v > 0 && v < 2000);
      const ts = TS.map(k => time(o[k])).find(Boolean);
      if (val && ts) {
        const km = money(o.distance ?? o.tripDistance ?? o.distanceKm);
        out.push({ id, ts: ts.toISOString(), valor: val, km: km && km < 500 ? km : null });
      }
    }
    for (const k in o) walk(o[k], out, depth + 1);
  }
  function handle(json) {
    const found = []; walk(json, found);
    found.forEach(t => seen.set(t.id, t));
    if (found.length) { clearTimeout(timer); timer = setTimeout(flush, 1500); }
  }
  async function flush() {
    const trips = [...seen.values()];
    if (!trips.length) return;
    try {
      const r = await fetch(APP + '/api/uber', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-token': TOKEN },
        body: JSON.stringify({ trips })
      });
      const j = await r.json();
      badge(`✓ ${j.salvos ?? 0} viagens enviadas · ${new Date().toLocaleTimeString().slice(0, 5)}`);
    } catch (e) { badge('✗ erro ao enviar: ' + e.message); }
  }
  function badge(msg) {
    let b = document.getElementById('ur-badge');
    if (!b) {
      b = document.createElement('div'); b.id = 'ur-badge';
      b.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99999;background:#111;color:#7CFC9A;font:12px system-ui;padding:6px 10px;border-radius:8px;opacity:.9';
      document.documentElement.appendChild(b);
    }
    b.textContent = 'Relatório: ' + msg;
  }

  // intercepta fetch e XHR da própria página
  const of = window.fetch;
  window.fetch = async function (...a) {
    const r = await of.apply(this, a);
    try { if ((r.headers.get('content-type') || '').includes('json')) r.clone().json().then(handle).catch(() => {}); } catch {}
    return r;
  };
  const oo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...a) {
    this.addEventListener('load', () => { try { handle(JSON.parse(this.responseText)); } catch {} });
    return oo.apply(this, a);
  };

  if (RELOAD_MIN > 0) setTimeout(() => location.reload(), RELOAD_MIN * 60e3);
  setTimeout(() => badge(seen.size ? `${seen.size} viagens vistas` : 'aguardando dados… abra Ganhos › Atividades'), 8000);
})();
