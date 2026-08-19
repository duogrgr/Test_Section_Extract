/* ============================================================
   Генерация и скачивание .ics-файла (RFC 5545).
   Открывается в Apple Calendar, Google Calendar, Outlook.
   ============================================================ */

const pad = (n) => String(n).padStart(2, '0');

/** Локальная временная метка формата 20260829T180000 (без Z — «плавающее» время). */
const stamp = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
  `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** Экранирование текста по RFC 5545. */
const esc = (s) =>
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/** Фолдинг длинных строк (лимит ~75 октетов, продолжение с пробела). */
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 72) {
    out.push(rest.slice(0, 72));
    rest = ' ' + rest.slice(72);
  }
  out.push(rest);
  return out.join('\r\n');
}

/**
 * Собирает содержимое .ics.
 * @param {{title:string, start:string, durationHours?:number, location?:string, description?:string}} cfg
 */
export function buildICS({ title, start, durationHours = 3, location = '', description = '' }) {
  const dtStart = new Date(start);
  const dtEnd = new Date(dtStart.getTime() + durationHours * 3600e3);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SaveTheDate//ShakeReveal//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-save-the-date@local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(dtStart)}`,
    `DTEND:${stamp(dtEnd)}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Скачивает .ics через Blob. */
export function downloadICS(filename, icsText) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
