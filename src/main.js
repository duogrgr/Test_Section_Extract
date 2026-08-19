/* ============================================================
   SAVE THE DATE · vanilla JS, без фреймворков.
   Стейт-машина:
     0 — дымка, подсказка «встряхни устройство»
     1 — 1-й шейк: дымка рассеивается, проявляются логотипы
     2 — 2-й шейк: появляется дата
     3 — 3-й шейк: появляется редактируемый текст
     4 — свайп вниз: нижний блок (ics + таймер + счётчик)
   ============================================================ */

import './styles.css';
import { initShake, requestMotionPermission } from './shake.js';
import { buildICS, downloadICS } from './ics.js';
import { getCount, registerSave, syncSaveToBackend } from './store.js';

/* ================= НАСТРОЙКИ СОБЫТИЯ — отредактируй под себя ================= */
const CONFIG = {
  eventTitle: 'Save the Date',
  eventDate: '2026-08-29T18:00:00', // локальное время события
  durationHours: 5,
  location: 'Москва · концертный зал «Аврора»',
  defaultMessage:
    'День, к которому мы шли целый год. Держи дату — детали расскажем совсем скоро, но главное уже известно: мы будем вместе.',
  icsFile: 'save-the-date.ics',
  msgStorageKey: 'std_message_v1',
};
/* =========================================================================== */

const $ = (s) => document.querySelector(s);
const body = document.body;
const stage = $('#stage');
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

if (tg) {
  tg.ready();
  if (tg.expand) tg.expand();
}

const eventDate = new Date(CONFIG.eventDate);

/* ---------- утилиты ---------- */

function vibrate(pattern) {
  if (tg && tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('medium');
  } else if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function plural(n, forms) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- рендер даты из CONFIG ---------- */

const timeStr = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
}).format(eventDate);

$('#dateWeekday').textContent = cap(
  new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(eventDate)
);
$('#dateBig').textContent = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
}).format(eventDate);
$('#dateMeta').textContent = `${eventDate.getFullYear()} · ${timeStr} · ${CONFIG.location}`;

/* ---------- редактируемый текст (стейт 3) ---------- */

const msgEl = $('#messageInput');
msgEl.textContent = localStorage.getItem(CONFIG.msgStorageKey) || CONFIG.defaultMessage;
msgEl.addEventListener('input', () => {
  localStorage.setItem(CONFIG.msgStorageKey, msgEl.textContent);
});

/* ================= СТЕЙТ-МАШИНА ================= */

let state = 0;
let fallbackMode = false;
let sheetOpen = false;

const statusTexts = [
  'Встряхни устройство — дымка рассеется',
  'Ещё раз! Проявится дата',
  'И ещё один раз — появится послание',
  'Свайп вниз — там всё важное',
];

const statusEl = $('#statusText');

function setStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.remove('swap');
  void statusEl.offsetWidth; // перезапуск анимации
  statusEl.classList.add('swap');
}

function setState(next) {
  if (next <= state || next > 3) return;
  state = next;
  body.dataset.state = state;

  if (state === 1) $('#haze').classList.add('dissolved');

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (Number(el.dataset.reveal) <= state) el.classList.add('revealed');
  });

  document.querySelectorAll('.dots i').forEach((d, i) => {
    d.classList.toggle('done', i < state);
    d.classList.toggle('active', i === state);
  });

  setStatus(statusTexts[state]);
  if (state >= 3) $('#swipeHint').classList.add('show');

  vibrate([28, 40, 55]);
  stage.classList.remove('jolt');
  void stage.offsetWidth;
  stage.classList.add('jolt');
}

/** Шаг вперёд по шейку (или по тапу/пробелу в fallback-режиме). */
function progress() {
  if (sheetOpen) return;
  if (state < 3) {
    setState(state + 1);
  } else {
    const hint = $('#swipeHint');
    hint.classList.remove('pulse');
    void hint.offsetWidth;
    hint.classList.add('pulse');
    vibrate(20);
  }
}

/* ================= ДАТЧИКИ + iOS-разрешение ================= */

const enableBtn = $('#enableMotion');
const sensorNote = $('#sensorNote');

function enterFallback(message) {
  fallbackMode = true;
  body.classList.add('fallback');
  enableBtn.hidden = true;
  sensorNote.textContent = message;
}

const support = initShake({
  onShake: progress,
  onFirstMotion: () => body.classList.add('has-motion'),
});

