/* ============================================================
   Счётчик «сколько людей сохранило дату».
   MVP: localStorage. Хук для будущей БД — syncSaveToBackend().
   ============================================================ */

export const BASE_COUNT = 47; // стартовое число сохранений — подставь значение из БД

const KEY_EXTRA = 'std_saves_extra_v1'; // сколько раз сохранили на этом устройстве сверх базы
const KEY_ME = 'std_saved_by_me_v1'; // отметка «я уже сохранил»

const readExtra = () => parseInt(localStorage.getItem(KEY_EXTRA) || '0', 10);

export function getCount() {
  return BASE_COUNT + readExtra();
}

export function hasSaved() {
  return localStorage.getItem(KEY_ME) === '1';
}

/** Регистрирует сохранение (один раз на устройство). true — если это первое сохранение. */
export function registerSave() {
  if (hasSaved()) return false;
  localStorage.setItem(KEY_ME, '1');
  localStorage.setItem(KEY_EXTRA, String(readExtra() + 1));
  return true;
}

/**
 * ХУК ДЛЯ БД. Сейчас — заглушка; в продакшене замени тело на запрос, например:
 *
 *   return fetch('https://YOUR-BACKEND/api/saves', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   }).then((r) => r.ok);
 *
 * Вызывается fire-and-forget из main.js, поэтому сбой сети ничего не ломает.
 */
export async function syncSaveToBackend(payload) {
  console.info('[store] syncSaveToBackend (заглушка), payload:', payload);
  return true;
}
