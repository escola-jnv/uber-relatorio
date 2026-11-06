import { $ } from '../utils/format.js';
import { useStore } from '../state/store.js';
import { getActiveCar } from '../services/car-service.js';
import { saveEntry } from '../services/entries-service.js';
import { showToast } from './toast.js';

// Definição dos 5 eventos rápidos de pausa e bem-estar
export const QUICK_EVENTS = [
  { id: 'pausa', label: 'Pausa', icone: '⏸️', defaultMin: 120 },
  { id: 'agua', label: 'Água', icone: '💧', defaultMin: 60 },
  { id: 'banheiro', label: 'Banheiro', icone: '🚻', defaultMin: 150 },
  { id: 'comida', label: 'Comida', icone: '🍽️', defaultMin: 240 },
  { id: 'descanso', label: 'Descanso', icone: '😴', defaultMin: 180 }
];

// Duração do clique longo necessário para registrar e resetar (5 segundos)
const HOLD_DURATION_MS = 5000;

// Estado dos timers locais
let eventTimers = {};
let activeHold = null;
let tickInterval = null;

/**
 * Carrega os timestamps dos eventos a partir do localStorage ou do histórico de lançamentos
 */
export function carregarTimestampsEventos(rows = []) {
  const agora = Date.now();

  for (const ev of QUICK_EVENTS) {
    const storageKey = `uber_event_timer_${ev.id}`;
    let saved = localStorage.getItem(storageKey);
    let ts = saved ? parseInt(saved, 10) : null;

    // Se não tiver no storage, busca no histórico recente de lançamentos
    if (!ts && Array.isArray(rows) && rows.length > 0) {
      const regex = new RegExp(`(pausa|${ev.id}|${ev.label})`, 'i');
      const matchingRow = rows
        .filter(r => (r.tipo === 'pausa_ini' || r.tipo === 'pausa_fim') && regex.test(r.obs || ''))
        .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];

      if (matchingRow) {
        ts = new Date(matchingRow.ts).getTime();
      }
    }

    // Se ainda não houver registro prévio, define um ponto inicial amigável (início da sessão ou agora)
    if (!ts || isNaN(ts) || ts > agora) {
      ts = agora;
      localStorage.setItem(storageKey, String(ts));
    }

    eventTimers[ev.id] = ts;
  }
}

/**
 * Formata o tempo decorrido do timer em formato amigável (ex: 5m, 1h 20m)
 */
export function formatarTempoTimer(ms) {
  const seg = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(seg / 60);
  if (min < 60) {
    return `${min}m`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Atualiza os valores visuais dos timers continuamente
 */
export function atualizarTimersVisuais() {
  const agora = Date.now();
  for (const ev of QUICK_EVENTS) {
    const el = $(`#timerVal_${ev.id}`);
    if (!el) continue;
    const ts = eventTimers[ev.id] || agora;
    const diff = Math.max(0, agora - ts);
    el.textContent = formatarTempoTimer(diff);

    // Destaque de cor caso tenha passado muito tempo sem o evento
    const parentBtn = $(`#btnQuickEvent_${ev.id}`);
    if (parentBtn) {
      const minDecorrido = diff / 60000;
      if (minDecorrido >= (ev.defaultMin * 1.5)) {
        parentBtn.classList.add('timer-atrasado');
      } else {
        parentBtn.classList.remove('timer-atrasado');
      }
    }
  }
}

/**
 * Reseta a contagem de um evento e registra o evento correspondente no sistema
 */
export async function registrarEventoQuick(id) {
  const ev = QUICK_EVENTS.find(e => e.id === id);
  if (!ev) return;

  const agora = Date.now();
  eventTimers[id] = agora;
  localStorage.setItem(`uber_event_timer_${id}`, String(agora));
  atualizarTimersVisuais();

  // Feedback tátil em dispositivos móveis
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([100, 50, 100]); } catch (e) {}
  }

  // Registra no banco / estado
  const active = getActiveCar();
  const selCar = active ? active.placa : null;
  const isoNow = new Date(agora).toISOString();

  try {
    await saveEntry({
      row: {
        tipo: 'pausa_ini',
        ts: isoNow,
        valor: null,
        obs: `Pausa: ${ev.label}`,
        origem: 'manual',
        carro: selCar
      },
      carro: selCar
    });
    showToast(`✅ ${ev.icone} ${ev.label} registrado! Timer resetado.`);
  } catch (err) {
    console.error('Erro ao registrar evento rápido:', err);
    showToast(`✅ ${ev.icone} Timer de ${ev.label} resetado.`);
  }
}

/**
 * Renderiza o HTML dos botões redondos no container do topo
 */
