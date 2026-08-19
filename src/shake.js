/* ============================================================
   Детектор «тряски» на DeviceMotionEvent (акселерометр).
   iOS 13+ требует DeviceMotionEvent.requestPermission()
   строго по пользовательскому жесту (клик по кнопке).
   ============================================================ */

const THRESHOLD = 16; // чувствительность: сумма |дельт| ускорения за событие (м/с²)
const COOLDOWN = 1600; // мс — защита от «пулемётной» серии шейков

let onShakeCb = null;
let onFirstMotionCb = null;
let prev = null;
let lastShakeAt = 0;
let sawMotion = false;

function handleMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a || a.x == null) return;

  if (!sawMotion) {
    sawMotion = true;
    if (onFirstMotionCb) onFirstMotionCb();
  }

  if (prev) {
    const delta =
      Math.abs(a.x - prev.x) +
      Math.abs(a.y - prev.y) +
      Math.abs(a.z - prev.z);
    const now = performance.now();

    if (delta > THRESHOLD && now - lastShakeAt > COOLDOWN) {
      lastShakeAt = now;
      if (onShakeCb) onShakeCb();
    }
  }
  prev = { x: a.x, y: a.y, z: a.z };
}

/**
 * Подключает детектор. Возвращает:
 *  'ready'           — подписка активна (Android, десктоп);
 *  'needs-permission'— iOS 13+: нужно вызвать requestMotionPermission() по клику;
 *  'unsupported'     — датчика нет вообще (включаем fallback: тап/пробел).
 */
export function initShake({ onShake, onFirstMotion }) {
  onShakeCb = onShake;
  onFirstMotionCb = onFirstMotion;

  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    return 'needs-permission';
  }

  window.addEventListener('devicemotion', handleMotion);
  return 'ready';
}

/**
 * Запрос разрешения на iOS. ОБЯЗАТЕЛЬНО вызывать из обработчика клика —
 * Safari даёт запрос только внутри пользовательского жеста.
 */
export async function requestMotionPermission(shakeCb) {
  onShakeCb = shakeCb;
  try {
    const result = await DeviceMotionEvent.requestPermission();
    if (result === 'granted') {
      window.addEventListener('devicemotion', handleMotion);
      return 'granted';
    }
    return 'denied';
  } catch (err) {
    console.warn('[shake] requestPermission отклонён:', err);
    return 'denied';
  }
}