if (support === 'needs-permission') {
  // iOS 13+: разрешение запрашивается только по клику
  enableBtn.hidden = false;
  sensorNote.textContent = 'iOS просит разрешение на датчик — нажми один раз';

  enableBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    enableBtn.disabled = true;
    enableBtn.textContent = 'Запрашиваем…';
    const result = await requestMotionPermission(progress);
    if (result === 'granted') {
      enableBtn.hidden = true;
      sensorNote.textContent = 'Датчик включён — встряхни устройство';
      setTimeout(() => {
        sensorNote.textContent = '';
      }, 2200);
    } else {
      enterFallback('Датчик недоступен — тапай по экрану или жми пробел');
    }
  });
} else if (support === 'unsupported') {
  enterFallback('Нет датчика движения — тапай по экрану или жми пробел');
}

/* Fallback: тап по экрану (только если датчика нет / доступ запрещён) */
stage.addEventListener('click', (e) => {
  if (!fallbackMode || sheetOpen) return;
  if (e.target.closest('button, [contenteditable], a')) return;
  progress();
});

/* Fallback: пробел на десктопе работает всегда */
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  if (document.activeElement && document.activeElement.isContentEditable) return;
  e.preventDefault();
  progress();
});

/* ================= СВАЙП ВНИЗ → СТЕЙТ 4 ================= */

let touchX = null;
let touchY = null;

stage.addEventListener(
  'touchstart',
  (e) => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  },
  { passive: true }
);

stage.addEventListener(
  'touchend',
  (e) => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = touchY = null;
    if (state >= 3 && !sheetOpen && dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.4) {
      openSheet();
    }
  },
  { passive: true }
);

$('#swipeHint').addEventListener('click', (e) => {
  e.stopPropagation();
  openSheet();
});

/* ================= НИЖНИЙ БЛОК ================= */

const sheet = $('#sheet');
const backdrop = $('#sheetBackdrop');

function openSheet() {
  sheetOpen = true;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('show');
  document.querySelectorAll('.dots i').forEach((d) => {
    d.classList.add('done');
    d.classList.remove('active');
  });
  vibrate(20);
}

function closeSheet() {
  sheetOpen = false;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('show');
}

$('#sheetClose').addEventListener('click', closeSheet);
backdrop.addEventListener('click', closeSheet);

/* ---------- обратный отсчёт ---------- */

const cdEls = { d: $('#cdD'), h: $('#cdH'), m: $('#cdM'), s: $('#cdS') };
let cdTimer = null;
let prevSec = null;

function tickCountdown() {
  const diff = eventDate.getTime() - Date.now();
  if (diff <= 0) {
    $('#countdown').hidden = true;
    $('#cdDone').hidden = false;
    clearInterval(cdTimer);
    return;
  }
  const total = Math.floor(diff / 1000);
  const vals = {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
  cdEls.d.textContent = vals.d;
  cdEls.h.textContent = String(vals.h).padStart(2, '0');
  cdEls.m.textContent = String(vals.m).padStart(2, '0');
  cdEls.s.textContent = String(vals.s).padStart(2, '0');

  if (prevSec !== vals.s) {
    prevSec = vals.s;
    const num = cdEls.s;
    num.classList.remove('tick');
    void num.offsetWidth;
    num.classList.add('tick');
  }
}

tickCountdown();
cdTimer = setInterval(tickCountdown, 1000);

/* ---------- счётчик «кто сохранил» + Save date ---------- */

const saversCountEl = $('#saversCount');
const saversWordEl = $('#saversWord');

function renderCount(withBump) {
  const n = getCount();
  saversCountEl.textContent = n;
  saversWordEl.textContent = plural(n, [
    'человек сохранил дату',
    'человека сохранили дату',
    'человек сохранили дату',
  ]);
  if (withBump) {
    saversCountEl.classList.remove('bump');
    void saversCountEl.offsetWidth;
    saversCountEl.classList.add('bump');
  }
}

renderCount(false);

const saveBtn = $('#saveBtn');
const saveBtnHTML = saveBtn.innerHTML;
const checkIcon =
  '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M4.5 12.5l5 5L19.5 7" stroke="currentColor" stroke-width="2.4" ' +
  'fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

saveBtn.addEventListener('click', (e) => {
  e.stopPropagation();

  const description =
    (msgEl.innerText || '').trim() || CONFIG.defaultMessage;

  const ics = buildICS({
    title: CONFIG.eventTitle,
    start: CONFIG.eventDate,
    durationHours: CONFIG.durationHours,
    location: CONFIG.location,
    description,
  });
  downloadICS(CONFIG.icsFile, ics);

  const firstSave = registerSave();
  if (firstSave) {
    renderCount(true);
    // Хук для БД: fire-and-forget, сбой сети ничего не ломает
    syncSaveToBackend({
      event: CONFIG.eventTitle,
      savedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  vibrate([30, 50, 80]);

  const btn = e.currentTarget;
  btn.classList.add('saved');
  btn.innerHTML = checkIcon + '<span>Сохранено</span>';
  setTimeout(() => {
    btn.classList.remove('saved');
    btn.innerHTML = saveBtnHTML;
  }, 2200);
});