export function renderQuickEvents() {
  const container = $('#quickEventsBar');
  if (!container) return;

  const { rows } = useStore();
  carregarTimestampsEventos(rows);

  container.innerHTML = `
    <div class="quick-events-track">
      ${QUICK_EVENTS.map(ev => {
        const ts = eventTimers[ev.id] || Date.now();
        const diff = Math.max(0, Date.now() - ts);
        const tempoTxt = formatarTempoTimer(diff);

        return `
          <div class="quick-event-item" id="itemQuickEvent_${ev.id}">
            <button
              type="button"
              class="quick-circle-btn"
              id="btnQuickEvent_${ev.id}"
              data-ev-id="${ev.id}"
              aria-label="Registrar ${ev.label} (segure por 5 segundos)"
              title="Pressione e segure por 5s para registrar ${ev.label} e zerar o timer"
            >
              <!-- SVG circular de progresso (preenchimento ao segurar 5s) -->
              <svg class="quick-circle-svg" viewBox="0 0 54 54">
                <circle class="circle-bg" cx="27" cy="27" r="23" />
                <circle class="circle-progress" id="circleProg_${ev.id}" cx="27" cy="27" r="23" />
              </svg>

              <!-- Conteúdo interno: Ícone emoji e contador de contagem regressiva ao segurar -->
              <div class="quick-circle-inner">
                <span class="quick-icon">${ev.icone}</span>
                <span class="quick-hold-count" id="holdCount_${ev.id}" hidden>5s</span>
              </div>
            </button>
            <div class="quick-label-box">
              <span class="quick-label-name">${ev.label}</span>
              <span class="quick-timer-val" id="timerVal_${ev.id}">${tempoTxt}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  vincularEventosLongPress();
  atualizarTimersVisuais();
}

/**
 * Vincula listeners de toque/mouse para detectar a pressão contínua de 5 segundos
 */
function vincularEventosLongPress() {
  for (const ev of QUICK_EVENTS) {
    const btn = $(`#btnQuickEvent_${ev.id}`);
    if (!btn) continue;

    // Previne menu de contexto ao segurar no mobile
    btn.oncontextmenu = e => {
      e.preventDefault();
      return false;
    };

    const iniciarPressao = e => {
      if (activeHold) cancelarPressao(activeHold.id);

      const circle = $(`#circleProg_${ev.id}`);
      const holdCount = $(`#holdCount_${ev.id}`);
      const icon = btn.querySelector('.quick-icon');

      btn.classList.add('holding');
      if (holdCount) {
        holdCount.hidden = false;
        holdCount.textContent = '5s';
      }
      if (icon) icon.style.opacity = '0.3';

      const startTime = Date.now();

      // Animação de progresso do SVG (circunferência 2 * PI * 23 ≈ 144.5)
      const circumference = 2 * Math.PI * 23;
      if (circle) {
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;
        circle.style.transition = `stroke-dashoffset ${HOLD_DURATION_MS}ms linear`;
        // Força reflow
        void circle.getBoundingClientRect();
        circle.style.strokeDashoffset = '0';
      }

      const countdownInterval = setInterval(() => {
        const decorrido = Date.now() - startTime;
        const restanteSeg = Math.max(1, Math.ceil((HOLD_DURATION_MS - decorrido) / 1000));
        if (holdCount) holdCount.textContent = `${restanteSeg}s`;
      }, 250);

      const timeoutId = setTimeout(async () => {
        clearInterval(countdownInterval);
        finalizarPressaoComSucesso(ev.id);
      }, HOLD_DURATION_MS);

      activeHold = {
        id: ev.id,
        startTime,
        timeoutId,
        countdownInterval,
        btn,
        circle,
        holdCount,
        icon
      };
    };

    const cancelarPressao = id => {
      if (!activeHold || activeHold.id !== id) return;

      const duracao = Date.now() - activeHold.startTime;
      clearTimeout(activeHold.timeoutId);
      clearInterval(activeHold.countdownInterval);

      if (activeHold.btn) activeHold.btn.classList.remove('holding');
      if (activeHold.holdCount) activeHold.holdCount.hidden = true;
      if (activeHold.icon) activeHold.icon.style.opacity = '1';
      if (activeHold.circle) {
        activeHold.circle.style.transition = 'stroke-dashoffset 0.15s ease-out';
        activeHold.circle.style.strokeDashoffset = `${2 * Math.PI * 23}`;
      }

      // Se segurou por mais de 500ms e soltou antes dos 5s, orienta o usuário
      if (duracao > 600 && duracao < HOLD_DURATION_MS) {
        showToast(`⏱️ Segure por 5s para registrar ${ev.label}.`);
      }

      activeHold = null;
    };

    const finalizarPressaoComSucesso = async id => {
      if (!activeHold || activeHold.id !== id) return;

      const holdRef = activeHold;
      activeHold = null;

      if (holdRef.btn) {
        holdRef.btn.classList.remove('holding');
        holdRef.btn.classList.add('pulse-success');
        setTimeout(() => holdRef.btn.classList.remove('pulse-success'), 600);
      }
      if (holdRef.holdCount) holdRef.holdCount.hidden = true;
      if (holdRef.icon) holdRef.icon.style.opacity = '1';
      if (holdRef.circle) {
        holdRef.circle.style.transition = 'none';
        holdRef.circle.style.strokeDashoffset = `${2 * Math.PI * 23}`;
      }

      await registrarEventoQuick(id);
    };

    // Suporte amplo: Pointer Events, Mouse e Touch
    btn.addEventListener('pointerdown', iniciarPressao);
    btn.addEventListener('pointerup', () => cancelarPressao(ev.id));
    btn.addEventListener('pointerleave', () => cancelarPressao(ev.id));
    btn.addEventListener('pointercancel', () => cancelarPressao(ev.id));

    btn.addEventListener('touchstart', iniciarPressao, { passive: true });
    btn.addEventListener('touchend', () => cancelarPressao(ev.id));
    btn.addEventListener('touchcancel', () => cancelarPressao(ev.id));
  }
}

/**
 * Inicialização global do componente de eventos rápidos
 */
export function initQuickEvents() {
  renderQuickEvents();

  // Inicia o timer constantemente ligado (atualiza a cada 1 segundo)
  if (!tickInterval) {
    tickInterval = setInterval(() => {
      atualizarTimersVisuais();
    }, 1000);
  }
}
